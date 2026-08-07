/**
 * IR component から Raw 用フィールドオブジェクトを組み立てる
 */
export function mapComponentToRawField(component: unknown): Record<string, unknown> {
	if (component === null || typeof component !== 'object' || Array.isArray(component)) {
		return { type: 'unknown' };
	}

	const source = component as Record<string, unknown>;
	const type = typeof source.type === 'string' && source.type.trim() !== '' ? source.type : 'unknown';
	const validation =
		source.validation !== null && typeof source.validation === 'object' && !Array.isArray(source.validation)
			? (source.validation as Record<string, unknown>)
			: {};

	return {
		logicalId: typeof source.logicalId === 'string' ? source.logicalId : '',
		type,
		label: typeof source.label === 'string' ? source.label : '',
		hint: typeof source.hint === 'string' ? source.hint : '',
		disabled: source.disabled === true,
		readonly: source.readonly === true,
		hidden: source.hidden === true,
		required: validation.required === true,
		validation: { ...validation }
	};
}
