import { loadApplicationConfig } from '$lib/server/config/application-config';
import { readLatestSnapshotIfEnabled } from '$lib/server/io/ir-snapshot-io';
import type { LayoutServerLoad } from './$types';

/**
 * layout-editor 向け autoSave 設定と最新 snapshot を返す
 */
export const load: LayoutServerLoad = async () => {
	const config = loadApplicationConfig();
	const autoSave = config.ir?.autoSave;

	if (!autoSave?.enabled) {
		return {
			autoSave: {
				enabled: false as const,
				delay: autoSave?.delay ?? 500
			},
			initialSnapshot: null
		};
	}

	const latest = await readLatestSnapshotIfEnabled();

	return {
		autoSave: {
			enabled: true as const,
			delay: autoSave.delay
		},
		initialSnapshot: latest?.components ?? null
	};
};
