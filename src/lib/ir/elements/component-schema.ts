/**
 * IR component の Zod discriminated union
 *
 * WARN: これが IR component の単一の真実。Persisted（id なし）から Editor（id あり）を導出する。
 * WARN: `z.object` は未知キーを黙って除去する。`tooltip` / `autosize` の graceful removal と
 * `id` の永続化防止はこれに依存する。`z.strictObject` に切り替えると既存 snapshot が壊れる。
 * WARN: validation オブジェクトの欠落は Zod v4 の `.prefault({})` で埋める。`.default({})` は
 * 出力型（全フィールド必須）を要求するため型が通らない。
 */

import * as z from 'zod';
import type { ExternalResidual } from '$lib/ir/external-residual';

/** 選択系 items の 1 要素 */
export const SelectItemSchema = z.object({
	label: z.string(),
	value: z.string()
});

/** 選択系 items の 1 要素（string も受理。既存 YAML / コメント例との互換） */
const SelectItemInputSchema = z.union([z.string(), SelectItemSchema]);

/** ベンダー残余。空 object は正規化側で落とす前提なので optional */
const ExternalResidualSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

/** 全 component 共通の項目（label / unsupported も含む） */
const baseShape = {
	logicalId: z.string().default(''),
	label: z.string().default(''),
	hint: z.string().default(''),
	disabled: z.boolean().default(false),
	readonly: z.boolean().default(false),
	hidden: z.boolean().default(false),
	external: ExternalResidualSchema.optional()
};

/** validation の共通項目 */
const validationBaseShape = {
	required: z.boolean().default(false),
	customErrorMessages: z.record(z.string(), z.string()).default({})
};

const textValidationShape = {
	...validationBaseShape,
	pattern: z.string().default(''),
	minlength: z.number().default(0),
	maxlength: z.number().default(30)
};

const textareaValidationShape = {
	...validationBaseShape,
	minlength: z.number().default(0),
	maxlength: z.number().default(200)
};

const numberValidationShape = {
	...validationBaseShape,
	min: z.number().optional(),
	max: z.number().optional(),
	scale: z.number().default(0),
	step: z.number().default(1)
};

const requiredOnlyValidationShape = {
	...validationBaseShape
};

const dateValidationShape = {
	...validationBaseShape,
	minDate: z.string().optional(),
	maxDate: z.string().optional()
};

const dateSpanValidationShape = {
	...dateValidationShape,
	requiredFrom: z.boolean().default(false),
	requiredTo: z.boolean().default(false)
};

const dateTimeValidationShape = {
	...validationBaseShape,
	minDateTime: z.string().optional(),
	maxDateTime: z.string().optional()
};

const timeValidationShape = {
	...validationBaseShape,
	minTime: z.string().optional(),
	maxTime: z.string().optional()
};

const editorIdShape = {
	id: z.string()
};

/** 永続化形（id なし）: textbox */
export const PersistedTextboxSchema = z.object({
	type: z.literal('textbox'),
	...baseShape,
	defaultValue: z.string().default(''),
	validation: z.object(textValidationShape).prefault({})
});

/** 永続化形（id なし）: textarea */
export const PersistedTextareaSchema = z.object({
	type: z.literal('textarea'),
	...baseShape,
	defaultValue: z.string().default(''),
	cols: z.number().default(30),
	rows: z.number().default(3),
	validation: z.object(textareaValidationShape).prefault({})
});

/** 永続化形（id なし）: number */
export const PersistedNumberSchema = z.object({
	type: z.literal('number'),
	...baseShape,
	defaultValue: z.number().nullable().default(null),
	validation: z.object(numberValidationShape).prefault({})
});

/** 永続化形（id なし）: checkbox */
export const PersistedCheckboxSchema = z.object({
	type: z.literal('checkbox'),
	...baseShape,
	defaultValue: z.array(z.string()).default([]),
	items: z.array(SelectItemInputSchema).default([]),
	validation: z.object(requiredOnlyValidationShape).prefault({})
});

/** 永続化形（id なし）: radio */
export const PersistedRadioSchema = z.object({
	type: z.literal('radio'),
	...baseShape,
	defaultValue: z.string().default(''),
	items: z.array(SelectItemInputSchema).default([]),
	validation: z.object(requiredOnlyValidationShape).prefault({})
});

/** 永続化形（id なし）: dropdown */
export const PersistedDropdownSchema = z.object({
	type: z.literal('dropdown'),
	...baseShape,
	defaultValue: z.string().default(''),
	multiple: z.literal(false).default(false),
	items: z.array(SelectItemInputSchema).default([]),
	validation: z.object(requiredOnlyValidationShape).prefault({})
});

