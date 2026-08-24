import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	createIrSnapshot,
	deserializeIrSnapshot,
	normalizeSnapshotForCompare,
	restoreSnapshotComponents,
	serializeIrSnapshot,
	type IrSnapshot
} from '$lib/ir/snapshot';
import {
	assertSafeLogicalIdPathSegment,
	buildSnapshotMetaForWrite,
	createEmptyUiDefinitionMeta,
	toEditorMeta,
	type UiDefinitionEditorMeta,
	type UiDefinitionSnapshotMeta
} from '$lib/ir/ui-definition-meta';
import {
	loadApplicationConfig,
	resolveApplicationPath,
	type IrAutoSaveConfig
} from '$lib/server/config/application-config';
import { getLogger, runLogged } from '$lib/server/logging/logger';

const logger = getLogger(import.meta.url);

const SNAPSHOT_PREFIX = 'ir-snapshot-';
const SNAPSHOT_SUFFIX = '.yml';
/** ファイル名衝突時の最大試行回数（無 suffix 1 回 + suffix 付き） */
const MAX_SNAPSHOT_WRITE_ATTEMPTS = 100;

/**
 * snapshot ファイル名用のローカルタイムスタンプを生成する
 */
function formatSnapshotTimestamp(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');

	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		'T',
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds())
	].join('');
}

/**
 * 有効な autoSave 設定を取得する
 */
function getAutoSaveConfig(): IrAutoSaveConfig {
	const config = loadApplicationConfig();
	const autoSave = config.ir?.autoSave;

	if (!autoSave?.enabled) {
		throw new Error('ir.autoSave is not enabled');
	}

	return autoSave;
}

/**
 * autoSave.dir を絶対パスへ解決する
 */
function resolveSnapshotBaseDir(autoSave: IrAutoSaveConfig): string {
	return resolveApplicationPath(autoSave.dir);
}

/**
 * logicalId ごとの snapshot 保存ディレクトリを解決する
 */
export function resolveSnapshotDirForLogicalId(
	autoSave: IrAutoSaveConfig,
	logicalId: string
): string {
	const safeLogicalId = assertSafeLogicalIdPathSegment(logicalId);

	return join(resolveSnapshotBaseDir(autoSave), safeLogicalId);
}

/**
 * snapshot ファイル名を生成する（衝突時は連番 suffix を付与）
 */
function buildSnapshotFilename(savedAt: Date, suffix = ''): string {
	return `${SNAPSHOT_PREFIX}${formatSnapshotTimestamp(savedAt)}${suffix}${SNAPSHOT_SUFFIX}`;
}

/**
 * ファイル名から snapshot のソートキーを抽出する
 */
function snapshotSortKey(filename: string): string {
	if (!filename.startsWith(SNAPSHOT_PREFIX) || !filename.endsWith(SNAPSHOT_SUFFIX)) {
		return '';
	}

	return filename.slice(SNAPSHOT_PREFIX.length, -SNAPSHOT_SUFFIX.length);
}

/**
 * dir 内の snapshot ファイル名を新しい順に列挙する
 */
export async function listSnapshotFilenames(dir: string): Promise<string[]> {
	let entries: string[];

	try {
		entries = await readdir(dir);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}

		throw error;
	}

	return entries
		.filter((name) => name.startsWith(SNAPSHOT_PREFIX) && name.endsWith(SNAPSHOT_SUFFIX))
		.sort((a, b) => snapshotSortKey(b).localeCompare(snapshotSortKey(a)));
}

/**
 * autoSave.dir 配下の logicalId ディレクトリ名を列挙する
 */
