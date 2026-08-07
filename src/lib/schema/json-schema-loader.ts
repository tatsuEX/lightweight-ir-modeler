import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import * as z from 'zod';
import { ensureZodLocaleJa } from '$lib/schema/zod-locale';

/**
 * targetId → スキーマファイル名（ホワイトリスト。path traversal 防止）
 */
const RAW_SCHEMA_FILENAMES: Record<string, string> = {
	primefaces: 'primefaces.schema.json',
	'im-forma': 'im-forma.schema.json'
};

const compiledSchemaCache = new Map<string, z.ZodType>();

/**
 * 相対パスを process.cwd() 基準の絶対パスへ解決する
 * WARN: schema 層は server/config に依存しない（SvelteKit private env を引かない）
 */
function resolveProjectPath(configPath: string): string {
	if (isAbsolute(configPath)) {
		return configPath;
	}
	return resolve(process.cwd(), configPath);
}

/**
 * Raw JSON Schema ディレクトリを解決する
 */
export function resolveRawSchemaDir(): string {
	return resolveProjectPath('./schemas/raw');
}

/**
 * target に対応する JSON Schema ファイル絶対パスを返す
 */
export function resolveRawSchemaFilePath(targetId: string): string {
	const filename = RAW_SCHEMA_FILENAMES[targetId];
	if (!filename) {
		throw new Error(`no JSON Schema registered for target: ${targetId}`);
	}

	return join(resolveRawSchemaDir(), filename);
}

/**
 * JSON Schema オブジェクトをファイルから読み込む
 */
export function readRawJsonSchema(targetId: string): Record<string, unknown> {
	const absolutePath = resolveRawSchemaFilePath(targetId);
	const text = readFileSync(absolutePath, 'utf8');
	const parsed: unknown = JSON.parse(text);

	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`raw JSON Schema must be an object: ${absolutePath}`);
	}

	return parsed as Record<string, unknown>;
}

/**
 * target 初回アクセス時に JSON Schema を読み込み Zod へ変換してキャッシュする
 */
export function getRawZodSchema(targetId: string): z.ZodType {
	const cached = compiledSchemaCache.get(targetId);
	if (cached) {
		return cached;
	}

	ensureZodLocaleJa();
	const jsonSchema = readRawJsonSchema(targetId);
	const compiled = z.fromJSONSchema(jsonSchema);
	compiledSchemaCache.set(targetId, compiled);
	return compiled;
}

/**
 * キャッシュ済み Zod schema を破棄する（将来の再読込 UI / テスト用）
 */
export function invalidateRawZodSchema(targetId?: string): void {
	if (targetId) {
		compiledSchemaCache.delete(targetId);
		return;
	}

	compiledSchemaCache.clear();
}

/**
 * 登録済み schema targetId 一覧を返す
 */
export function listRawSchemaTargetIds(): string[] {
	return Object.keys(RAW_SCHEMA_FILENAMES);
}

/**
 * テスト用: キャッシュ hit 判定
 */
export function hasCachedRawZodSchema(targetId: string): boolean {
	return compiledSchemaCache.has(targetId);
}
