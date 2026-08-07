import { createContext } from "svelte";
import { nanoid } from "nanoid";

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
}

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
    loadSnapshot(components: unknown[], meta?: {
        logicalId: string;
        name: string;
        description: string;
        version: string;
    }): void {
        if (meta) {
            this.logicalId = meta.logicalId;
            this.name = meta.name;
            this.description = meta.description;
            this.version = meta.version;
        }
        this.replaceComponents(structuredClone(components) as any[]);
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
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        validation: {
            required: false,
            pattern: '',
            maxlength: 30,
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
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        rows: 3,
        validation: {
            required: false,
            maxlength: 200,
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
        disabled: false,
        readonly: false,
        hidden: false,
        tooltip: '',
        validation: {
            required: false,
            min: undefined,
            max: undefined,
            step: 1,
            ...(validation ?? {}),
        },
        ...rest,
    };
}
