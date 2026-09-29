/**
 * UI 定義コンポーネントの既定値ファクトリ
 *
 * WARN: validation をデフォルトとマージしたあと ...rest する。...info だと部分指定で他デフォルトが消える。
 * WARN: `tooltip` / `autosize` は IR から外した。既存 YAML に残っていても Phase 2 の parse で除去する。
 */

import { nanoid } from 'nanoid';
import {
	hydrateEditorComponent,
	type EditorComponent,
	type KnownComponentType
} from '$lib/ir/elements/component-schema';

/** コンポーネント system id の長さ（restore / append と揃える） */
export const SYSTEM_ID_LENGTH = 24;

/**
 * ファクトリ引数。`validation` だけ入れ子の部分指定を許す
 *
 * WARN: `external` まで Partial すると Record の値が optional になり、戻り値に割り当てられない。
 */
type FactoryInit<TType extends KnownComponentType> = {
	[K in Exclude<keyof Extract<EditorComponent, { type: TType }>, 'id' | 'type'>]?: K extends 'validation'
		? Partial<Extract<EditorComponent, { type: TType }> & { validation: unknown } extends { validation: infer V }
				? V
				: never>
		: Extract<EditorComponent, { type: TType }>[K];
};

type EditorOf<TType extends KnownComponentType> = Extract<EditorComponent, { type: TType }>;

/**
 * ファクトリ registry の型。type を足して実装を書き忘れるとコンパイルエラーになる
 */
type ComponentFactoryMap = {
	[K in KnownComponentType]: (info: FactoryInit<K>) => EditorOf<K>;
};

/**
 * コンポーネント system id を採番する
 */
function nextComponentId(): string {
	return nanoid(SYSTEM_ID_LENGTH);
}

/**
 * テキストボックスを作成する
 */
export function createTextbox(info: FactoryInit<'textbox'>): EditorOf<'textbox'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'textbox',
		label: '',
		hint: '',
		defaultValue: '',
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			pattern: '',
			minlength: 0,
			maxlength: 30,
			customErrorMessages: {
				required: '必須項目です',
				pattern: '不正な形式です',
				minlength: '最小文字数を超えています',
				maxlength: '最大文字数を超えています'
			},
			...validation
		},
		...rest
	};
}

/**
 * テキストエリアを作成する
 */
export function createTextarea(info: FactoryInit<'textarea'>): EditorOf<'textarea'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'textarea',
		label: '',
		hint: '',
		defaultValue: '',
		disabled: false,
		readonly: false,
		hidden: false,
		cols: 30,
		rows: 3,
		validation: {
			required: false,
			minlength: 0,
			maxlength: 200,
			customErrorMessages: {
				required: '必須項目です',
				minlength: '最小文字数を超えています',
				maxlength: '最大文字数を超えています'
			},
			...validation
		},
		...rest
	};
}

/**
 * 数値入力を作成する
 */
export function createNumber(info: FactoryInit<'number'>): EditorOf<'number'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'number',
		label: '',
		hint: '',
		defaultValue: null,
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			scale: 0,
			step: 1,
			customErrorMessages: {
				required: '必須項目です',
				min: '最小値を超えています',
				max: '最大値を超えています'
			},
			...validation
		},
		...rest
	};
}

/**
 * チェックボックスを作成する
 */
export function createCheckbox(info: FactoryInit<'checkbox'>): EditorOf<'checkbox'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'checkbox',
		label: '',
		hint: '',
		defaultValue: [],
		disabled: false,
		readonly: false,
		hidden: false,
		items: [],
		validation: {
			required: false,
			customErrorMessages: {
				required: '必須項目です'
			},
			...validation
		},
		...rest
	};
}

/**
 * ラジオボタンを作成する
 */
export function createRadio(info: FactoryInit<'radio'>): EditorOf<'radio'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'radio',
		label: '',
		hint: '',
		defaultValue: '',
		disabled: false,
		readonly: false,
		hidden: false,
		items: [],
		validation: {
			required: false,
			customErrorMessages: {
				required: '必須項目です'
			},
			...validation
		},
		...rest
	};
}

/**
 * ドロップダウンリストを作成する
 */
export function createDropdown(info: FactoryInit<'dropdown'>): EditorOf<'dropdown'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'dropdown',
		label: '',
		hint: '',
		defaultValue: '',
		multiple: false,
		disabled: false,
		readonly: false,
		hidden: false,
		items: [],
		validation: {
			required: false,
			customErrorMessages: {
				required: '必須項目です'
			},
			...validation
		},
		...rest
	};
}

/**
 * 複数選択ドロップダウンリストを作成する
 */
export function createDropdownMulti(info: FactoryInit<'dropdown-multi'>): EditorOf<'dropdown-multi'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'dropdown-multi',
		label: '',
		hint: '',
		defaultValue: [],
		multiple: true,
		disabled: false,
		readonly: false,
		hidden: false,
		items: [],
		validation: {
			required: false,
			customErrorMessages: {
				required: '必須項目です'
			},
			...validation
		},
		...rest
	};
}

