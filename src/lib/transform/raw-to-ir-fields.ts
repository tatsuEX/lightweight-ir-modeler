import { normalizeExternalResidual } from '$lib/ir/external-residual';

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Raw 用フィールドオブジェクトから IR component を組み立てる（mapComponentToRawField の逆）
 *
 * WARN: エディタ用 `id` はここでは採番しない。store のファクトリが付与する。
 */
export function mapRawFieldToComponent(field: unknown): Record<string, unknown> {
	if (!isPlainObject(field)) {
		return { logicalId: '', type: 'unknown', label: '' };
	}

	const validation = isPlainObject(field.validation) ? { ...field.validation } : {};

	// WARN: Raw は required を top-level にも複製する。IR 側の SSOT は validation.required。
	validation.required = validation.required === true || field.required === true;

	const component: Record<string, unknown> = {
		logicalId: typeof field.logicalId === 'string' ? field.logicalId : '',
		type: typeof field.type === 'string' && field.type.trim() !== '' ? field.type : 'unknown',
		label: typeof field.label === 'string' ? field.label : '',
		hint: typeof field.hint === 'string' ? field.hint : '',
		disabled: field.disabled === true,
		readonly: field.readonly === true,
		hidden: field.hidden === true,
		validation
	};

	if (Array.isArray(field.items)) {
		component.items = field.items;
	}
	if (typeof field.format === 'string') {
		component.format = field.format;
	}
	if (typeof field.clearable === 'boolean') {
		component.clearable = field.clearable;
	}
	if (typeof field.rows === 'number') {
		component.rows = field.rows;
	}
	if (typeof field.cols === 'number') {
		component.cols = field.cols;
	}
	if (typeof field.multiple === 'boolean') {
		component.multiple = field.multiple;
	}

	const external = normalizeExternalResidual(field.external);
	if (external) {
		component.external = external;
	}

	return component;
}
