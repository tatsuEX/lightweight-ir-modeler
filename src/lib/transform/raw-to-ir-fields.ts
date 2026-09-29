import { normalizeExternalResidual } from '$lib/ir/external-residual';
import {
	parsePersistedComponent,
	type PersistedComponent
} from '$lib/ir/elements/component-schema';

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Raw 用フィールドオブジェクトから IR component を組み立てる（mapComponentToRawField の逆）
 *
 * WARN: エディタ用 `id` はここでは採番しない。store の hydrate が付与する。
 * WARN: 未知 type は `parsePersistedComponent` が `unsupported` + `sourceType` に正規化する。
 */
export function mapRawFieldToComponent(field: unknown): PersistedComponent {
	if (!isPlainObject(field)) {
		return parsePersistedComponent({ logicalId: '', type: '', label: '' });
	}

	const validation = isPlainObject(field.validation) ? { ...field.validation } : {};

	// WARN: Raw は required を top-level にも複製する。IR 側の SSOT は validation.required。
	validation.required = validation.required === true || field.required === true;

	const component: Record<string, unknown> = {
		logicalId: typeof field.logicalId === 'string' ? field.logicalId : '',
		type: typeof field.type === 'string' && field.type.trim() !== '' ? field.type : '',
		label: typeof field.label === 'string' ? field.label : '',
		hint: typeof field.hint === 'string' ? field.hint : '',
		disabled: field.disabled === true,
		readonly: field.readonly === true,
		hidden: field.hidden === true,
		validation
	};

	if (typeof field.sourceType === 'string' && field.sourceType.trim() !== '') {
		component.sourceType = field.sourceType;
	}
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
	copyOwnValueKeys(component, field);

	const external = normalizeExternalResidual(field.external);
	if (external) {
		component.external = external;
	}

	return parsePersistedComponent(component);
}

/** IR へ写す初期値キー */
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
