import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	createIrSnapshot,
	deserializeIrSnapshot,
	normalizeComponentsForCompare,
	restoreSnapshotComponents,
	serializeIrSnapshot,
	type IrSnapshot
} from '$lib/ir/snapshot';
import {
	loadApplicationConfig,
	resolveApplicationPath,
	type IrAutoSaveConfig
} from '$lib/server/config/application-config';

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
function resolveSnapshotDir(autoSave: IrAutoSaveConfig): string {
	return resolveApplicationPath(autoSave.dir);
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
 * 最新 snapshot の components と同一か判定する
 */
async function isSameAsLatestSnapshot(dir: string, components: unknown[]): Promise<boolean> {
	const filenames = await listSnapshotFilenames(dir);
	const latest = filenames[0];
	if (!latest) {
		return false;
	}

	const yamlText = await readFile(join(dir, latest), 'utf8');
	const snapshot = deserializeIrSnapshot(yamlText);
	return normalizeComponentsForCompare(snapshot.components) === normalizeComponentsForCompare(components);
}

/**
 * components を YAML snapshot として書き込む
 */
export async function writeSnapshot(
	components: unknown[]
): Promise<{ filename: string; savedAt: string; skipped: boolean }> {
	const autoSave = getAutoSaveConfig();
	const dir = resolveSnapshotDir(autoSave);
	await mkdir(dir, { recursive: true });

	if (await isSameAsLatestSnapshot(dir, components)) {
		const filenames = await listSnapshotFilenames(dir);
		const latest = filenames[0];
		const yamlText = await readFile(join(dir, latest), 'utf8');
		const snapshot = deserializeIrSnapshot(yamlText);
		return { filename: latest, savedAt: snapshot.savedAt, skipped: true };
	}

	const savedAt = new Date();

	for (let attempt = 1; attempt <= MAX_SNAPSHOT_WRITE_ATTEMPTS; attempt += 1) {
		const suffix = attempt === 1 ? '' : `-${attempt}`;
		const filename = buildSnapshotFilename(savedAt, suffix);
		const targetPath = join(dir, filename);

		try {
			const snapshot = createIrSnapshot(components, savedAt);
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
 * 最新 snapshot を読み込む（存在しない場合は null）
 */
export async function readLatestSnapshot(): Promise<IrSnapshot | null> {
	const autoSave = getAutoSaveConfig();
	const dir = resolveSnapshotDir(autoSave);
	const filenames = await listSnapshotFilenames(dir);
	const latest = filenames[0];
	if (!latest) {
		return null;
	}

	const yamlText = await readFile(join(dir, latest), 'utf8');
	const snapshot = deserializeIrSnapshot(yamlText);
	return {
		...snapshot,
		components: restoreSnapshotComponents(snapshot.components)
	};
}

/**
 * autoSave が有効な場合のみ最新 snapshot を読み込む
 */
export async function readLatestSnapshotIfEnabled(): Promise<IrSnapshot | null> {
	const config = loadApplicationConfig();
	if (!config.ir?.autoSave?.enabled) {
		return null;
	}
	return readLatestSnapshot();
}
