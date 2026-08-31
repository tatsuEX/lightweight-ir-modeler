import { cloneComponent } from '$lib/projection/clone-component';
import {
	orderProjectionIds,
	PROJECTION_PLUGIN_REGISTRY,
	unknownProjectionPluginError
} from '$lib/projection/registry';
import {
	DEFAULT_PROJECTION_IDS,
	type ApplyProjectionsOptions,
	type ApplyProjectionsResult,
	type IrProjectionView
} from '$lib/projection/types';
import type { RestoredIrSnapshot } from '$lib/ir/snapshot';

/**
 * 復元済み IR から読み取り専用の射影 view を作る
 *
 * `projectionIds` 省略時は射影なし（envelope の浅いコピーのみ）。
 * 未知 id は throw。適用順はモジュールが決める（transform → index）。
 *
 * WARN: 戻り値を snapshot や store に書き戻してはならない。
 */
export function applyProjections(
	snapshot: RestoredIrSnapshot,
	options?: ApplyProjectionsOptions
): ApplyProjectionsResult {
	const projectionIds = options?.projectionIds ?? DEFAULT_PROJECTION_IDS;
	const orderedIds = orderProjectionIds(projectionIds);
	const warnings: string[] = [];

	if (orderedIds.length === 0) {
		return {
			view: {
				version: snapshot.version,
				savedAt: snapshot.savedAt,
				uiDefinition: snapshot.uiDefinition,
				components: snapshot.components
			},
			warnings
		};
	}

	let view: IrProjectionView = {
		version: snapshot.version,
		savedAt: snapshot.savedAt,
		uiDefinition: snapshot.uiDefinition,
		components: snapshot.components.map(cloneComponent)
	};

	for (const pluginId of orderedIds) {
		const plugin = PROJECTION_PLUGIN_REGISTRY[pluginId];
		if (plugin === undefined) {
			throw new Error(unknownProjectionPluginError(pluginId));
		}

		view = plugin.project(view, options?.pluginOptions?.[pluginId], warnings);
	}

	return { view, warnings };
}
