import { readComponentLogicalId } from '$lib/projection/clone-component';
import type { IrProjectionPlugin, IrProjectionView } from '$lib/projection/types';

/** 射影プラグイン id */
export const BY_LOGICAL_ID_PLUGIN_ID = 'by-logical-id';

/**
 * 重複 logicalId の警告文を返す
 */
export function duplicateLogicalIdWarning(logicalId: string): string {
	return `projection by-logical-id: duplicate logicalId "${logicalId}" (last wins)`;
}

/**
 * components 配列から logicalId キーの map を組む
 *
 * 空 logicalId はスキップ。重複は last-wins。
 */
export function indexComponentsByLogicalId(
	components: readonly unknown[],
	warnings?: string[]
): Record<string, unknown> {
	const map: Record<string, unknown> = Object.create(null);

	for (const component of components) {
		const logicalId = readComponentLogicalId(component);
		if (logicalId === undefined) {
			continue;
		}

		if (warnings !== undefined && Object.prototype.hasOwnProperty.call(map, logicalId)) {
			warnings.push(duplicateLogicalIdWarning(logicalId));
		}

		map[logicalId] = component;
	}

	return map;
}

/**
 * `componentsByLogicalId` を view に足す
 */
export const byLogicalIdPlugin: IrProjectionPlugin = {
	id: BY_LOGICAL_ID_PLUGIN_ID,
	kind: 'index',
	/**
	 * componentsByLogicalId を付与した view を返す
	 */
	project(
		view: IrProjectionView,
		_options: Record<string, unknown> | undefined,
		warnings: string[]
	): IrProjectionView {
		return {
			...view,
			componentsByLogicalId: indexComponentsByLogicalId(view.components, warnings)
		};
	}
};
