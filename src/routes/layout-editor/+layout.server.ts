import {
	DEFAULT_IR_AUTO_SAVE_COMMENT_DELAY_EXTRA,
	DEFAULT_IR_AUTO_SAVE_DELAY,
	type IrAutoSaveConfig
} from '$lib/config/application-types';
import {
	createEmptyIntentTagCatalogView,
	type IntentTagCatalogView
} from '$lib/ir/intent-tags';
import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';
import { createEmptyUiDefinitionMeta, isValidLogicalId, toEditorMeta } from '$lib/ir/ui-definition-meta';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { readIntentTagCatalog } from '$lib/server/io/intent-tag-catalog-io';
import { readLatestSnapshotIfEnabled } from '$lib/server/io/ir-snapshot-io';
import { toSnapshotSchemaBlock } from '$lib/server/io/snapshot-http-error';
import { getLogger } from '$lib/server/logging/logger';
import type { LayoutServerLoad } from './$types';

const logger = getLogger(import.meta.url);

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
 * Intent Tags マスタを読む
 *
 * WARN: マスタの不備で layout-editor 全体を開けなくしない。理由は loadError で GUI に出す。
 */
async function loadIntentTagCatalog(): Promise<IntentTagCatalogView> {
	try {
		return await readIntentTagCatalog();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error('intent tag catalog load failed', { errorMessage: message });
		return createEmptyIntentTagCatalogView(message);
	}
}

/**
 * layout-editor 向け autoSave 設定と編集中 snapshot を返す
 */
export const load: LayoutServerLoad = async ({ url }) => {
	const config = loadApplicationConfig();
	const autoSave = config.ir?.autoSave;
	const preview = config.preview;
	const layoutEditor = config.layoutEditor;
	const uiDefinitionValidation = config.uiDefinition.validation;
	const intentTagCatalog = await loadIntentTagCatalog();
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
		uiDefinitionValidation,
		intentTagCatalog,
		preview,
		uiDefinition: defaultUiDefinition,
		schemaBlock: null as SnapshotSchemaBlock | null
	};

	if (!autoSave?.enabled) {
		return baseDisabled;
	}

	const enabledAutoSave = {
		...toClientAutoSave(autoSave, true),
		enabled: true as const
	};

	if (logicalIdParam && isValidLogicalId(logicalIdParam)) {
		try {
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
					uiDefinitionValidation,
					intentTagCatalog,
					preview,
					uiDefinition: editorMeta,
					schemaBlock: null
				};
			}
		} catch (error) {
			const schema = toSnapshotSchemaBlock(error);
			if (!schema) {
				throw error;
			}

			return {
				autoSave: enabledAutoSave,
				initialSnapshot: null,
				initialUiDefinition: null,
				initialComments: {},
				layoutEditor,
				uiDefinitionValidation,
				intentTagCatalog,
				preview,
				uiDefinition: {
					...defaultUiDefinition,
					logicalId: logicalIdParam
				},
				schemaBlock: schema.block
			};
		}

		return {
			autoSave: enabledAutoSave,
			initialSnapshot: null,
			initialUiDefinition: null,
			initialComments: {},
			layoutEditor,
			uiDefinitionValidation,
			intentTagCatalog,
			preview,
			uiDefinition: {
				...defaultUiDefinition,
				logicalId: logicalIdParam
			},
			schemaBlock: null
		};
	}

	return {
		autoSave: enabledAutoSave,
		initialSnapshot: null,
		initialUiDefinition: null,
		initialComments: {},
		layoutEditor,
		uiDefinitionValidation,
		intentTagCatalog,
		preview,
		uiDefinition: defaultUiDefinition,
		schemaBlock: null
	};
};
