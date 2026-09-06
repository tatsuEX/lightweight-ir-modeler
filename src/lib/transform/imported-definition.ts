import type { PersistedComponent } from '$lib/ir/elements/component-schema';
import type { UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';

/**
 * 外部 UI 定義の取り込み結果（Raw → IR の出力）
 *
 * WARN: components にエディタ用 `id` は含めない。採番は presentation 層（hydrate）の責務。
 */
export type ImportedDefinition = {
	uiDefinition: UiDefinitionEditorMeta;
	components: PersistedComponent[];
};
