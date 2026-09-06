/**
 * UI 定義コンポーネントの既定値ファクトリ
 *
 * WARN: 引数/戻り値の型は IR 要素モデル確定後に設計する。現状は any。
 * WARN: validation をデフォルトとマージしたあと ...rest する。...info だと部分指定で他デフォルトが消える。
 */

import { nanoid } from 'nanoid';

/** コンポーネント system id の長さ */
const SYSTEM_ID_LENGTH = 24;

/**
 * テキストボックスを作成する
 */
export function createTextbox(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'textbox',
        label: '',
        hint: '',
        defaultValue: '',
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        validation: {
            required: false,
            pattern: '',
            minlength: 0,
            maxlength: 30,
            customErrorMessages: {
                required: '必須項目です',
                pattern: '不正な形式です',
                minlength: '最小文字数を超えています',
                maxlength: '最大文字数を超えています',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * テキストエリアを作成する
 */
export function createTextarea(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'textarea',
        label: '',
        hint: '',
        defaultValue: '',
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        cols: 30,
        rows: 3,
        autosize: false,
        validation: {
            required: false,
            minlength: 0,
            maxlength: 200,
            customErrorMessages: {
                required: '必須項目です',
                minlength: '最小文字数を超えています',
                maxlength: '最大文字数を超えています',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * 数値入力を作成する
 */
export function createNumber(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'number',
        label: '',
        hint: '',
        defaultValue: null,
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        validation: {
            required: false,
            min: undefined,
            max: undefined,
            scale: 0,
            step: 1,
            customErrorMessages: {
                required: '必須項目です',
                min: '最小値を超えています',
                max: '最大値を超えています',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}


/**
 * チェックボックスを作成する
 * usage:
 *   - items: { label: string; value: string }[]
 *     - items: [{ label: '日', value: 'sun' }, { label: '月', value: 'mon' }, { label: '火', value: 'tue' }, { label: '水', value: 'wed' }, { label: '木', value: 'thu' }, { label: '金', value: 'fri' }, { label: '土', value: 'sat' }]
 */
export function createCheckbox(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'checkbox',
        label: '',
        hint: '',
        defaultValue: [],
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        items: [
        ],
        validation: {
            required: false,
            customErrorMessages: {
                required: '必須項目です',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * ラジオボタンを作成する
 * usage:
 *   - items: string[]
 *     - items: ['price-0', 'price-3', 'price-9', 'price-10']
 *   - items: { label: string; value: string }[]
 *     - items: [{ label: '～5,000 円', value: 'price-0' }, { label: '～20,000 円', value: 'price-3' }, { label: '～50,000 円', value: 'price-9' }, { label: '50,000 円～', value: 'price-10' }]
 */
export function createRadio(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'radio',
        label: '',
        hint: '',
        defaultValue: '',
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        items: [
        ],
        validation: {
            required: false,
            customErrorMessages: {
                required: '必須項目です',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * ドロップダウンリストを作成する
 * usage:
 *   - items: { label: string; value: string }[]
 *     - items: [{ label: '人気順', value: 'popular' }, { label: '新着順', value: 'new' }, { label: '価格の安い順', value: 'price-asc' }, { label: '価格の高い順', value: 'price-desc' }]
 */
export function createDropdown(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'dropdown',
        label: '',
        hint: '',
        defaultValue: '',
        multiple: false,
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        items: [
        ],
        validation: {
            required: false,
            customErrorMessages: {
                required: '必須項目です',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * ドロップダウンリストを作成する
 * usage:
 *   - items: { label: string; value: string }[]
 *     - items: [{ label: '人気順', value: 'popular' }, { label: '新着順', value: 'new' }, { label: '価格の安い順', value: 'price-asc' }, { label: '価格の高い順', value: 'price-desc' }]
 */
export function createDropdownMulti(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'dropdown-multi',
        label: '',
        hint: '',
        defaultValue: [],
        multiple: true,
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        items: [
        ],
        validation: {
            required: false,
            customErrorMessages: {
                required: '必須項目です',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * 日付ピッカーを作成する
 */
export function createDatepicker(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
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
        tooltip: '',
        validation: {
            required: false,
            minDate: undefined,
            maxDate: undefined,
            customErrorMessages: {
                required: '必須項目です',
                minDate: '最小日付を超えています',
                maxDate: '最大日付を超えています',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * 日付範囲ピッカーを作成する
 */
export function createDateSpan(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
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
            minDate: undefined,
            maxDate: undefined,
            customErrorMessages: {
                required: '必須項目です',
                requiredFrom: '開始日は必須項目です',
                requiredTo: '終了日は必須項目です',
                minDate: '最小日付を超えています',
                maxDate: '最大日付を超えています',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * 時刻ピッカーを作成する
 */
export function createDatetimepicker(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
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
        tooltip: '',
        validation: {
            required: false,
            minDateTime: undefined,
            maxDateTime: undefined,
            customErrorMessages: {
                required: '必須項目です',
                minDateTime: '最小日時を超えています',
                maxDateTime: '最大日時を超えています',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * 時間ピッカーを作成する
 */
export function createTimepicker(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
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
        tooltip: '',
        validation: {
            required: false,
            minTime: undefined,
            maxTime: undefined,
            customErrorMessages: {
                required: '必須項目です',
                minTime: '最小時間を超えています',
                maxTime: '最大時間を超えています',
            },
            ...(validation ?? {}),
        },
        ...rest,
    };
}

/**
 * ラベルを作成する
 */
export function createLabel(info: any): any {
    const { ...rest } = info;
    return {
        id: nanoid(SYSTEM_ID_LENGTH),
        logicalId: '',
        type: 'label',
        label: '',
        defaultValue: '',
        ...rest,
    };
}

// type とファクトリの対応表
const COMPONENT_FACTORY_REGISTRY: Record<string, (info: any) => any> = {
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
    label: createLabel,
};

/**
 * Property 属性表で編集可能な type か判定する（ファクトリ登録済み）
 */
export function isPropertyEditableType(type: unknown): boolean {
    return typeof type === 'string' && Object.hasOwn(COMPONENT_FACTORY_REGISTRY, type);
}

/**
 * info.type に対応するファクトリでコンポーネントを作成する
 *
 * WARN: 未登録 type はデフォルトを補えないため、id だけ付けて素通しする。
 */
export function createComponentByType(info: any): any {
    const factory = COMPONENT_FACTORY_REGISTRY[info?.type];

    if (!factory) {
        return { id: nanoid(SYSTEM_ID_LENGTH), ...info };
    }

    return factory(info);
}
