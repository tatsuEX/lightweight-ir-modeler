/**
 * Intent Tags（UI 要素へ付ける「意図」の宣言）
 *
 * 解釈は writer pipeline が target ごとに行う。target は未知のタグを無視してよい。
 * 本モジュールは Svelte / fs に依存しない純関数とマスタ DTO だけを持つ。
 */

import * as z from 'zod';

/** IR 種類（`application.yml` の `ir.intentTags[].irType`。kebab-case） */
export type IntentTagIrType = string;

/** 今回 Intent Tags を消費する IR 種類 */
export const UI_DEFINITION_INTENT_TAG_IR_TYPE: IntentTagIrType = 'ui-definition';

/** GUI からの新規登録先 alias */
export const DEFAULT_INTENT_TAG_ALIAS = 'default';

/** irType の書式（kebab-case） */
export const INTENT_TAG_IR_TYPE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** alias の書式 */
export const INTENT_TAG_ALIAS_PATTERN = /^[a-z0-9-]+$/;

/**
 * タグ id の書式（`<name>[:<arg>]`）
 *
 * WARN: arg は logicalId の文字集合に `.` と `{}` を足したもの。`{}` はマスタのプレースホルダ用。
 */
export const INTENT_TAG_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(?::[A-Za-z0-9_#.{}-]+)?$/;

/** マスタ id 内で現在の UI 定義の logicalId に展開するプレースホルダ */
export const INTENT_TAG_LOGICAL_ID_PLACEHOLDER = '{logicalId}';

/** プレースホルダに一致させる logicalId の文字集合 */
const LOGICAL_ID_CHARS = '[A-Za-z0-9_#-]+';

/** IR 種類の表示名（警告文用） */
const IR_TYPE_LABELS: Record<string, string> = {
	'ui-definition': 'UI Definition',
	// layout: 'Layout',
	// 'event-action': 'EventAction'
};

/** マスタ 1 ファイルの tags 要素 */
export const IntentTagCatalogEntrySchema = z.object({
	id: z.string().regex(INTENT_TAG_ID_PATTERN, 'intent tag id の書式が不正です'),
	description: z.string().default('')
});

/** マスタ 1 ファイル（IR 種類は持たない。どの IR 種類で使うかは設定が決める） */
export const IntentTagCatalogFileSchema = z.object({
	tags: z.array(IntentTagCatalogEntrySchema)
});

/** マスタ 1 ファイルの形 */
export type IntentTagCatalogFile = z.infer<typeof IntentTagCatalogFileSchema>;

/** 合成後のマスタ 1 件 */
export type IntentTagDefinition = {
	id: string;
	description: string;
	/** 定義元ファイルの alias */
	source: string;
};

/** クライアントへ渡す合成済みマスタ */
export type IntentTagCatalogView = {
	tags: IntentTagDefinition[];
	/** alias `default` へ新規登録できるか */
	canRegister: boolean;
	/** `default` のファイルを共有しているほかの IR 種類 */
	sharedWithIrTypes: IntentTagIrType[];
	/** マスタの読込に失敗したときの理由（GUI に出す） */
	loadError?: string;
};

/**
 * マスタが無いときの空ビュー
 */
export function createEmptyIntentTagCatalogView(loadError?: string): IntentTagCatalogView {
	return {
		tags: [],
		canRegister: false,
		sharedWithIrTypes: [],
		...(loadError ? { loadError } : {})
	};
}

/** 入力候補 1 件 */
export type IntentTagSuggestion = {
	value: string;
	description?: string;
	source?: string;
};

/**
 * タグ id の書式が正しいか判定する
 */
export function isValidIntentTagId(value: string): boolean {
	return INTENT_TAG_ID_PATTERN.test(value);
}

/**
 * タグ一覧を正規化する（trim、空と非文字列の除去、重複除去、順序保持）
 */
export function normalizeIntentTags(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const seen = new Set<string>();
	const result: string[] = [];
	for (const item of value) {
		if (typeof item !== 'string') {
			continue;
		}
		const tag = item.trim();
		if (tag === '' || seen.has(tag)) {
			continue;
		}
		seen.add(tag);
		result.push(tag);
	}
	return result;
}

/**
 * タグを末尾へ追加する。結果が空なら undefined
 */
export function addIntentTags(current: unknown, tags: readonly string[]): string[] | undefined {
	const next = normalizeIntentTags([...normalizeIntentTags(current), ...tags]);
	return next.length > 0 ? next : undefined;
}

/**
 * タグを取り除く。結果が空なら undefined
 */
export function removeIntentTags(current: unknown, tags: readonly string[]): string[] | undefined {
	const removing = new Set(normalizeIntentTags(tags));
	const next = normalizeIntentTags(current).filter((tag) => !removing.has(tag));
	return next.length > 0 ? next : undefined;
}

/**
 * 正規表現の特殊文字をエスケープする
 */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * マスタ id がプレースホルダを含むか判定する
 */
export function isParameterizedIntentTagId(id: string): boolean {
	return id.includes(INTENT_TAG_LOGICAL_ID_PLACEHOLDER);
}

/**
 * 具体タグに対応するマスタ定義を探す（完全一致を優先し、次にプレースホルダ一致）
 */
export function findIntentTagDefinition(
	definitions: readonly IntentTagDefinition[],
	tag: string
): IntentTagDefinition | undefined {
	const exact = definitions.find((definition) => definition.id === tag);
	if (exact) {
		return exact;
	}
	return definitions.find((definition) => {
		if (!isParameterizedIntentTagId(definition.id)) {
			return false;
		}
		const pattern = escapeRegExp(definition.id).replaceAll(
			escapeRegExp(INTENT_TAG_LOGICAL_ID_PLACEHOLDER),
			LOGICAL_ID_CHARS
		);
		return new RegExp(`^${pattern}$`).test(tag);
	});
}

/**
 * マスタから入力候補を作る
 *
 * プレースホルダ付きの定義は logicalIds で展開する。前方一致を先、部分一致を後に並べる。
 */
export function suggestIntentTags(
	definitions: readonly IntentTagDefinition[],
	query: string,
	options: { logicalIds?: readonly string[]; exclude?: readonly string[]; limit?: number } = {}
): IntentTagSuggestion[] {
	const exclude = new Set(options.exclude ?? []);
	const logicalIds = normalizeIntentTags(options.logicalIds ?? []);
	const normalized = query.trim().toLowerCase();
	const candidates: IntentTagSuggestion[] = [];
	const seen = new Set<string>();

	for (const definition of definitions) {
		const values = isParameterizedIntentTagId(definition.id)
			? logicalIds.map((logicalId) =>
					definition.id.replaceAll(INTENT_TAG_LOGICAL_ID_PLACEHOLDER, logicalId)
				)
			: [definition.id];
		for (const value of values) {
			if (seen.has(value) || exclude.has(value)) {
				continue;
			}
			seen.add(value);
			candidates.push({ value, description: definition.description, source: definition.source });
		}
	}

	const prefix: IntentTagSuggestion[] = [];
	const contains: IntentTagSuggestion[] = [];
	for (const candidate of candidates) {
		const lower = candidate.value.toLowerCase();
		if (normalized === '' || lower.startsWith(normalized)) {
			prefix.push(candidate);
		} else if (lower.includes(normalized)) {
			contains.push(candidate);
		}
	}
	return [...prefix, ...contains].slice(0, options.limit ?? 20);
}

/**
 * IR 種類の表示名を返す（未知の値はそのまま）
 */
export function formatIntentTagIrTypeLabel(irType: IntentTagIrType): string {
	return IR_TYPE_LABELS[irType] ?? irType;
}

/**
 * 共有マスタ警告の opt-out キーを組み立てる（共有先の順序に依存しない）
 */
export function sharedWarningKey(
	irType: IntentTagIrType,
	sharedWithIrTypes: readonly IntentTagIrType[]
): string {
	return `${irType}>${[...new Set(sharedWithIrTypes)].sort().join(',')}`;
}
