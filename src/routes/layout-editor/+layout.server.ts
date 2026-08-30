import {
	DEFAULT_IR_AUTO_SAVE_COMMENT_DELAY_EXTRA,
	DEFAULT_IR_AUTO_SAVE_DELAY,
	type IrAutoSaveConfig
} from '$lib/config/application-types';
import { createEmptyUiDefinitionMeta, isValidLogicalId, toEditorMeta } from '$lib/ir/ui-definition-meta';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { readLatestSnapshotIfEnabled } from '$lib/server/io/ir-snapshot-io';
import type { LayoutServerLoad } from './$types';

/**
 * layout-editor クライアントへ渡す autoSave オプションを作る
 */
function toClientAutoSave(
	autoSave: IrAutoSaveConfig | undefined,
	enabled: boolean
): Pick<IrAutoSaveConfig, 'enabled' | 'delay' | 'commentDelayExtra'> {
	return {
		enabled,
		delay: autoSave?.delay ?? DEFAULT_IR_AUTO_SAVE_DELAY,
		commentDelayExtra: autoSave?.commentDelayExtra ?? DEFAULT_IR_AUTO_SAVE_COMMENT_DELAY_EXTRA
	};
}

/**
 * layout-editor 向け autoSave 設定と編集中 snapshot を返す
 */
export const load: LayoutServerLoad = async ({ url }) => {
	const config = loadApplicationConfig();
	const autoSave = config.ir?.autoSave;
	const preview = config.preview;
	const layoutEditor = config.layoutEditor;
	const defaultUiDefinition = createEmptyUiDefinitionMeta();
	const logicalIdParam = url.searchParams.get('logicalId')?.trim() ?? '';

	const baseDisabled = {
		autoSave: {
			...toClientAutoSave(autoSave, false),
			enabled: false as const
		},
		initialSnapshot: null as unknown[] | null,
		initialUiDefinition: null as ReturnType<typeof createEmptyUiDefinitionMeta> | null,
		initialComments: {} as Record<string, string>,
		layoutEditor,
		preview,
		uiDefinition: defaultUiDefinition
	};

	if (!autoSave?.enabled) {
		return baseDisabled;
	}

	const enabledAutoSave = {
		...toClientAutoSave(autoSave, true),
		enabled: true as const
	};

	if (logicalIdParam && isValidLogicalId(logicalIdParam)) {
		const latest = await readLatestSnapshotIfEnabled(logicalIdParam);

		if (latest) {
			const editorMeta = latest.uiDefinition
				? toEditorMeta(latest.uiDefinition)
				: { ...defaultUiDefinition, logicalId: logicalIdParam };

			return {
				autoSave: enabledAutoSave,
				initialSnapshot: latest.components,
				initialUiDefinition: editorMeta,
				initialComments: latest.comments,
				layoutEditor,
				preview,
				uiDefinition: editorMeta
			};
		}

		return {
			autoSave: enabledAutoSave,
			initialSnapshot: null,
			initialUiDefinition: null,
			initialComments: {},
			layoutEditor,
			preview,
			uiDefinition: {
				...defaultUiDefinition,
				logicalId: logicalIdParam
			}
		};
	}

	return {
		autoSave: enabledAutoSave,
		initialSnapshot: null,
		initialUiDefinition: null,
		initialComments: {},
		layoutEditor,
		preview,
		uiDefinition: defaultUiDefinition
	};
};
