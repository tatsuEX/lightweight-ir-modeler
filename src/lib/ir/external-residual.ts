/**
 * 外部 UI 定義の残余（IR がモデル化しないベンダー固有キー）を target 名前空間で保持する
 *
 * WARN: IR は外部 UI フレームワークの型に依存しない。ここは型を持たない不透明な bag として扱い、
 * 中身の意味解釈は Reader / shape（形式固有層）だけが行う。
 */
export type ExternalResidual = Record<string, Record<string, unknown>>;

/** prototype 汚染を避けるため残余へ取り込まないキー */
const UNSAFE_RESIDUAL_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 残余バッグから target 名前空間のエントリを取り出す
 */
export function readTargetResidual(container: unknown, targetId: string): Record<string, unknown> {
	if (!isPlainObject(container)) {
		return {};
	}

	const entry = container[targetId];
	return isPlainObject(entry) ? entry : {};
}

/**
 * 残余バッグに target 名前空間のエントリ（1 キー以上）があるか判定する
 */
export function hasTargetResidual(container: unknown, targetId: string): boolean {
	return Object.keys(readTargetResidual(container, targetId)).length > 0;
}

/**
 * 既知キーを除いた残りを target 名前空間付きの残余バッグとして組み立てる
 * 残余が無い場合は undefined を返す（空 object を IR に残さない）
 */
export function buildTargetResidual(
	source: unknown,
	knownKeys: readonly string[],
	targetId: string
): ExternalResidual | undefined {
	if (!isPlainObject(source)) {
		return undefined;
	}

	const known = new Set(knownKeys);
	const residual: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(source)) {
		if (known.has(key) || UNSAFE_RESIDUAL_KEYS.has(key)) {
			continue;
		}
		residual[key] = value;
	}

	return Object.keys(residual).length > 0 ? { [targetId]: residual } : undefined;
}

/**
 * 任意値を ExternalResidual として正規化する（不正値・空は undefined）
 */
export function normalizeExternalResidual(value: unknown): ExternalResidual | undefined {
	if (!isPlainObject(value)) {
		return undefined;
	}

	const normalized: ExternalResidual = {};

	for (const [targetId, entry] of Object.entries(value)) {
		if (UNSAFE_RESIDUAL_KEYS.has(targetId) || !isPlainObject(entry)) {
			continue;
		}

		const cleaned: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(entry)) {
			if (UNSAFE_RESIDUAL_KEYS.has(key)) {
				continue;
			}
			cleaned[key] = item;
		}

		if (Object.keys(cleaned).length > 0) {
			normalized[targetId] = cleaned;
		}
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}