/** 永続化形（id なし）: dropdown-multi */
export const PersistedDropdownMultiSchema = z.object({
	type: z.literal('dropdown-multi'),
	...baseShape,
	defaultValue: z.array(z.string()).default([]),
	multiple: z.literal(true).default(true),
	items: z.array(SelectItemInputSchema).default([]),
	validation: z.object(requiredOnlyValidationShape).prefault({})
});

/** 永続化形（id なし）: datepicker */
export const PersistedDatepickerSchema = z.object({
	type: z.literal('datepicker'),
	...baseShape,
	defaultValue: z.string().nullable().default(null),
	format: z.string().default('yyyy-MM-dd'),
	clearable: z.boolean().default(false),
	validation: z.object(dateValidationShape).prefault({})
});

/** 永続化形（id なし）: date-span */
export const PersistedDateSpanSchema = z.object({
	type: z.literal('date-span'),
	...baseShape,
	defaultValueFrom: z.string().nullable().default(null),
	defaultValueTo: z.string().nullable().default(null),
	format: z.string().default('yyyy-MM-dd'),
	clearable: z.boolean().default(false),
	validation: z.object(dateSpanValidationShape).prefault({})
});

/** 永続化形（id なし）: datetimepicker */
export const PersistedDatetimepickerSchema = z.object({
	type: z.literal('datetimepicker'),
	...baseShape,
	defaultValue: z.string().nullable().default(null),
	format: z.string().default('yyyy-MM-dd HH:mm'),
	clearable: z.boolean().default(false),
	validation: z.object(dateTimeValidationShape).prefault({})
});

/** 永続化形（id なし）: timepicker */
export const PersistedTimepickerSchema = z.object({
	type: z.literal('timepicker'),
	...baseShape,
	defaultValue: z.string().nullable().default(null),
	format: z.string().default('HH:mm'),
	clearable: z.boolean().default(false),
	validation: z.object(timeValidationShape).prefault({})
});

/** 永続化形（id なし）: label */
export const PersistedLabelSchema = z.object({
	type: z.literal('label'),
	...baseShape,
	defaultValue: z.string().default(''),
	validation: z.object(requiredOnlyValidationShape).prefault({})
});

/**
 * 永続化形（id なし）: 未知ベンダー type
 *
 * WARN: 元のベンダー型名は `sourceType` に退避する。`type: string` の catch-all は
 * discriminant を壊すので置かない。正規化は `parsePersistedComponent`（Import）と
 * `hydrateEditorComponent`（restore / loadSnapshot）。
 */
export const PersistedUnsupportedSchema = z.object({
	type: z.literal('unsupported'),
	...baseShape,
	sourceType: z.string().default(''),
	validation: z.object(requiredOnlyValidationShape).prefault({})
});

/** snapshot YAML / transform 境界向け（id を持たない） */
export const PersistedComponentSchema = z.discriminatedUnion('type', [
	PersistedTextboxSchema,
	PersistedTextareaSchema,
	PersistedNumberSchema,
	PersistedCheckboxSchema,
	PersistedRadioSchema,
	PersistedDropdownSchema,
	PersistedDropdownMultiSchema,
	PersistedDatepickerSchema,
	PersistedDateSpanSchema,
	PersistedDatetimepickerSchema,
	PersistedTimepickerSchema,
	PersistedLabelSchema,
	PersistedUnsupportedSchema
]);

/** store / GUI / preview 向け（id 必須） */
export const EditorComponentSchema = z.discriminatedUnion('type', [
	PersistedTextboxSchema.extend(editorIdShape),
	PersistedTextareaSchema.extend(editorIdShape),
	PersistedNumberSchema.extend(editorIdShape),
	PersistedCheckboxSchema.extend(editorIdShape),
	PersistedRadioSchema.extend(editorIdShape),
	PersistedDropdownSchema.extend(editorIdShape),
	PersistedDropdownMultiSchema.extend(editorIdShape),
	PersistedDatepickerSchema.extend(editorIdShape),
	PersistedDateSpanSchema.extend(editorIdShape),
	PersistedDatetimepickerSchema.extend(editorIdShape),
	PersistedTimepickerSchema.extend(editorIdShape),
	PersistedLabelSchema.extend(editorIdShape),
	PersistedUnsupportedSchema.extend(editorIdShape)
]);

/** 外部ファイルに出る component（id なし） */
export type PersistedComponent = z.infer<typeof PersistedComponentSchema>;

/** store / GUI が持つ component（id あり） */
export type EditorComponent = z.infer<typeof EditorComponentSchema>;

