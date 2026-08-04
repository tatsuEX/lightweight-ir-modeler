import { createContext } from "svelte";
import { nanoid } from "nanoid";

// 画面定義の状態を管理するコンテキスト
export const [getUIDefinitionContext, setUIDefinitionContext] = createContext<UIDefinition>();

/**
 * 画面定義の状態を管理するクラス
 */
export class UIDefinition {
    #components = $state<any[]>([]);

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
}

// 注意: ファクトリの引数/戻り値は IR 要素モデル確定後に型設計する。現状は any。
// 注意: validation をデフォルトとマージしたあと ...rest する。...info だと部分指定で他デフォルトが消える。

/**
 * テキストボックスを作成する
 */
export function createTextbox(info: any): any {
    const { validation, ...rest } = info;
    return {
        id: nanoid(16),
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
        id: nanoid(16),
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
        id: nanoid(16),
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
