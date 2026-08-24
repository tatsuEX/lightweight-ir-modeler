import { Document, isScalar, parse, parseDocument, type Pair } from 'yaml';
import { compareObjectKeys } from '$lib/utils/object-key-sort';

/**
 * YAML Pair のキーを比較用文字列にする
 */
export function yamlPairKey(pair: Pair): string {
	const key = pair.key;

	if (isScalar(key)) {
		return String(key.value ?? '');
	}

	if (typeof key === 'string' || typeof key === 'number' || typeof key === 'boolean') {
		return String(key);
	}

	return String(key);
}

/**
 * preferredKeys 付きの YAML Map エントリ比較関数を作る
 */
export function createYamlSortMapEntries(
	preferredKeys: readonly string[] = []
): (a: Pair, b: Pair) => number {
	return (left, right) => compareObjectKeys(yamlPairKey(left), yamlPairKey(right), preferredKeys);
}

/**
 * JS 値からコメント付与可能な YAML Document を作る
 *
 * WARN: キー順は stringify 時の sortMapEntries に任せる。Pair の comment は並び替え後も残る。
 */
export function createYamlDocument(
	value: unknown,
	preferredKeys: readonly string[] = []
): Document {
	return new Document(value, {
		sortMapEntries: createYamlSortMapEntries(preferredKeys)
	});
}

/**
 * YAML Document を文字列化する（折り返し無効）
 */
export function stringifyYamlDocument(doc: Document, lineWidth = 0): string {
	return doc.toString({ lineWidth });
}

/**
 * JS 値をキーソート済み YAML 文字列にする
 */
export function stringifyYaml(value: unknown, preferredKeys: readonly string[] = []): string {
	return stringifyYamlDocument(createYamlDocument(value, preferredKeys));
}

/**
 * YAML 文字列を JS 値へパースする
 */
export function parseYaml(yamlText: string): unknown {
	return parse(yamlText);
}

/**
 * YAML 文字列をコメント保持可能な Document にする
 */
export function parseYamlDocument(yamlText: string): Document {
	return parseDocument(yamlText);
}
