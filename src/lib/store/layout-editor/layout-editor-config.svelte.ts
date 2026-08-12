import { getContext, setContext } from 'svelte';
import type { LayoutEditorConfig } from '$lib/config/layout-editor-config';

const LAYOUT_EDITOR_CONFIG_CONTEXT_KEY = 'layout-editor-config';

/**
 * layout-editor 設定を Context に載せる
 */
export function setLayoutEditorConfigContext(config: LayoutEditorConfig): void {
	setContext(LAYOUT_EDITOR_CONFIG_CONTEXT_KEY, config);
}

/**
 * layout-editor 設定を Context から取得する
 */
export function getLayoutEditorConfigContext(): LayoutEditorConfig {
	const config = getContext<LayoutEditorConfig | undefined>(LAYOUT_EDITOR_CONFIG_CONTEXT_KEY);
	if (!config) {
		throw new Error('LayoutEditorConfig context is not set');
	}
	return config;
}
