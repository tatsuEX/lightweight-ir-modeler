import { buildTargetResidual } from '$lib/ir/external-residual';
import type { RawDefinition } from '$lib/raw/raw-definition';
import { IM_FORMA_TARGET_ID } from '$lib/server/io/writers/shape/im-forma-shape';

/**
 * shape が生成する document レベルのキー（これ以外は残余として退避する）
 */
export const IM_FORMA_DOCUMENT_KEYS = [
	'formId',
	'formName',
	'description',
	'version',
	'items'
] as const;

/**
 * Raw item として認識するキー（これ以外は残余として退避する）
 */
export const IM_FORMA_ITEM_KEYS = [
	'logicalId',
	'type',
	'label',
	'hint',
	'disabled',
	'readonly',
	'hidden',
	'required',
	'validation',
	'items',
	'format',
	'clearable',
	'rows',
	'cols',
	'multiple'
] as const;

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * IM-Forma の item payload を Raw item へ戻す
 *
 * WARN: 値の型は矯正しない。不正値は後段の SchemaValidator に検出させる。
 */
function unshapeImFormaItem(item: unknown): unknown {
	if (!isPlainObject(item)) {
		return item;
	}

	const field: Record<string, unknown> = {};
	for (const key of IM_FORMA_ITEM_KEYS) {
		if (key in item) {
			field[key] = item[key];
		}
	}

	const external = buildTargetResidual(item, IM_FORMA_ITEM_KEYS, IM_FORMA_TARGET_ID);
	if (external) {
		field.external = external;
	}

	return field;
}

/**
 * IM-Forma 外部 JSON payload を RawDefinition へ戻す（shapeImForma の逆）
 */
export function unshapeImForma(payload: unknown): RawDefinition {
	if (!isPlainObject(payload)) {
		throw new Error('IM-Forma definition must be a JSON object');
	}

	const raw: RawDefinition = {
		target: IM_FORMA_TARGET_ID,
		logicalId: payload.formId,
		name: payload.formName,
		description: payload.description ?? '',
		version: payload.version ?? '',
		items: Array.isArray(payload.items) ? payload.items.map(unshapeImFormaItem) : payload.items
	};

	const external = buildTargetResidual(payload, IM_FORMA_DOCUMENT_KEYS, IM_FORMA_TARGET_ID);
	if (external) {
		raw.external = external;
	}

	return raw;
}
