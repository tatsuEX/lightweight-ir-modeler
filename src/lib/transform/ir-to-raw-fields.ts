import { normalizeExternalResidual } from '$lib/ir/external-residual';

/**
 * IR component から Raw 用フィールドオブジェクトを組み立てる
 *
 * WARN: type 固有プロパティ（items / format 等）は additionalProperties としてそのまま載せる。
 * shape 層がテンプレート向けに正規化する。
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

	const field: Record<string, unknown> = {
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

	if (Array.isArray(source.items)) {
		field.items = source.items;
	}
	if (typeof source.format === 'string') {
		field.format = source.format;
	}
	if (typeof source.clearable === 'boolean') {
		field.clearable = source.clearable;
	}
	if (typeof source.rows === 'number') {
		field.rows = source.rows;
	}
	if (typeof source.cols === 'number') {
		field.cols = source.cols;
	}
	if (typeof source.multiple === 'boolean') {
		field.multiple = source.multiple;
	}

	// WARN: このマッピングは allowlist。external を通さないと import 由来のベンダー固有キーが export で消える。
	const external = normalizeExternalResidual(source.external);
	if (external) {
		field.external = external;
	}

	return field;
}
