import { readTargetResidual } from '$lib/ir/external-residual';
import type { RawDefinition } from '$lib/raw/raw-definition';

/** shape / unshape で共有する IM-Forma の target 識別子 */
export const IM_FORMA_TARGET_ID = 'im-forma';

/**
 * IM-Forma JSON 向けの transport payload
 *
 * WARN: index signature は import 由来の残余（ベンダー固有キー）を載せるため。
 */
export type ImFormaShape = {
	formId: string;
	formName: string;
	description: string;
	version: string;
	items: unknown[];
	[key: string]: unknown;
};

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Raw item に残余をマージし、IM-Forma の item payload へ整形する
 */
function shapeImFormaItem(item: unknown): unknown {
	if (!isPlainObject(item)) {
		return item;
	}

	const { external, ...rest } = item;

	// WARN: 残余を先に spread する。IR が所有するキーは必ず後勝ちにする。
	return {
		...readTargetResidual(external, IM_FORMA_TARGET_ID),
		...rest
	};
}

/**
 * 検証済み Raw を IM-Forma 外部 JSON 用 payload へ整形する
 */
export function shapeImForma(raw: RawDefinition): ImFormaShape {
	// WARN: 残余を先に spread する。IR が所有するキーは必ず後勝ちにする。
	return {
		...readTargetResidual(raw.external, IM_FORMA_TARGET_ID),
		formId: typeof raw.logicalId === 'string' ? raw.logicalId : 'form',
		formName: typeof raw.name === 'string' ? raw.name : '',
		description: typeof raw.description === 'string' ? raw.description : '',
		version: typeof raw.version === 'string' ? raw.version : '',
		items: Array.isArray(raw.items) ? raw.items.map(shapeImFormaItem) : []
	};
}
