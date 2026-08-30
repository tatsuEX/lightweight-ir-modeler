/**
 * UI 定義のIR (中間定義) データモデルおよび状態を管理する
 * UIコンポーネント個別定義のデータモデルを生成するファクトリ関数を提供する
 */

import { createContext } from "svelte";
import { nanoid } from "nanoid";
import type { ExternalResidual } from "$lib/ir/external-residual";
import type { UiDefinitionEditorMeta } from "$lib/ir/ui-definition-meta";
import type { ImportedDefinition } from "$lib/transform/imported-definition";

// 画面定義の状態を管理するコンテキスト
export const [getUIDefinitionContext, setUIDefinitionContext] = createContext<UIDefinition>();

// システム ID の長さ
const SYSTEM_ID_LENGTH = 24;

/**
 * 画面定義の状態を管理するクラス
 */
export type UIDefinitionState = {
    id: string;
    logicalId: string;
    name: string;
    description: string;
    version: string;
    external?: ExternalResidual;
}

/**
 * 画面定義を管理するクラス
 */
export class UIDefinition {
    #state = $state<UIDefinitionState>({
        id: '',
        logicalId: '',
        name: '',
        description: '',
        version: '',
    });
    #components = $state<any[]>([]);

    /**
     * 画面定義を初期化する
     */
    constructor(logicalId: string, name: string, description: string, version: string) {
        this.#state.id = nanoid(SYSTEM_ID_LENGTH);
        this.#state.logicalId = logicalId;
        this.#state.name = name;
        this.#state.description = description;
        this.#state.version = version;
    }

    /**
     * 画面定義の ID を取得する
     */
    get id(): string {
        return this.#state.id;
    }

    /**
     * 画面定義の論理 ID を取得する
     */
    get logicalId(): string {
        return this.#state.logicalId;
    }

    /**
     * 画面定義の論理 ID を設定する
     */
    set logicalId(value: string) {
        this.#state.logicalId = value;
    }

    /**
     * 画面定義の名前を取得する
     */
    get name(): string {
        return this.#state.name;
    }

    /**
     * 画面定義の名前を設定する
     */
    set name(value: string) {
        this.#state.name = value;
    }

    /**
     * 画面定義の説明を取得する
     */
    get description(): string {
        return this.#state.description;
    }

    /**
     * 画面定義の説明を設定する
     */
    set description(value: string) {
        this.#state.description = value;
    }

    /**
     * 画面定義のバージョンを取得する
     */
    get version(): string {
        return this.#state.version;
    }

    /**
     * 画面定義のバージョンを設定する
     */
    set version(value: string) {
        this.#state.version = value;
    }

    /**
     * 外部定義由来の残余（ベンダー固有キー）を取得する
     */
    get external(): ExternalResidual | undefined {
        return this.#state.external;
    }

    /**
     * 外部定義由来の残余（ベンダー固有キー）を設定する
     */
    set external(value: ExternalResidual | undefined) {
        this.#state.external = value;
    }

    /**
     * 画面定義のコンポーネントを取得する
     */
    get components(): readonly any[] {
        return this.#components;
    }

    /**
     * 画面定義のコンポーネントを追加する
     */
    append(info: any) {
        if (info.id == null || info.id.trim() === '') {
        info.id = nanoid(16);
        }
        this.#components.push(info);
    }

    /**
     * 画面定義のコンポーネントを削除する
     */
    remove(info: any) {
        const index = this.#components.findIndex((elm) => elm.id === info.id);

        if (index !== -1) {
        this.#components.splice(index, 1);
        }
    }

    /**
     * 指定 id のコンポーネントを一括削除する
     */
    removeByIds(ids: Iterable<string>): void {
        const idSet = new Set(ids);
        this.replaceComponents(this.#components.filter((component) => !idSet.has(component.id)));
    }

    /**
     * 画面定義のコンポーネントを移動する
     */
    moveItem(fromIndex: number, toIndex: number) {
        const [item] = this.#components.splice(fromIndex, 1);
        this.#components.splice(toIndex, 0, item);
    }

    /**
     * 画面定義のコンポーネントを全件置き換える
     */
    replaceComponents(items: any[]) {
        this.#components.splice(
        0,
        this.#components.length,
        ...items
        );
    }

    /**
     * snapshot から画面定義を復元する
     */
    loadSnapshot(components: unknown[], meta?: UiDefinitionEditorMeta): void {
        if (meta) {
            this.logicalId = meta.logicalId;
            this.name = meta.name;
            this.description = meta.description;
            this.version = meta.version;
            this.external = clonePlainData(meta.external);
        }
        this.replaceComponents(clonePlainData(components) as any[]);
    }

    /**
     * 外部 UI 定義の取り込み結果で編集状態を丸ごと置き換える
     */
    loadImported(imported: ImportedDefinition): void {
        const plain = clonePlainData(imported);
        this.loadSnapshot(
            plain.components.map((component) => createComponentByType(component)),
            plain.uiDefinition
        );
    }
}

/**
 * プレーンな JSON 互換データを複製する（Svelte Proxy 等で structuredClone が失敗したら JSON 経由）
 */
function clonePlainData<T>(value: T): T {
    if (value === undefined) {
        return value;
    }
    try {
        return structuredClone(value);
    } catch {
        // WARN: Proxy / 関数混入時。importBase 等の JSON 互換データ向けフォールバック。
        return JSON.parse(JSON.stringify(value)) as T;
    }
}

// 注意: ファクトリの引数/戻り値は IR 要素モデル確定後に型設計する。現状は any。
// 注意: validation をデフォルトとマージしたあと ...rest する。...info だと部分指定で他デフォルトが消える。

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
