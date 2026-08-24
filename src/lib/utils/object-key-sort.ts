/**
 * YAML / JSON オブジェクトで常に先頭へ置くシステムメタキー
 */
export const SYSTEM_META_OBJECT_KEYS = ['version', 'createdAt', 'modifiedAt', 'savedAt'] as const;

const SYSTEM_META_OBJECT_KEY_SET: ReadonlySet<string> = new Set(SYSTEM_META_OBJECT_KEYS);

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/**
 * preferredKeys の直前にシステムメタキーを連結する（重複は除去）
 */
export function mergePreferredObjectKeys(preferredKeys: readonly string[] = []): readonly string[] {
	const extra: string[] = [];

	for (const key of preferredKeys) {
		if (SYSTEM_META_OBJECT_KEY_SET.has(key)) {
			continue;
		}
		extra.push(key);
	}

	return [...SYSTEM_META_OBJECT_KEYS, ...extra];
}

/**
 * キーを ASCII（UTF-16 符号単位）順で比較する
 */
export function compareAsciiKeys(a: string, b: string): number {
	if (a === b) {
		return 0;
	}

	return a < b ? -1 : 1;
}

/**
 * オブジェクトキーを比較する
 *
 * 1. システムメタキー（version / createdAt / modifiedAt / savedAt）を固定順で先に置く
 * 2. 続けて preferredKeys の指定順
 * 3. 残りは ASCII 順
 */
export function compareObjectKeys(a: string, b: string, preferredKeys: readonly string[] = []): number {
	const ordered = mergePreferredObjectKeys(preferredKeys);
	const indexA = ordered.indexOf(a);
	const indexB = ordered.indexOf(b);
	const rankA = indexA === -1 ? Number.POSITIVE_INFINITY : indexA;
	const rankB = indexB === -1 ? Number.POSITIVE_INFINITY : indexB;

	if (rankA < rankB) {
		return -1;
	}
	if (rankA > rankB) {
		return 1;
	}

	return compareAsciiKeys(a, b);
}

/**
 * プレーン object のキーを再帰的にソートする（配列の要素順は維持する）
 */
export function sortObjectKeysDeep(value: unknown, preferredKeys: readonly string[] = []): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => sortObjectKeysDeep(item, preferredKeys));
	}

	if (!isPlainObject(value)) {
		return value;
	}

	const sorted: Record<string, unknown> = {};
	const keys = Object.keys(value).sort((left, right) => compareObjectKeys(left, right, preferredKeys));

	for (const key of keys) {
		sorted[key] = sortObjectKeysDeep(value[key], preferredKeys);
	}

	return sorted;
}
