/**
 * プレーン object かどうかを判定する
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * component から logicalId 文字列を読む（空・非文字列は undefined）
 */
export function readComponentLogicalId(component: unknown): string | undefined {
	if (!isPlainObject(component)) {
		return undefined;
	}

	const logicalId = component.logicalId;
	if (typeof logicalId !== 'string') {
		return undefined;
	}

	const trimmed = logicalId.trim();
	return trimmed === '' ? undefined : trimmed;
}

/**
 * snapshot を汚さないための component コピー（validation だけ一段深くコピーする）
 */
export function cloneComponent(component: unknown): unknown {
	if (!isPlainObject(component)) {
		return component;
	}

	const cloned: Record<string, unknown> = { ...component };
	if (isPlainObject(component.validation)) {
		cloned.validation = { ...component.validation };
	}

	return cloned;
}
