/**
 * UI 定義の Svelte 反応状態と Context
 */

import { createContext } from 'svelte';
import { createUiDefinitionData, UIDefinition } from '$lib/ir/ui-definition';
import { createComponentByType } from '$lib/ir/elements/factories';
import type { ImportedDefinition } from '$lib/transform/imported-definition';

export { UIDefinition } from '$lib/ir/ui-definition';

/** 画面定義の状態を管理するコンテキスト */
export const [getUIDefinitionContext, setUIDefinitionContext] = createContext<UIDefinition>();

/**
 * `$state` 化した meta / components を注入した画面定義を作る
 */
export function createReactiveUIDefinition(
	logicalId: string,
	name: string,
	description: string,
	version: string
): UIDefinition {
	const seed = createUiDefinitionData({ logicalId, name, description, version });
	const meta = $state(seed.meta);
	const components = $state(seed.components);
	return new UIDefinition({ meta, components });
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

/**
 * 外部 UI 定義の取り込み結果で編集状態を丸ごと置き換える
 */
export function loadImported(ui: UIDefinition, imported: ImportedDefinition): void {
	const plain = clonePlainData(imported);
	ui.loadSnapshot(
		plain.components.map((component) => createComponentByType(component)),
		plain.uiDefinition
	);
}
