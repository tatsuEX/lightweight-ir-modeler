/**
 * UI 定義の Svelte 反応状態と Context
 */

import { createContext } from 'svelte';
import { createUiDefinitionData, UIDefinition } from '$lib/ir/ui-definition';
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
 * 外部 UI 定義の取り込み結果で編集状態を丸ごと置き換える
 *
 * WARN: ファクトリを通さない。既定値と id は `loadSnapshot` の hydrate だけが補う。
 */
export function loadImported(ui: UIDefinition, imported: ImportedDefinition): void {
	ui.loadSnapshot(imported.components, imported.uiDefinition);
}