/**
 * 日付ピッカーを作成する
 */
export function createDatepicker(info: FactoryInit<'datepicker'>): EditorOf<'datepicker'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'datepicker',
		label: '',
		hint: '',
		defaultValue: null,
		format: 'yyyy-MM-dd',
		clearable: false,
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			customErrorMessages: {
				required: '必須項目です',
				minDate: '最小日付を超えています',
				maxDate: '最大日付を超えています'
			},
			...validation
		},
		...rest
	};
}

/**
 * 日付範囲ピッカーを作成する
 */
export function createDateSpan(info: FactoryInit<'date-span'>): EditorOf<'date-span'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'date-span',
		label: '',
		hint: '',
		defaultValueFrom: null,
		defaultValueTo: null,
		format: 'yyyy-MM-dd',
		clearable: false,
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			requiredFrom: false,
			requiredTo: false,
			customErrorMessages: {
				required: '必須項目です',
				requiredFrom: '開始日は必須項目です',
				requiredTo: '終了日は必須項目です',
				minDate: '最小日付を超えています',
				maxDate: '最大日付を超えています'
			},
			...validation
		},
		...rest
	};
}

/**
 * 日時ピッカーを作成する
 */
export function createDatetimepicker(info: FactoryInit<'datetimepicker'>): EditorOf<'datetimepicker'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'datetimepicker',
		label: '',
		hint: '',
		defaultValue: null,
		format: 'yyyy-MM-dd HH:mm',
		clearable: false,
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			customErrorMessages: {
				required: '必須項目です',
				minDateTime: '最小日時を超えています',
				maxDateTime: '最大日時を超えています'
			},
			...validation
		},
		...rest
	};
}

/**
 * 時刻ピッカーを作成する
 */
export function createTimepicker(info: FactoryInit<'timepicker'>): EditorOf<'timepicker'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'timepicker',
		label: '',
		hint: '',
		defaultValue: null,
		format: 'HH:mm',
		clearable: false,
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			customErrorMessages: {
				required: '必須項目です',
				minTime: '最小時間を超えています',
				maxTime: '最大時間を超えています'
			},
			...validation
		},
		...rest
	};
}

/**
 * ラベルを作成する
 */
export function createLabel(info: FactoryInit<'label'>): EditorOf<'label'> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'label',
		label: '',
		hint: '',
		defaultValue: '',
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			customErrorMessages: {},
			...validation
		},
		...rest
	};
}

/**
 * 未知ベンダー type を unsupported として作成する
 *
 * WARN: registry には載せない。未知 type の正規化は `parsePersistedComponent` / hydrate。
 */
export function createUnsupported(
	info: {
		[K in Exclude<
			keyof Extract<EditorComponent, { type: 'unsupported' }>,
			'id' | 'type'
		>]?: Extract<EditorComponent, { type: 'unsupported' }>[K];
	}
): Extract<EditorComponent, { type: 'unsupported' }> {
	const { validation, ...rest } = info;
	return {
		id: nextComponentId(),
		logicalId: '',
		type: 'unsupported',
		sourceType: '',
		label: '',
		hint: '',
		disabled: false,
		readonly: false,
		hidden: false,
		validation: {
			required: false,
			customErrorMessages: {},
			...validation
		},
		...rest
	};
}

const COMPONENT_FACTORY_REGISTRY = {
	textbox: createTextbox,
	textarea: createTextarea,
	number: createNumber,
	checkbox: createCheckbox,
	radio: createRadio,
	dropdown: createDropdown,
	'dropdown-multi': createDropdownMulti,
	datepicker: createDatepicker,
	'date-span': createDateSpan,
	datetimepicker: createDatetimepicker,
	timepicker: createTimepicker,
	label: createLabel
} satisfies ComponentFactoryMap;

/**
 * Property 属性表で編集可能な type か判定する（ファクトリ登録済み）
 */
export function isPropertyEditableType(type: unknown): type is KnownComponentType {
	return typeof type === 'string' && Object.hasOwn(COMPONENT_FACTORY_REGISTRY, type);
}

/**
 * info.type に対応するファクトリでコンポーネントを作成する
 *
 * WARN: 未登録 type は hydrate で `unsupported` に閉じる。素通ししない。
 */
export function createComponentByType(info: unknown): EditorComponent {
	const record =
		info !== null && typeof info === 'object' && !Array.isArray(info)
			? (info as Record<string, unknown>)
			: {};
	const type = typeof record.type === 'string' ? record.type : '';
	if (!isPropertyEditableType(type)) {
		const existingId =
			typeof record.id === 'string' && record.id.trim() !== '' ? record.id : nextComponentId();
		return hydrateEditorComponent(record, existingId);
	}

	const factory = COMPONENT_FACTORY_REGISTRY[type];
	return factory(record as FactoryInit<typeof type>);
}
