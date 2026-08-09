import type { RawDefinition } from '$lib/raw/raw-definition';

/**
 * IM-Forma JSON 向けの transport payload
 */
export type ImFormaShape = {
	formId: string;
	formName: string;
	description: string;
	version: string;
	items: unknown[];
};

/**
 * 検証済み Raw を IM-Forma 外部 JSON 用 payload へ整形する
 */
export function shapeImForma(raw: RawDefinition): ImFormaShape {
	return {
		formId: typeof raw.logicalId === 'string' ? raw.logicalId : 'form',
		formName: typeof raw.name === 'string' ? raw.name : '',
		description: typeof raw.description === 'string' ? raw.description : '',
		version: typeof raw.version === 'string' ? raw.version : '',
		items: Array.isArray(raw.items) ? raw.items : []
	};
}