/** `type` の literal union（unsupported を含む） */
export type ComponentType = EditorComponent['type'];

/** ファクトリが生成する既知 type（unsupported を除く） */
export type KnownComponentType = Exclude<ComponentType, 'unsupported'>;

/** 選択系 items の 1 要素 */
export type SelectItem = z.infer<typeof SelectItemSchema>;

/** items を持つ Editor component */
export type SelectEditorComponent = Extract<
	EditorComponent,
	{ type: 'checkbox' | 'radio' | 'dropdown' | 'dropdown-multi' }
>;

/**
 * 選択系 items を { label, value }[] に揃える
 */
export function toSelectItems(items: ReadonlyArray<string | SelectItem>): SelectItem[] {
	return items.map((item) => (typeof item === 'string' ? { label: item, value: item } : item));
}

/**
 * 選択系 component か判定する
 */
export function isSelectEditorComponent(component: EditorComponent): component is SelectEditorComponent {
	return (
		component.type === 'checkbox' ||
		component.type === 'radio' ||
		component.type === 'dropdown' ||
		component.type === 'dropdown-multi'
	);
}

/** 既知 type の列（ファクトリ registry と同期させる） */
export const KNOWN_COMPONENT_TYPES = [
	'textbox',
	'textarea',
	'number',
	'checkbox',
	'radio',
	'dropdown',
	'dropdown-multi',
	'datepicker',
	'date-span',
	'datetimepicker',
	'timepicker',
	'label'
] as const satisfies readonly KnownComponentType[];

/** 全 ComponentType の列 */
export const COMPONENT_TYPES = [
	...KNOWN_COMPONENT_TYPES,
	'unsupported'
] as const satisfies readonly ComponentType[];

/**
 * switch (component.type) の網羅性をコンパイル時に担保する
 */
export function assertNever(value: never): never {
	throw new Error(`unexpected value: ${String(value)}`);
}

/**
 * Editor component から id を除いた永続化形を返す
 *
 * WARN: union に対する Omit は分配されない。parse で member を再確定する。
 */
export function toPersistedComponent(component: EditorComponent): PersistedComponent {
	const { id: _id, ...rest } = component;
	return PersistedComponentSchema.parse(rest);
}

const COMPONENT_TYPE_SET: ReadonlySet<string> = new Set(COMPONENT_TYPES);

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * type が閉じた ComponentType か判定する
 */
export function isComponentType(value: unknown): value is ComponentType {
	return typeof value === 'string' && COMPONENT_TYPE_SET.has(value);
}

/**
 * record から非空の id を読む
 */
function readNonEmptyId(value: unknown): string | undefined {
	if (!isPlainObject(value) || typeof value.id !== 'string') {
		return undefined;
	}

	const trimmed = value.id.trim();
	return trimmed === '' ? undefined : trimmed;
}

/**
 * 未知 type を unsupported + sourceType へ正規化した payload を返す
 */
function normalizeComponentTypePayload(value: unknown): Record<string, unknown> {
	const record = isPlainObject(value) ? { ...value } : {};
	const sourceType = typeof record.type === 'string' ? record.type : '';
	return isComponentType(sourceType) ? record : { ...record, type: 'unsupported', sourceType };
}

/**
 * 永続化形として parse する（id は付けない）
 *
 * WARN: Import / snapshot 比較の境界。未知 type は `unsupported` + `sourceType`。
 */
export function parsePersistedComponent(value: unknown): PersistedComponent {
	return PersistedComponentSchema.parse(normalizeComponentTypePayload(value));
}

/**
 * 永続化形（または未知 type の素通し）を EditorComponent にする
 *
 * WARN: 未知の `type` は `unsupported` に正規化し、元の値を `sourceType` へ退避する。
 * `tooltip` / `autosize` / 未宣言キーは parse で除去する。
 */
export function hydrateEditorComponent(value: unknown, id?: string): EditorComponent {
	const record = normalizeComponentTypePayload(value);
	const resolvedId = id !== undefined && id.trim() !== '' ? id.trim() : readNonEmptyId(record);
	if (!resolvedId) {
		throw new Error('IR component hydrate requires a non-empty id');
	}

	return EditorComponentSchema.parse({ ...record, id: resolvedId });
}

/**
 * components 配列を EditorComponent[] へ hydrate する
 */
export function hydrateEditorComponents(
	values: unknown[],
	resolveId: (value: unknown) => string
): EditorComponent[] {
	return values.map((value) => hydrateEditorComponent(value, resolveId(value)));
}

export type { ExternalResidual };
