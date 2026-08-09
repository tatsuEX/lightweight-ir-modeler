import type { RawDefinition } from '$lib/raw/raw-definition';

/**
 * PrimeFaces Handlebars 向けフィールド context
 */
export type PrimeFacesFieldShape = {
	id: string;
	type: string;
	label: string;
	hint: string;
	required: boolean;
};

/**
 * PrimeFaces Handlebars 向け transport payload
 */
export type PrimeFacesShape = {
	formId: string;
	name: string;
	fields: PrimeFacesFieldShape[];
};

/**
 * Raw フィールド 1 件を Handlebars context 用へ整形する
 */
function shapePrimeFacesField(field: Record<string, unknown>): PrimeFacesFieldShape {
	const logicalId =
		typeof field.logicalId === 'string' && field.logicalId.trim() !== ''
			? field.logicalId
			: 'field';

	return {
		id: logicalId,
		type: typeof field.type === 'string' ? field.type : 'unknown',
		label: typeof field.label === 'string' ? field.label : '',
		hint: typeof field.hint === 'string' ? field.hint : '',
		required: field.required === true
	};
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
