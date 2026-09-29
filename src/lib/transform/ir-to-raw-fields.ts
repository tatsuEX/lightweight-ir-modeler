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
	const rawType = typeof source.type === 'string' && source.type.trim() !== '' ? source.type : 'unknown';
	// WARN: hydrate が未知 type を unsupported に正規化する。Export では元のベンダー type を戻す。
	const sourceType =
		typeof source.sourceType === 'string' && source.sourceType.trim() !== '' ? source.sourceType : '';
	const type = rawType === 'unsupported' ? sourceType || 'unknown' : rawType;
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
	copyOwnValueKeys(field, source);

	// WARN: このマッピングは allowlist。external を通さないと import 由来のベンダー固有キーが export で消える。
	const external = normalizeExternalResidual(source.external);
	if (external) {
		field.external = external;
	}

	return field;
}

/** Raw へ写す初期値キー（型に無いキーは後段の parse が落とす） */
const VALUE_KEYS = ['defaultValue', 'defaultValueFrom', 'defaultValueTo'] as const;

/**
 * 初期値キーを、undefined 以外のときだけ写す
 *
 * WARN: `null` は number / 日付の「未設定」なので残す。
 */
function copyOwnValueKeys(target: Record<string, unknown>, source: Record<string, unknown>): void {
	for (const key of VALUE_KEYS) {
		if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
			target[key] = source[key];
		}
	}
}
