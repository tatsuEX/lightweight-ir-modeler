import type { RawDefinition } from '$lib/raw/raw-definition';

/**
 * 選択肢 1 件（select* 系テンプレート向け）
 */
export type PrimeFacesSelectItemShape = {
	label: string;
	value: string;
};

/**
 * 全フィールド共通の Handlebars context
 */
export type PrimeFacesFieldCommon = {
	id: string;
	label: string;
	hint: string;
	required: boolean;
	disabled: boolean;
	readonly: boolean;
};

/**
 * 単純入力（textbox / number）
 */
export type PrimeFacesSimpleFieldShape = PrimeFacesFieldCommon & {
	type: 'textbox' | 'number';
};

/**
 * テキストエリア
 */
export type PrimeFacesTextareaFieldShape = PrimeFacesFieldCommon & {
	type: 'textarea';
	rows?: number;
	cols?: number;
	maxlength?: number;
};

/**
 * ラベル（出力のみ）
 */
export type PrimeFacesLabelFieldShape = PrimeFacesFieldCommon & {
	type: 'label';
};

/**
 * 選択肢付きコントロール（checkbox / radio / dropdown）
 */
export type PrimeFacesSelectFieldShape = PrimeFacesFieldCommon & {
	type: 'checkbox' | 'radio' | 'dropdown' | 'dropdown-multi';
	items: PrimeFacesSelectItemShape[];
};

/**
 * 単一日時系（datepicker / datetimepicker / timepicker）
 */
export type PrimeFacesDateFieldShape = PrimeFacesFieldCommon & {
	type: 'datepicker' | 'datetimepicker' | 'timepicker';
	format: string;
	placeholder: string;
	clearable: boolean;
};

/**
 * 日付範囲
 */
export type PrimeFacesDateSpanFieldShape = PrimeFacesFieldCommon & {
	type: 'date-span';
	format: string;
	placeholder: string;
	clearable: boolean;
	requiredFrom: boolean;
	requiredTo: boolean;
};

/**
 * 未知 type（unsupported テンプレート向け）
 */
export type PrimeFacesUnknownFieldShape = PrimeFacesFieldCommon & {
	type: string;
};

/**
 * PrimeFaces Handlebars 向けフィールド context（type による discriminated union）
 */
export type PrimeFacesFieldShape =
	| PrimeFacesSimpleFieldShape
	| PrimeFacesTextareaFieldShape
	| PrimeFacesLabelFieldShape
	| PrimeFacesSelectFieldShape
	| PrimeFacesDateFieldShape
	| PrimeFacesDateSpanFieldShape
	| PrimeFacesUnknownFieldShape;

/**
 * PrimeFaces Handlebars 向け transport payload
 */
export type PrimeFacesShape = {
	formId: string;
	name: string;
	fields: PrimeFacesFieldShape[];
};

const SELECT_TYPES = new Set(['checkbox', 'radio', 'dropdown', 'dropdown-multi']);
const DATE_TYPES = new Set(['datepicker', 'datetimepicker', 'timepicker']);

const DEFAULT_DATE_FORMAT: Record<string, string> = {
	datepicker: 'yyyy-MM-dd',
	datetimepicker: 'yyyy-MM-dd HH:mm',
	timepicker: 'HH:mm',
	'date-span': 'yyyy-MM-dd'
};

/**
 * 有限 number なら返す
 */
function asFiniteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * 非空 string なら返す
 */
function asNonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Raw items を SelectItem 配列へ正規化する
 *
 * WARN: 文字列要素は label/value 同一として扱う（createRadio の簡易形式互換）。
 */
function shapeSelectItems(rawItems: unknown): PrimeFacesSelectItemShape[] {
	if (!Array.isArray(rawItems)) {
		return [];
	}

	const items: PrimeFacesSelectItemShape[] = [];
	for (const entry of rawItems) {
		if (typeof entry === 'string') {
			items.push({ label: entry, value: entry });
			continue;
		}
		if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
			continue;
		}
		const source = entry as Record<string, unknown>;
		const value =
			typeof source.value === 'string'
				? source.value
				: typeof source.value === 'number'
					? String(source.value)
					: '';
		const label = typeof source.label === 'string' ? source.label : value;
		if (label === '' && value === '') {
			continue;
		}
		items.push({ label: label !== '' ? label : value, value: value !== '' ? value : label });
	}
	return items;
}

