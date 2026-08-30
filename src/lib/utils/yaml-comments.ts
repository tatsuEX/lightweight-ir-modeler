import { isMap, isNode, isPair, isSeq, type Document, type Pair, type YAMLMap } from 'yaml';
import {
	parseYamlKeyPath,
	stringifyYamlKeyPath,
	type YamlPathSegment
} from '$lib/ir/snapshot-comment-path';
import { yamlPairKey } from '$lib/utils/yaml-document';

/** YAML パス → コメント本文（Markdown）。空文字は「コメントなし」 */
export type YamlCommentMap = Record<string, string>;

/**
 * YAML commentBefore 用に各行へ先頭スペースを付ける
 *
 * WARN: eemeli/yaml は `#` の直後に本文をそのまま出す。スペース無しだと `#heading` になる。
 */
export function toYamlCommentBefore(text: string): string {
	const normalized = text.replaceAll('\r\n', '\n').replace(/\s+$/u, '');
	if (normalized === '') {
		return '';
	}

	return normalized
		.split('\n')
		.map((line) => (line.startsWith(' ') ? line : ` ${line}`))
		.join('\n');
}

/**
 * YAML commentBefore から Markdown 本文を取り出す
 */
export function fromYamlCommentBefore(raw: string | null | undefined): string {
	if (raw == null || raw === '') {
		return '';
	}

	return raw
		.replaceAll('\r\n', '\n')
		.split('\n')
		.map((line) => (line.startsWith(' ') ? line.slice(1) : line))
		.join('\n')
		.replace(/\s+$/u, '');
}

/**
 * コメント本文を正規化する（空なら null）
 */
export function normalizeCommentText(text: string): string | null {
	const trimmed = text.replaceAll('\r\n', '\n').replace(/^\s+$/u, '').replace(/\s+$/u, '');
	if (trimmed.trim() === '') {
		return null;
	}
	return trimmed;
}

/**
 * Map Pair のコメントはキー Scalar に載る（Pair 自身には commentBefore が無い）
 */
function pairKeyNode(pair: Pair): { commentBefore?: string | null } | null {
	return isNode(pair.key) ? pair.key : null;
}

/**
 * Map からキー名の Pair を探す
 */
function findPair(map: YAMLMap, key: string): Pair | undefined {
	return map.items.find((item) => isPair(item) && yamlPairKey(item) === key);
}

/**
 * パス先頭からノードを辿る
 */
function resolveCommentTarget(
	doc: Document,
	segments: readonly YamlPathSegment[]
): { kind: 'pair'; pair: Pair } | { kind: 'node'; node: { commentBefore: string | null | undefined } } | null {
	let current: unknown = doc.contents;

	for (let index = 0; index < segments.length; index += 1) {
		const segment = segments[index];
		const isLast = index === segments.length - 1;

		if (segment.type === 'key') {
			if (!isMap(current)) {
				return null;
			}
			const pair = findPair(current, segment.key);
			if (!pair) {
				return null;
			}
			if (isLast) {
				return { kind: 'pair', pair };
			}
			current = pair.value;
			continue;
		}

		if (!isSeq(current)) {
			return null;
		}
		const item = current.items[segment.index];
		if (item === undefined) {
			return null;
		}
		if (isLast) {
			if (!isNode(item)) {
				return null;
			}
			return { kind: 'node', node: item };
		}
		current = item;
	}

	return null;
}

/**
 * Document から commentBefore をパス付きで収集する
 */
export function extractYamlComments(doc: Document): YamlCommentMap {
	const comments: YamlCommentMap = {};
	walkCommentable(doc.contents, [], comments, false);
	return comments;
}

/**
 * パスへコメントを載せる
 */
function assignComment(
	comments: YamlCommentMap,
	path: readonly YamlPathSegment[],
	text: string,
	overwrite: boolean
): void {
	if (text === '') {
		return;
	}
	const key = stringifyYamlKeyPath(path);
	if (overwrite || comments[key] === undefined) {
		comments[key] = text;
	}
}

/**
 * Map / Seq を再帰して commentBefore を集める
 *
 * WARN: eemeli/yaml は「親キーの直後・先頭子の直前」の `#` を先頭 Pair/Item ではなく
 * コレクション自身の commentBefore に載せる。Seq 要素として歩いている Map は除外する。
 */
function walkCommentable(
	node: unknown,
	path: YamlPathSegment[],
	comments: YamlCommentMap,
	asSeqItem: boolean
): void {
	if (isMap(node)) {
		if (!asSeqItem) {
			const firstPair = node.items.find((item) => isPair(item));
			if (firstPair) {
				assignComment(
					comments,
					[...path, { type: 'key', key: yamlPairKey(firstPair) }],
					fromYamlCommentBefore(node.commentBefore),
					false
				);
			}
		}
		for (const pair of node.items) {
			if (!isPair(pair)) {
				continue;
			}
			const nextPath = [...path, { type: 'key' as const, key: yamlPairKey(pair) }];
			assignComment(comments, nextPath, fromYamlCommentBefore(pairKeyNode(pair)?.commentBefore), true);
			walkCommentable(pair.value, nextPath, comments, false);
		}
		return;
	}

	if (isSeq(node)) {
		if (node.items.length > 0) {
			assignComment(
				comments,
				[...path, { type: 'index', index: 0 }],
				fromYamlCommentBefore(node.commentBefore),
				false
			);
		}
		node.items.forEach((item, index) => {
			const nextPath = [...path, { type: 'index' as const, index }];
			if (isNode(item)) {
				assignComment(comments, nextPath, fromYamlCommentBefore(item.commentBefore), true);
			}
			walkCommentable(item, nextPath, comments, true);
		});
	}
}

/**
 * パスマップのコメントを Document へ載せる（ノードが無いパスは無視する）
 */
export function attachYamlComments(doc: Document, comments: YamlCommentMap): void {
	const entries = Object.entries(comments).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

	for (const [path, text] of entries) {
		const normalized = normalizeCommentText(text);
		if (normalized == null) {
			continue;
		}

		let segments: YamlPathSegment[];
		try {
			segments = parseYamlKeyPath(path);
		} catch {
			continue;
		}

		const target = resolveCommentTarget(doc, segments);
		if (!target) {
			continue;
		}

		const body = toYamlCommentBefore(normalized);
		if (target.kind === 'pair') {
			const keyNode = pairKeyNode(target.pair);
			if (!keyNode) {
				continue;
			}
			keyNode.commentBefore = body;
		} else {
			target.node.commentBefore = body;
		}
	}
}

/**
 * 比較用にコメントマップを正規化する
 */
export function normalizeCommentsForCompare(comments: YamlCommentMap): string {
	const normalized: YamlCommentMap = {};
	const keys = Object.keys(comments).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

	for (const key of keys) {
		const text = normalizeCommentText(comments[key] ?? '');
		if (text != null) {
			normalized[key] = text;
		}
	}

	return JSON.stringify(normalized);
}

/**
 * API / JSON からコメントマップを取り出す（未指定は空）
 */
export function parseYamlCommentMap(value: unknown): YamlCommentMap {
	if (value === undefined) {
		return {};
	}

	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('comments must be a mapping of path to string');
	}

	const result: YamlCommentMap = {};

	// comment対象のパスをループして、コメント本文を取り出す
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		if (typeof item !== 'string') {
			continue;
		}
		// コメント本文を正規化する
		const normalized = normalizeCommentText(item);
		// 正規化されたコメント本文をマップに追加する
		if (normalized != null) {
			result[key] = normalized;
		}
	}

	return result;
}
