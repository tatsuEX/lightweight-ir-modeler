import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Dirent } from 'node:fs';
import {
	createIrSnapshot,
	deserializeIrSnapshotDocument,
	normalizeSnapshotForCompare,
	restoreSnapshotComponents,
	serializeIrSnapshot,
	type IrSnapshot
} from '$lib/ir/snapshot';
import { normalizeCommentsForCompare, type YamlCommentMap } from '$lib/utils/yaml-comments';
import {
	assertSafeLogicalIdPathSegment,
	buildPublishedSnapshotMeta,
	buildSnapshotMetaForWrite,
	createEmptyUiDefinitionMeta,
	toEditorMeta,
	type UiDefinitionEditorMeta,
	type UiDefinitionSnapshotMeta
} from '$lib/ir/ui-definition-meta';
import {
	assertSafeVersionPathSegment,
	findHeadVersion,
	isValidSnapshotVersion,
	needsPublishKindChoice,
	resolveNextPublishedVersion,
	selectablePublishedVersions,
	sortSnapshotVersionStrings,
	type PublishKind
} from '$lib/ir/snapshot-version';
import {
	loadApplicationConfig,
	resolveApplicationPath,
	type IrAutoSaveConfig
} from '$lib/server/config/application-config';
import { getLogger, runLogged } from '$lib/server/logging/logger';

const logger = getLogger(import.meta.url);

const SNAPSHOT_PREFIX = 'ir-snapshot-';
const SNAPSHOT_SUFFIX = '.yml';
const CURRENT_DIR_NAME = 'current';
const HISTORY_DIR_NAME = 'history';
const VERSIONS_DIR_NAME = 'versions';
const CURRENT_FILENAME = 'snapshot.yml';
/** logicalId ディレクトリからの相対パス（API 応答用。区切りは `/`） */
const CURRENT_RELATIVE_PATH = `${CURRENT_DIR_NAME}/${CURRENT_FILENAME}`;
/** ファイル名衝突時の最大試行回数（無 suffix 1 回 + suffix 付き） */
const MAX_SNAPSHOT_WRITE_ATTEMPTS = 100;

/**
 * snapshot ディレクトリの構造（値は絶対パス）
 */
type SnapshotTree = {
	current?: string;
	history?: string;
	versions?: string[];
};

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
 * 編集中 snapshot ファイルの絶対パスを解決する
 */
function resolveCurrentFile(logicalIdDir: string): string {
	return join(logicalIdDir, CURRENT_DIR_NAME, CURRENT_FILENAME);
}

/**
 * 変更履歴ディレクトリの絶対パスを解決する
 */
function resolveHistoryDir(logicalIdDir: string): string {
	return join(logicalIdDir, HISTORY_DIR_NAME);
}

/**
 * ENOENT かどうか判定する
 */