export async function listSnapshotLogicalIds(): Promise<string[]> {
	const autoSave = getAutoSaveConfig();
	const baseDir = resolveSnapshotBaseDir(autoSave);
	let entries;

	try {
		entries = await readdir(baseDir, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return [];
		}

		throw error;
	}

	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

/**
 * 世代上限を超えた古い snapshot を削除する
 */
export async function pruneSnapshots(dir: string, maxGenerations: number): Promise<string[]> {
	const filenames = await listSnapshotFilenames(dir);
	const toDelete = filenames.slice(maxGenerations);
	const deleted: string[] = [];

	for (const filename of toDelete) {
		await unlink(join(dir, filename));
		deleted.push(filename);
	}

	return deleted;
}

/**
 * 最新 snapshot の uiDefinition メタデータを取得する
 */
async function readLatestSnapshotMeta(dir: string): Promise<UiDefinitionSnapshotMeta | null> {
	const filenames = await listSnapshotFilenames(dir);
	const latest = filenames[0];

	if (!latest) {
		return null;
	}

	const yamlText = await readFile(join(dir, latest), 'utf8');
	const snapshot = deserializeIrSnapshot(yamlText);

	return snapshot.uiDefinition ?? null;
}

/**
 * 最新 snapshot の内容と同一か判定する
 */
async function isSameAsLatestSnapshot(
	dir: string,
	editorMeta: UiDefinitionEditorMeta,
	components: unknown[]
): Promise<boolean> {
	const filenames = await listSnapshotFilenames(dir);
	const latest = filenames[0];

	if (!latest) {
		return false;
	}

	const yamlText = await readFile(join(dir, latest), 'utf8');
	const snapshot = deserializeIrSnapshot(yamlText);
	const snapshotEditorMeta = snapshot.uiDefinition ? toEditorMeta(snapshot.uiDefinition) : editorMeta;

	return (
		normalizeSnapshotForCompare(snapshotEditorMeta, snapshot.components) ===
		normalizeSnapshotForCompare(editorMeta, components)
	);
}

/**
 * components を logicalId 別ディレクトリへ YAML snapshot として書き込む
 */
export async function writeSnapshot(
	editorMeta: UiDefinitionEditorMeta,
	components: unknown[]
): Promise<{ filename: string; savedAt: string; skipped: boolean }> {
	return runLogged(
		logger,
		'writeSnapshot',
		{ logicalId: editorMeta.logicalId, componentCount: components.length },
		() => writeSnapshotUnchecked(editorMeta, components)
	);
}

/**
 * components を logicalId 別ディレクトリへ YAML snapshot として書き込む（ログなし本体）
 */
async function writeSnapshotUnchecked(
	editorMeta: UiDefinitionEditorMeta,
	components: unknown[]
): Promise<{ filename: string; savedAt: string; skipped: boolean }> {
	const autoSave = getAutoSaveConfig();
	const dir = resolveSnapshotDirForLogicalId(autoSave, editorMeta.logicalId);

	await mkdir(dir, { recursive: true });

	if (await isSameAsLatestSnapshot(dir, editorMeta, components)) {
		const filenames = await listSnapshotFilenames(dir);
		const latest = filenames[0];
		const yamlText = await readFile(join(dir, latest), 'utf8');
		const snapshot = deserializeIrSnapshot(yamlText);

		return { filename: latest, savedAt: snapshot.savedAt, skipped: true };
	}

	const savedAt = new Date();
	const previousMeta = await readLatestSnapshotMeta(dir);
	const uiDefinition = buildSnapshotMetaForWrite(editorMeta, previousMeta, savedAt);

	for (let attempt = 1; attempt <= MAX_SNAPSHOT_WRITE_ATTEMPTS; attempt += 1) {
		const suffix = attempt === 1 ? '' : `-${attempt}`;
		const filename = buildSnapshotFilename(savedAt, suffix);
		const targetPath = join(dir, filename);

		try {
			const snapshot = createIrSnapshot(uiDefinition, components, savedAt);

			await writeFile(targetPath, serializeIrSnapshot(snapshot), { encoding: 'utf8', flag: 'wx' });
			await pruneSnapshots(dir, autoSave.maxGenerations);

			return { filename, savedAt: snapshot.savedAt, skipped: false };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
				throw error;
			}
		}
	}

	throw new Error(
		`Failed to write IR snapshot: no unique filename after ${MAX_SNAPSHOT_WRITE_ATTEMPTS} attempts`
	);
}

/**
 * logicalId 別ディレクトリから最新 snapshot を読み込む（存在しない場合は null）
 */
export async function readLatestSnapshot(logicalId: string): Promise<IrSnapshot | null> {
	const autoSave = getAutoSaveConfig();
	const dir = resolveSnapshotDirForLogicalId(autoSave, logicalId);
	const filenames = await listSnapshotFilenames(dir);
	const latest = filenames[0];

	if (!latest) {
		return null;
	}

	const yamlText = await readFile(join(dir, latest), 'utf8');
	const snapshot = deserializeIrSnapshot(yamlText);
	const editorDefaults = createEmptyUiDefinitionMeta();

	return {
		...snapshot,
		uiDefinition: snapshot.uiDefinition ?? {
			...editorDefaults,
			logicalId: assertSafeLogicalIdPathSegment(logicalId),
			createdAt: snapshot.savedAt,
			modifiedAt: snapshot.savedAt
		},
		components: restoreSnapshotComponents(snapshot.components)
	};
}

/**
 * autoSave が有効な場合のみ logicalId 別ディレクトリから最新 snapshot を読み込む
 */
export async function readLatestSnapshotIfEnabled(logicalId: string): Promise<IrSnapshot | null> {
	return runLogged(logger, 'readLatestSnapshotIfEnabled', { logicalId }, async () => {
		const config = loadApplicationConfig();

		if (!config.ir?.autoSave?.enabled) {
			return null;
		}

		return readLatestSnapshot(logicalId);
	});
}
