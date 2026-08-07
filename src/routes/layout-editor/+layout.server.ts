import { createEmptyUiDefinitionMeta, isValidLogicalId, toEditorMeta } from '$lib/ir/ui-definition-meta';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { readLatestSnapshotIfEnabled } from '$lib/server/io/ir-snapshot-io';
import type { LayoutServerLoad } from './$types';

/**
 * layout-editor 向け autoSave 設定と最新 snapshot を返す
 */
export const load: LayoutServerLoad = async ({ url }) => {
	const config = loadApplicationConfig();
	const autoSave = config.ir?.autoSave;
	const preview = config.preview;
	const defaultUiDefinition = createEmptyUiDefinitionMeta();
	const logicalIdParam = url.searchParams.get('logicalId')?.trim() ?? '';

	const baseDisabled = {
		autoSave: {
			enabled: false as const,
			delay: autoSave?.delay ?? 500
		},
		initialSnapshot: null as unknown[] | null,
		initialUiDefinition: null as ReturnType<typeof createEmptyUiDefinitionMeta> | null,
		preview,
		uiDefinition: defaultUiDefinition
	};

	if (!autoSave?.enabled) {
		return baseDisabled;
	}

	if (logicalIdParam && isValidLogicalId(logicalIdParam)) {
		const latest = await readLatestSnapshotIfEnabled(logicalIdParam);

		if (latest) {
			const editorMeta = latest.uiDefinition
				? toEditorMeta(latest.uiDefinition)
				: { ...defaultUiDefinition, logicalId: logicalIdParam };

			return {
				autoSave: {
					enabled: true as const,
					delay: autoSave.delay
				},
				initialSnapshot: latest.components,
				initialUiDefinition: editorMeta,
				preview,
				uiDefinition: editorMeta
			};
		}

		return {
			autoSave: {
				enabled: true as const,
				delay: autoSave.delay
			},
			initialSnapshot: null,
			initialUiDefinition: null,
			preview,
			uiDefinition: {
				...defaultUiDefinition,
				logicalId: logicalIdParam
			}
		};
	}

	return {
		autoSave: {
			enabled: true as const,
			delay: autoSave.delay
		},
		initialSnapshot: null,
		initialUiDefinition: null,
		preview,
		uiDefinition: defaultUiDefinition
	};
};