function isEnoent(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/**
 * ファイルを UTF-8 で読む（無ければ null）
 */
async function readUtf8IfExists(filePath: string): Promise<string | null> {
	try {
		return await readFile(filePath, 'utf8');
	} catch (error) {
		if (isEnoent(error)) {
			return null;
		}

		throw error;
	}
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
 * snapshot ディレクトリの構造を取得する
 */
export async function listSnapshotDirectories(dir: string): Promise<SnapshotTree> {
	const tree: SnapshotTree = {};
	let entries: Dirent[];

	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (error) {
		if (isEnoent(error)) {
			return {};
		}

		throw error;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		if (entry.name === CURRENT_DIR_NAME) {
			tree.current = join(dir, entry.name);
		} else if (entry.name === HISTORY_DIR_NAME) {
			tree.history = join(dir, entry.name);
		} else if (entry.name === VERSIONS_DIR_NAME) {
			const versionsDir = await readdir(join(dir, entry.name), { withFileTypes: true });
			tree.versions = versionsDir
				.filter((innerEntry) => innerEntry.isDirectory())
				.map((innerEntry) => join(dir, entry.name, innerEntry.name))
				.sort((a, b) => a.localeCompare(b));
		}
	}

	return tree;
}

/**
 * dir 内の snapshot ファイル名を新しい順に列挙する
 */
export async function listSnapshotFilenames(dir: string): Promise<string[]> {
	let entries: string[];

	try {
		entries = await readdir(dir);
	} catch (error) {
		if (isEnoent(error)) {
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
		if (isEnoent(error)) {
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
 * current が無ければ旧レイアウト（logicalId 直下の ir-snapshot-*.yml）の YAML を返す
 *
 * WARN: 比較 skip には使わない。current が無いときは必ず新レイアウトへ書く。
 */
async function readCurrentOrLegacyYaml(logicalIdDir: string): Promise<string | null> {
	const currentYaml = await readUtf8IfExists(resolveCurrentFile(logicalIdDir));
	if (currentYaml !== null) {
		return currentYaml;
	}

	const legacyName = (await listSnapshotFilenames(logicalIdDir))[0];
	if (!legacyName) {
		return null;
	}

	return readUtf8IfExists(join(logicalIdDir, legacyName));
}

/**
 * ディスクから復元した IR snapshot（コメント map 付き）
 */
export type LoadedIrSnapshot = IrSnapshot & {
	comments: YamlCommentMap;
};

/**
 * YAML テキストから読込結果を組み立てる
 */
function toLoadedIrSnapshot(logicalId: string, yamlText: string): LoadedIrSnapshot {
	const { snapshot, comments } = deserializeIrSnapshotDocument(yamlText);
	const editorDefaults = createEmptyUiDefinitionMeta();

	return {
		...snapshot,
		uiDefinition: snapshot.uiDefinition ?? {
			...editorDefaults,
			logicalId: assertSafeLogicalIdPathSegment(logicalId),
			createdAt: snapshot.savedAt,
			modifiedAt: snapshot.savedAt
		},
		components: restoreSnapshotComponents(snapshot.components),
		comments
	};
}

/**
 * 永続化済み snapshot の uiDefinition メタデータを取得する
 */
async function readPersistedSnapshotMeta(logicalIdDir: string): Promise<UiDefinitionSnapshotMeta | null> {
	const yamlText = await readCurrentOrLegacyYaml(logicalIdDir);
	if (yamlText === null) {
		return null;
	}

	const { snapshot } = deserializeIrSnapshotDocument(yamlText);

	return snapshot.uiDefinition ?? null;
}

/**
 * current の内容と同一か判定する（current が無ければ false）
 */
async function isSameAsCurrentSnapshot(
	logicalIdDir: string,
	editorMeta: UiDefinitionEditorMeta,
	components: unknown[],
	comments: YamlCommentMap
): Promise<boolean> {
	const yamlText = await readUtf8IfExists(resolveCurrentFile(logicalIdDir));
	if (yamlText === null) {
		return false;
	}

	const loaded = deserializeIrSnapshotDocument(yamlText);
	const snapshotEditorMeta = loaded.snapshot.uiDefinition
		? toEditorMeta(loaded.snapshot.uiDefinition)
		: editorMeta;

	return (
		normalizeSnapshotForCompare(snapshotEditorMeta, loaded.snapshot.components) ===
			normalizeSnapshotForCompare(editorMeta, components) &&
		normalizeCommentsForCompare(loaded.comments) === normalizeCommentsForCompare(comments)
	);
}

/**
 * components を logicalId 別ディレクトリへ YAML snapshot として書き込む
 */
export async function writeSnapshot(
	editorMeta: UiDefinitionEditorMeta,
	components: unknown[],
	comments: YamlCommentMap = {}
): Promise<{ filename: string; savedAt: string; skipped: boolean }> {
	return runLogged(
		logger,
		'writeSnapshot',
		{ logicalId: editorMeta.logicalId, componentCount: components.length },
		() => writeSnapshotUnchecked(editorMeta, components, comments)
	);
}

/**
 * current を上書きし、同じ内容を history へ追加する（ログなし本体）
 */
async function writeSnapshotUnchecked(
	editorMeta: UiDefinitionEditorMeta,
	components: unknown[],
	comments: YamlCommentMap
): Promise<{ filename: string; savedAt: string; skipped: boolean }> {
	const autoSave = getAutoSaveConfig();
	const logicalIdDir = resolveSnapshotDirForLogicalId(autoSave, editorMeta.logicalId);
	const currentDir = join(logicalIdDir, CURRENT_DIR_NAME);
	const historyDir = resolveHistoryDir(logicalIdDir);
	const currentFile = resolveCurrentFile(logicalIdDir);

	await mkdir(currentDir, { recursive: true });
	await mkdir(historyDir, { recursive: true });

	if (await isSameAsCurrentSnapshot(logicalIdDir, editorMeta, components, comments)) {
		const yamlText = await readFile(currentFile, 'utf8');
		const { snapshot } = deserializeIrSnapshotDocument(yamlText);

		return { filename: CURRENT_RELATIVE_PATH, savedAt: snapshot.savedAt, skipped: true };
	}

	const savedAt = new Date();
	const previousMeta = await readPersistedSnapshotMeta(logicalIdDir);
	const uiDefinition = buildSnapshotMetaForWrite(editorMeta, previousMeta, savedAt);
	const snapshot = createIrSnapshot(uiDefinition, components, savedAt);
	const yamlText = serializeIrSnapshot(snapshot, comments);

	await writeFile(currentFile, yamlText, { encoding: 'utf8' });

	for (let attempt = 1; attempt <= MAX_SNAPSHOT_WRITE_ATTEMPTS; attempt += 1) {
		const suffix = attempt === 1 ? '' : `-${attempt}`;
		const filename = buildSnapshotFilename(savedAt, suffix);
		const historyPath = join(historyDir, filename);

		try {
			await writeFile(historyPath, yamlText, {
				encoding: 'utf8',
				flag: 'wx'
			});
			await pruneSnapshots(historyDir, autoSave.maxGenerations);

			return { filename: CURRENT_RELATIVE_PATH, savedAt: snapshot.savedAt, skipped: false };
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
 * logicalId 別ディレクトリから編集中 snapshot を読み込む（存在しない場合は null）
 */
export async function readLatestSnapshot(logicalId: string): Promise<LoadedIrSnapshot | null> {
	const autoSave = getAutoSaveConfig();
	const logicalIdDir = resolveSnapshotDirForLogicalId(autoSave, logicalId);
	const yamlText = await readCurrentOrLegacyYaml(logicalIdDir);

	if (yamlText === null) {
		return null;
	}

	return toLoadedIrSnapshot(logicalId, yamlText);
}

/**
 * autoSave が有効な場合のみ logicalId 別ディレクトリから編集中 snapshot を読み込む
 */
export async function readLatestSnapshotIfEnabled(logicalId: string): Promise<LoadedIrSnapshot | null> {
	return runLogged(logger, 'readLatestSnapshotIfEnabled', { logicalId }, async () => {
		const config = loadApplicationConfig();

		if (!config.ir?.autoSave?.enabled) {
			return null;
		}

		return readLatestSnapshot(logicalId);
	});
}

/**
 * snapshot IO の呼び出し側エラー（HTTP ステータスを持つ）
 */
export class IrSnapshotRequestError extends Error {
	readonly httpStatus: number;

	/**
	 * HTTP 向け snapshot エラーを作る
	 */
	constructor(httpStatus: number, message: string) {
		super(message);
		this.name = 'IrSnapshotRequestError';
		this.httpStatus = httpStatus;
	}
}

/**
 * 確定版ディレクトリの絶対パスを解決する
 */
function resolveVersionDir(logicalIdDir: string, version: string): string {
	return join(logicalIdDir, VERSIONS_DIR_NAME, assertSafeVersionPathSegment(version));
}

/**
 * 確定版 snapshot ファイルの絶対パスを解決する
 */
function resolveVersionFile(logicalIdDir: string, version: string): string {
	return join(resolveVersionDir(logicalIdDir, version), CURRENT_FILENAME);
}

/**
 * history 配下の snapshot ファイルをすべて削除する
 */
async function clearHistoryDir(historyDir: string): Promise<void> {
	const filenames = await listSnapshotFilenames(historyDir);
	for (const filename of filenames) {
		await unlink(join(historyDir, filename));
	}
}

/**
 * 確定済み version ディレクトリ名を列挙する
 */
export async function listPublishedVersionIds(logicalId: string): Promise<string[]> {
	const autoSave = getAutoSaveConfig();
	const logicalIdDir = resolveSnapshotDirForLogicalId(autoSave, logicalId);
	const versionsDir = join(logicalIdDir, VERSIONS_DIR_NAME);
	let entries: Dirent[];

	try {
		entries = await readdir(versionsDir, { withFileTypes: true });
	} catch (error) {
		if (isEnoent(error)) {
			return [];
		}

		throw error;
	}

	return sortSnapshotVersionStrings(
		entries.filter((entry) => entry.isDirectory() && isValidSnapshotVersion(entry.name)).map((entry) => entry.name)
	);
}

/**
 * 確定版の一覧・HEAD・選択候補を返す
 */
export async function listPublishedVersions(logicalId: string): Promise<{
	versions: string[];
	head: string | null;
	selectable: string[];
}> {
	const versions = await listPublishedVersionIds(logicalId);

	return {
		versions,
		head: findHeadVersion(versions),
		selectable: selectablePublishedVersions(versions)
	};
}

/**
 * current を確定版として versions/ へ複製する
 */
export async function publishSnapshot(
	logicalId: string,
	kind: PublishKind = 'revision'
): Promise<{ version: string; snapshot: LoadedIrSnapshot }> {
	return runLogged(logger, 'publishSnapshot', { logicalId, kind }, () =>
		publishSnapshotUnchecked(logicalId, kind)
	);
}

/**
 * current を確定版として versions/ へ複製する（ログなし本体）
 */
async function publishSnapshotUnchecked(
	logicalId: string,
	kind: PublishKind
): Promise<{ version: string; snapshot: LoadedIrSnapshot }> {
	const autoSave = getAutoSaveConfig();
	const logicalIdDir = resolveSnapshotDirForLogicalId(autoSave, logicalId);
	const yamlText = await readCurrentOrLegacyYaml(logicalIdDir);
	if (yamlText === null) {
		throw new IrSnapshotRequestError(404, 'current snapshot not found');
	}

	const loaded = toLoadedIrSnapshot(logicalId, yamlText);
	const editorMeta = loaded.uiDefinition
		? toEditorMeta(loaded.uiDefinition)
		: { ...createEmptyUiDefinitionMeta(), logicalId };
	const existing = await listPublishedVersionIds(logicalId);
	const choiceNeeded = needsPublishKindChoice(existing, editorMeta.basedOn);

	if (choiceNeeded && kind === 'revision') {
		throw new IrSnapshotRequestError(400, 'publish from a past version requires mode patch or new-head');
	}
	if (!choiceNeeded && kind !== 'revision') {
		throw new IrSnapshotRequestError(400, 'mode patch and new-head are only allowed when basedOn is older than HEAD');
	}

	let nextVersion: string;
	try {
		nextVersion = resolveNextPublishedVersion(existing, editorMeta.basedOn, kind);
	} catch (error) {
		throw new IrSnapshotRequestError(400, error instanceof Error ? error.message : String(error));
	}

	const savedAt = new Date();
	const publishedMeta = buildPublishedSnapshotMeta(editorMeta, nextVersion, savedAt);
	const published = createIrSnapshot(publishedMeta, loaded.components, savedAt);
	const publishedYaml = serializeIrSnapshot(published, loaded.comments);
	const versionDir = resolveVersionDir(logicalIdDir, nextVersion);
	const versionFile = resolveVersionFile(logicalIdDir, nextVersion);

	await mkdir(versionDir, { recursive: true });

	try {
		await writeFile(versionFile, publishedYaml, { encoding: 'utf8', flag: 'wx' });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new IrSnapshotRequestError(409, `published version already exists: ${nextVersion}`);
		}

		throw error;
	}

	const currentDir = join(logicalIdDir, CURRENT_DIR_NAME);
	await mkdir(currentDir, { recursive: true });
	const currentEditor = toEditorMeta({
		...editorMeta,
		version: nextVersion,
		basedOn: kind === 'patch' ? editorMeta.basedOn : undefined
	});
	const currentMeta = buildSnapshotMetaForWrite(currentEditor, loaded.uiDefinition, savedAt);
	const currentSnapshot = createIrSnapshot(currentMeta, loaded.components, savedAt);
	const currentYaml = serializeIrSnapshot(currentSnapshot, loaded.comments);
	await writeFile(resolveCurrentFile(logicalIdDir), currentYaml, { encoding: 'utf8' });

	return { version: nextVersion, snapshot: toLoadedIrSnapshot(logicalId, currentYaml) };
}

/**
 * 確定版を current へ載せ、history をクリアする
 */
export async function loadPublishedVersion(
	logicalId: string,
	version: string
): Promise<LoadedIrSnapshot> {
	return runLogged(logger, 'loadPublishedVersion', { logicalId, version }, () =>
		loadPublishedVersionUnchecked(logicalId, version)
	);
}

/**
 * 確定版を current へ載せ、history をクリアする（ログなし本体）
 */
async function loadPublishedVersionUnchecked(
	logicalId: string,
	version: string
): Promise<LoadedIrSnapshot> {
	const safeVersion = version.trim();
	if (!isValidSnapshotVersion(safeVersion)) {
		throw new IrSnapshotRequestError(400, `invalid snapshot version: ${version}`);
	}

	const autoSave = getAutoSaveConfig();
	const logicalIdDir = resolveSnapshotDirForLogicalId(autoSave, logicalId);
	const existing = await listPublishedVersionIds(logicalId);
	const selectable = selectablePublishedVersions(existing);
	if (!selectable.includes(safeVersion)) {
		throw new IrSnapshotRequestError(400, `version is not selectable: ${safeVersion}`);
	}

	const yamlText = await readUtf8IfExists(resolveVersionFile(logicalIdDir, safeVersion));
	if (yamlText === null) {
		throw new IrSnapshotRequestError(404, `published version not found: ${safeVersion}`);
	}

	const loaded = toLoadedIrSnapshot(logicalId, yamlText);
	const now = new Date();
	const editorMeta: UiDefinitionEditorMeta = {
		...(loaded.uiDefinition ? toEditorMeta(loaded.uiDefinition) : createEmptyUiDefinitionMeta()),
		logicalId: assertSafeLogicalIdPathSegment(logicalId),
		version: safeVersion,
		basedOn: safeVersion
	};
	const currentMeta = buildSnapshotMetaForWrite(editorMeta, null, now);
	const currentSnapshot = createIrSnapshot(currentMeta, loaded.components, now);
	const currentYaml = serializeIrSnapshot(currentSnapshot, loaded.comments);

	const currentDir = join(logicalIdDir, CURRENT_DIR_NAME);
	const historyDir = resolveHistoryDir(logicalIdDir);
	await mkdir(currentDir, { recursive: true });
	await mkdir(historyDir, { recursive: true });
	await clearHistoryDir(historyDir);
	await writeFile(resolveCurrentFile(logicalIdDir), currentYaml, { encoding: 'utf8' });

	return toLoadedIrSnapshot(logicalId, currentYaml);
}
