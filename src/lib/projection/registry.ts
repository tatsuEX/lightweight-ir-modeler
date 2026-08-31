import { byLogicalIdPlugin } from '$lib/projection/plugins/by-logical-id';
import { dbMaxlengthPlugin } from '$lib/projection/plugins/db-maxlength';
import type { IrProjectionPlugin } from '$lib/projection/types';

/**
 * コンパイル時の射影プラグイン registry
 */
export const PROJECTION_PLUGIN_REGISTRY: Readonly<Record<string, IrProjectionPlugin>> = {
	[dbMaxlengthPlugin.id]: dbMaxlengthPlugin,
	[byLogicalIdPlugin.id]: byLogicalIdPlugin
};

/**
 * 未知の射影プラグイン id に対するエラー文を返す
 */
export function unknownProjectionPluginError(pluginId: string): string {
	return `unknown projection plugin: ${pluginId}`;
}

/**
 * 要求された id を、変更系 → 索引系の順に並べ替える
 *
 * 同一 kind 内は registry 定義順。呼び出し側のカンマ順には依存しない。
 */
export function orderProjectionIds(projectionIds: readonly string[]): string[] {
	const seen = new Set<string>();

	for (const rawId of projectionIds) {
		const pluginId = rawId.trim();
		if (pluginId === '' || seen.has(pluginId)) {
			continue;
		}

		if (!(pluginId in PROJECTION_PLUGIN_REGISTRY)) {
			throw new Error(unknownProjectionPluginError(pluginId));
		}

		seen.add(pluginId);
	}

	const transformIds: string[] = [];
	const indexIds: string[] = [];
	for (const plugin of Object.values(PROJECTION_PLUGIN_REGISTRY)) {
		if (!seen.has(plugin.id)) {
			continue;
		}

		if (plugin.kind === 'transform') {
			transformIds.push(plugin.id);
		} else {
			indexIds.push(plugin.id);
		}
	}

	return [...transformIds, ...indexIds];
}
