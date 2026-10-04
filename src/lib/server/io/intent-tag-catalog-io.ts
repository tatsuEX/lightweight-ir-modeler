import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Document, isMap, isScalar, isSeq, Scalar } from 'yaml';
import {
	createEmptyIntentTagCatalogView,
	DEFAULT_INTENT_TAG_ALIAS,
	IntentTagCatalogFileSchema,
	isValidIntentTagId,
	UI_DEFINITION_INTENT_TAG_IR_TYPE,
	type IntentTagCatalogFile,
	type IntentTagCatalogView,
	type IntentTagDefinition,
	type IntentTagIrType
} from '$lib/ir/intent-tags';
import {
	loadApplicationConfig,
	resolveApplicationPath
} from '$lib/server/config/application-config';
import { getLogger, runLogged } from '$lib/server/logging/logger';
import { parseYaml, parseYamlDocument } from '$lib/utils/yaml-document';

const logger = getLogger(import.meta.url);

/**
 * HTTP 向け Intent Tags マスタのエラー
 */
export class IntentTagRequestError extends Error {
	readonly httpStatus: number;

	/**
	 * HTTP ステータス付きのエラーを作る
	 */
	constructor(httpStatus: number, message: string) {
		super(message);
		this.name = 'IntentTagRequestError';
		this.httpStatus = httpStatus;
	}
}

/** 解決済みのマスタファイル */
type ResolvedCatalogFile = {
	alias: string;
	absolutePath: string;
	/** 同一ファイル判定用のキー */
	compareKey: string;
};

/** IR 種類ごとの解決済みマスタ一覧 */
type ResolvedIrTypeCatalog = {
	irType: IntentTagIrType;
	files: ResolvedCatalogFile[];
};

/**
 * 同一ファイル判定用のキーを作る
 *
 * WARN: Windows はパスの大文字小文字を区別しないので小文字に揃える。
 */
