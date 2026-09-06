/**
 * UI 定義 IR の集約（Svelte 非依存）
 *
 * 公開面は `meta` と `components`。フィールドごとの get/set は持たない。
 * 注入された object を mutate する。反応性の付け方は呼び出し側の責務。
 */

import { nanoid } from 'nanoid';
import {
	toLiveMeta,
	type UiDefinitionEditorMeta,
	type UiDefinitionLiveMeta
} from '$lib/ir/ui-definition-meta';
import {
	hydrateEditorComponent,
	hydrateEditorComponents,
	type EditorComponent
} from '$lib/ir/elements/component-schema';
import { SYSTEM_ID_LENGTH } from './elements/factories';

/**
 * 集約が保持するライブ document
 */
export type UIDefinitionData = {
	meta: UiDefinitionLiveMeta;
	components: EditorComponent[];
};

/**
 * 空のライブ document を作る
 */
export function createUiDefinitionData(
	init: Pick<UiDefinitionLiveMeta, 'logicalId' | 'name' | 'description' | 'version'>
): UIDefinitionData {
	return {
		meta: toLiveMeta({
			logicalId: init.logicalId,
			name: init.name,
			description: init.description,
			version: init.version
		}),
		components: []
	};
}

/**
 * プレーンな JSON 互換データを複製する（structuredClone できない値は JSON 経由）
 */
function clonePlainData<T>(value: T): T {
	if (value === undefined) {
		return value;
	}
	try {
		return structuredClone(value);
	} catch {
		// WARN: 関数混入時など。JSON 互換データ向けフォールバック。
		return JSON.parse(JSON.stringify(value)) as T;
	}
}

/**
 * component 用 id を読む。無ければ採番する
 */
function resolveEditorComponentId(value: unknown): string {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const id = (value as { id?: unknown }).id;
		if (typeof id === 'string' && id.trim() !== '') {
			return id;
		}
	}

	return nanoid(SYSTEM_ID_LENGTH);
}

/**
 * 画面定義（UI 定義 IR）を管理する
 */
export class UIDefinition {
	readonly meta: UiDefinitionLiveMeta;
	readonly components: EditorComponent[];

	/**
	 * 注入された meta / components で画面定義を初期化する
	 */
	constructor(data: UIDefinitionData) {
		this.meta = data.meta;
		this.components = data.components;
	}

	/**
	 * 画面定義のコンポーネントを追加する
	 */
	append(info: unknown): void {
		const id = resolveEditorComponentId(info);
		this.components.push(hydrateEditorComponent(info, id));
	}

	/**
	 * 画面定義のコンポーネントを削除する
	 */
	remove(info: { id: string }): void {
		const index = this.components.findIndex((elm) => elm.id === info.id);

		if (index !== -1) {
			this.components.splice(index, 1);
		}
	}

	/**
	 * 指定 id のコンポーネントを一括削除する
	 */
	removeByIds(ids: Iterable<string>): void {
		const idSet = new Set(ids);
		this.replaceComponents(this.components.filter((component) => !idSet.has(component.id)));
	}

	/**
	 * 画面定義のコンポーネントを移動する
	 */
	moveItem(fromIndex: number, toIndex: number): void {
		const [item] = this.components.splice(fromIndex, 1);
		this.components.splice(toIndex, 0, item);
	}

	/**
	 * 画面定義のコンポーネントを全件置き換える
	 */
	replaceComponents(items: unknown[]): void {
		this.components.splice(
			0,
			this.components.length,
			...hydrateEditorComponents(items, resolveEditorComponentId)
		);
	}

	/**
	 * snapshot から画面定義を復元する
	 */
	loadSnapshot(components: unknown[], meta?: UiDefinitionEditorMeta): void {
		if (meta) {
			const live = toLiveMeta(clonePlainData(meta));
			delete this.meta.external;
			Object.assign(this.meta, live);
		}
		this.replaceComponents(clonePlainData(components));
	}
}