/**
 * 共通属性を Raw フィールドから取り出す
 */
function shapeCommon(field: Record<string, unknown>, logicalId: string): PrimeFacesFieldCommon {
	const validation =
		field.validation !== null && typeof field.validation === 'object' && !Array.isArray(field.validation)
			? (field.validation as Record<string, unknown>)
			: {};

	return {
		id: logicalId,
		label: typeof field.label === 'string' ? field.label : '',
		hint: typeof field.hint === 'string' ? field.hint : '',
		required: field.required === true || validation.required === true,
		disabled: field.disabled === true,
		readonly: field.readonly === true
	};
}

/**
 * 日付系の format / placeholder / clearable を整形する
 */
function shapeDateExtras(
	field: Record<string, unknown>,
	type: string
): { format: string; placeholder: string; clearable: boolean } {
	const format =
		asNonEmptyString(field.format) ?? DEFAULT_DATE_FORMAT[type] ?? DEFAULT_DATE_FORMAT.datepicker;
	const placeholder =
		asNonEmptyString(field.placeholder) ??
		(typeof field.hint === 'string' && field.hint.trim() !== '' ? field.hint : format);
	return {
		format,
		placeholder,
		clearable: field.clearable === true
	};
}

/**
 * Raw フィールド 1 件を Handlebars context 用へ整形する
 */
function shapePrimeFacesField(field: Record<string, unknown>): PrimeFacesFieldShape {
	const logicalId =
		typeof field.logicalId === 'string' && field.logicalId.trim() !== ''
			? field.logicalId
			: 'field';
	const type = typeof field.type === 'string' && field.type.trim() !== '' ? field.type : 'unknown';
	const common = shapeCommon(field, logicalId);

	if (type === 'textarea') {
		const validation =
			field.validation !== null &&
			typeof field.validation === 'object' &&
			!Array.isArray(field.validation)
				? (field.validation as Record<string, unknown>)
				: {};
		return {
			...common,
			type: 'textarea',
			rows: asFiniteNumber(field.rows),
			cols: asFiniteNumber(field.cols),
			maxlength: asFiniteNumber(validation.maxlength) ?? asFiniteNumber(field.maxlength)
		};
	}

	if (type === 'textbox' || type === 'number') {
		return { ...common, type };
	}

	if (type === 'label') {
		return { ...common, type: 'label' };
	}

	if (SELECT_TYPES.has(type)) {
		return {
			...common,
			type: type as PrimeFacesSelectFieldShape['type'],
			items: shapeSelectItems(field.items)
		};
	}

	if (DATE_TYPES.has(type)) {
		return {
			...common,
			type: type as PrimeFacesDateFieldShape['type'],
			...shapeDateExtras(field, type)
		};
	}

	if (type === 'date-span') {
		const validation =
			field.validation !== null &&
			typeof field.validation === 'object' &&
			!Array.isArray(field.validation)
				? (field.validation as Record<string, unknown>)
				: {};
		return {
			...common,
			type: 'date-span',
			...shapeDateExtras(field, type),
			requiredFrom: validation.requiredFrom === true,
			requiredTo: validation.requiredTo === true
		};
	}

	return { ...common, type };
}

/**
 * 検証済み Raw を PrimeFaces テンプレート用 context へ整形する
 *
 * WARN: 文字列の HTML escape は行わない。Handlebars の {{ }} に委譲する。
 */
export function shapePrimeFaces(raw: RawDefinition): PrimeFacesShape {
	const fields = Array.isArray(raw.fields) ? raw.fields : [];

	return {
		formId: typeof raw.logicalId === 'string' ? raw.logicalId : 'form',
		name: typeof raw.name === 'string' ? raw.name : 'form',
		fields: fields
			.filter(
				(field): field is Record<string, unknown> =>
					field !== null && typeof field === 'object' && !Array.isArray(field)
			)
			.map(shapePrimeFacesField)
	};
}
