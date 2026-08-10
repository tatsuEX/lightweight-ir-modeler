import { readTargetResidual } from '$lib/ir/external-residual';
import type { RawDefinition } from '$lib/raw/raw-definition';

/** shape / unshape で共有する PrimeFaces の target 識別子 */
export const PRIMEFACES_TARGET_ID = 'primefaces';

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
 *
 * WARN: index signature は import 由来の残余（ベンダー固有キー）を載せるため。
 * form.hbs は既知キーのみ参照する。
 */
export type PrimeFacesShape = {
	formId: string;
	name: string;
	fields: PrimeFacesFieldShape[];
	[key: string]: unknown;
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
 * 日付 format のトークン（連続する英字）を同長の `_` に置換し、区切りはそのまま残す
 *
 * 例: yyyy-MM-dd HH:mm → ____-__-__ __:__
 * 例: yyyy/MM/dd → ____/__/__
 */
function formatToPlaceholderMask(format: string): string {
	return format.replace(/[A-Za-z]+/g, (token) => '_'.repeat(token.length));
}

/**
 * 日付系の format / clearable を整形し、テンプレ用 placeholder を format から導出する
 *
 * WARN: IR / Raw の SSOT は format のみ。placeholder は export shape の派生マスク。
 */
function shapeDateExtras(
	field: Record<string, unknown>,
	type: string
): { format: string; placeholder: string; clearable: boolean } {
	const format =
		asNonEmptyString(field.format) ?? DEFAULT_DATE_FORMAT[type] ?? DEFAULT_DATE_FORMAT.datepicker;
	return {
		format,
		placeholder: formatToPlaceholderMask(format),
		clearable: field.clearable === true
	};
}

/**
 * Raw フィールド 1 件を Handlebars context 用へ整形する
 */
function shapePrimeFacesField(field: Record<string, unknown>): PrimeFacesFieldShape {
	const { external, ...source } = field;
	const logicalId =
		typeof source.logicalId === 'string' && source.logicalId.trim() !== ''
			? source.logicalId
			: 'field';
	const type = typeof source.type === 'string' && source.type.trim() !== '' ? source.type : 'unknown';
	const common = shapeCommon(source, logicalId);

	let shaped: PrimeFacesFieldShape;

	if (type === 'textarea') {
		const validation =
			source.validation !== null &&
			typeof source.validation === 'object' &&
			!Array.isArray(source.validation)
				? (source.validation as Record<string, unknown>)
				: {};
		shaped = {
			...common,
			type: 'textarea',
			rows: asFiniteNumber(source.rows),
			cols: asFiniteNumber(source.cols),
			maxlength: asFiniteNumber(validation.maxlength) ?? asFiniteNumber(source.maxlength)
		};
	} else if (type === 'textbox' || type === 'number') {
		shaped = { ...common, type };
	} else if (type === 'label') {
		shaped = { ...common, type: 'label' };
	} else if (SELECT_TYPES.has(type)) {
		shaped = {
			...common,
			type: type as PrimeFacesSelectFieldShape['type'],
			items: shapeSelectItems(source.items)
		};
	} else if (DATE_TYPES.has(type)) {
		shaped = {
			...common,
			type: type as PrimeFacesDateFieldShape['type'],
			...shapeDateExtras(source, type)
		};
	} else if (type === 'date-span') {
		const validation =
			source.validation !== null &&
			typeof source.validation === 'object' &&
			!Array.isArray(source.validation)
				? (source.validation as Record<string, unknown>)
				: {};
		shaped = {
			...common,
			type: 'date-span',
			...shapeDateExtras(source, type),
			requiredFrom: validation.requiredFrom === true,
			requiredTo: validation.requiredTo === true
		};
	} else {
		shaped = { ...common, type };
	}

	// WARN: 残余を先に spread する。IR が所有するキーは必ず後勝ちにする。
	return {
		...readTargetResidual(external, PRIMEFACES_TARGET_ID),
		...shaped
	} as PrimeFacesFieldShape;
}

/**
 * 検証済み Raw を PrimeFaces テンプレート用 context へ整形する
 *
 * WARN: 文字列の HTML escape は行わない。Handlebars の {{ }} に委譲する。
 */
export function shapePrimeFaces(raw: RawDefinition): PrimeFacesShape {
	const fields = Array.isArray(raw.fields) ? raw.fields : [];

	// WARN: 残余を先に spread する。IR が所有するキーは必ず後勝ちにする。
	return {
		...readTargetResidual(raw.external, PRIMEFACES_TARGET_ID),
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