function toCompareKey(absolutePath: string): string {
	const normalized = resolve(absolutePath);
	return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * application.yml の ir.intentTags を絶対パスへ解決する
 */
function resolveCatalogConfig(): ResolvedIrTypeCatalog[] {
	const groups = loadApplicationConfig().ir?.intentTags ?? [];
	return groups.map((group) => ({
		irType: group.irType,
		files: group.files.map((file) => {
			const absolutePath = resolveApplicationPath(file.path);
			return { alias: file.alias, absolutePath, compareKey: toCompareKey(absolutePath) };
		})
	}));
}

/**
 * UTF-8 テキストを読む。存在しなければ null
 */
async function readUtf8IfExists(absolutePath: string): Promise<string | null> {
	try {
		return await readFile(absolutePath, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

/**
 * マスタ 1 ファイルを読む。存在しなければ null
 */
async function readCatalogFile(file: ResolvedCatalogFile): Promise<IntentTagCatalogFile | null> {
	const text = await readUtf8IfExists(file.absolutePath);
	if (text === null) {
		return null;
	}
	const parsed = parseYaml(text);
	if (parsed === null || parsed === undefined) {
		return { tags: [] };
	}
	const result = IntentTagCatalogFileSchema.safeParse(parsed);
	if (!result.success) {
		const detail = result.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		throw new Error(`Intent Tags マスタ（${file.alias}）の形式が不正です: ${detail}`);
	}
	return result.data;
}

/**
 * default のファイルを共有しているほかの IR 種類を返す
 */
function findSharedIrTypes(
	groups: readonly ResolvedIrTypeCatalog[],
	irType: IntentTagIrType,
	defaultFile: ResolvedCatalogFile | undefined
): IntentTagIrType[] {
	if (!defaultFile) {
		return [];
	}
	return groups
		.filter(
			(group) =>
				group.irType !== irType &&
				group.files.some((file) => file.compareKey === defaultFile.compareKey)
		)
		.map((group) => group.irType);
}

/**
 * IR 種類のマスタを一覧順に合成して返す
 *
 * 同じ id は先に出たファイルを採用する。存在しないファイルは空として扱う。
 */
export async function readIntentTagCatalog(
	irType: IntentTagIrType = UI_DEFINITION_INTENT_TAG_IR_TYPE
): Promise<IntentTagCatalogView> {
	const groups = resolveCatalogConfig();
	const group = groups.find((item) => item.irType === irType);
	if (!group) {
		return createEmptyIntentTagCatalogView();
	}

	const tags: IntentTagDefinition[] = [];
	const sourceById = new Map<string, string>();
	for (const file of group.files) {
		const data = await readCatalogFile(file);
		if (data === null) {
			// WARN: default は初回登録で作るので、無くても正常
			if (file.alias !== DEFAULT_INTENT_TAG_ALIAS) {
				logger.warn('intent tag master not found', { irType, alias: file.alias });
			}
			continue;
		}
		for (const entry of data.tags) {
			const existing = sourceById.get(entry.id);
			if (existing !== undefined) {
				logger.warn('intent tag id duplicated; keeping the earlier file', {
					irType,
					id: entry.id,
					kept: existing,
					dropped: file.alias
				});
				continue;
			}
			sourceById.set(entry.id, file.alias);
			tags.push({ id: entry.id, description: entry.description, source: file.alias });
		}
	}

	const defaultFile = group.files.find((file) => file.alias === DEFAULT_INTENT_TAG_ALIAS);
	return {
		tags,
		canRegister: defaultFile !== undefined,
		sharedWithIrTypes: findSharedIrTypes(groups, irType, defaultFile)
	};
}

/**
 * 一時ファイル経由でテキストを書き込む
 */
async function writeFileAtomic(filePath: string, text: string): Promise<void> {
	const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
	try {
		await writeFile(tempPath, text, { encoding: 'utf8', flag: 'wx' });
		await rename(tempPath, filePath);
	} catch (error) {
		await unlink(tempPath).catch(() => undefined);
		throw error;
	}
}

/**
 * マスタ YAML の tags 末尾へ 1 件追記した文字列を返す（既存コメントと順序は保つ）
 */
function appendTagToYaml(text: string | null, id: string, description: string, alias: string): string {
	let doc: Document = text === null ? new Document({ tags: [] }) : parseYamlDocument(text);
	if (doc.errors.length > 0) {
		throw new Error(`Intent Tags マスタ（${alias}）の YAML を解釈できません: ${doc.errors[0].message}`);
	}
	if (doc.contents === null) {
		// WARN: コメントだけのファイルは中身を作り直す。先頭コメントだけ引き継ぐ。
		const fresh = new Document({ tags: [] });
		fresh.commentBefore = doc.commentBefore;
		doc = fresh;
	}
	if (!isMap(doc.contents)) {
		throw new Error(`Intent Tags マスタ（${alias}）のルートが mapping ではありません`);
	}
	if (!doc.has('tags')) {
		doc.set('tags', doc.createNode([]));
	}
	const tagsNode = doc.get('tags', true);
	if (!isSeq(tagsNode)) {
		throw new Error(`Intent Tags マスタ（${alias}）の tags が配列ではありません`);
	}

	const entry = doc.createNode({ id, description });
	if (isMap(entry)) {
		const idNode = entry.get('id', true);
		if (isScalar(idNode)) {
			idNode.type = Scalar.QUOTE_SINGLE;
		}
		const descriptionNode = entry.get('description', true);
		if (isScalar(descriptionNode) && description.includes('\n')) {
			descriptionNode.type = Scalar.BLOCK_LITERAL;
		}
	}
	tagsNode.items.push(entry);
	return doc.toString({ lineWidth: 0 });
}

/**
 * IR 種類の default マスタへタグを新規登録する
 */
export async function registerIntentTag(
	irType: IntentTagIrType,
	input: { id: string; description: string }
): Promise<{ definition: IntentTagDefinition; sharedWithIrTypes: IntentTagIrType[] }> {
	return runLogged(logger, 'registerIntentTag', { irType, id: input.id }, async () => {
		const id = input.id.trim();
		const description = input.description.trim();
		if (!isValidIntentTagId(id)) {
			throw new IntentTagRequestError(400, `intent tag id の書式が不正です: ${id}`);
		}

		const groups = resolveCatalogConfig();
		const group = groups.find((item) => item.irType === irType);
		const defaultFile = group?.files.find((file) => file.alias === DEFAULT_INTENT_TAG_ALIAS);
		if (!group || !defaultFile) {
			throw new IntentTagRequestError(
				503,
				`登録先マスタ（${DEFAULT_INTENT_TAG_ALIAS}）が ir.intentTags の ${irType} に設定されていません`
			);
		}

		const catalog = await readIntentTagCatalog(irType);
		const duplicate = catalog.tags.find((tag) => tag.id === id);
		if (duplicate) {
			throw new IntentTagRequestError(409, `intent tag は登録済みです: ${id}（${duplicate.source}）`);
		}

		const text = await readUtf8IfExists(defaultFile.absolutePath);
		const nextText = appendTagToYaml(text, id, description, defaultFile.alias);
		await mkdir(dirname(defaultFile.absolutePath), { recursive: true });
		await writeFileAtomic(defaultFile.absolutePath, nextText);

		return {
			definition: { id, description, source: defaultFile.alias },
			sharedWithIrTypes: findSharedIrTypes(groups, irType, defaultFile)
		};
	});
}
