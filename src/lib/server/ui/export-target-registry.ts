import type { UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import type { DefinitionWriter } from '$lib/server/io/writers/definition-writer';
import { IMFormaWriter } from '$lib/server/io/writers/im-forma-writer';
import { PrimeFacesWriter } from '$lib/server/io/writers/primefaces-writer';
import { transformToImFormaRaw } from '$lib/transform/im-forma-transform';
import { transformToPrimeFacesRaw } from '$lib/transform/primefaces-transform';
import { getLogger, runLogged } from '$lib/server/logging/logger';

const logger = getLogger(import.meta.url);

/**
 * 出力ターゲット一式（transform / writer）
 * Raw validate は pipeline が JSON Schema → Zod で行う（Writer 前）
 */
export type ExportTargetBundle = {
	targetId: string;
	transform: (meta: UiDefinitionEditorMeta, components: unknown[]) => RawDefinition;
	writer: DefinitionWriter;
};

const EXPORT_TARGET_REGISTRY: Record<string, ExportTargetBundle> = {
	primefaces: {
		targetId: 'primefaces',
		transform: (meta, components) =>
			runLogged(
				logger,
				'transformToPrimeFacesRaw',
				{ targetId: 'primefaces', logicalId: meta.logicalId, componentCount: components.length },
				() => transformToPrimeFacesRaw(meta, components)
			),
		writer: new PrimeFacesWriter()
	},
	'im-forma': {
		targetId: 'im-forma',
		transform: (meta, components) =>
			runLogged(
				logger,
				'transformToImFormaRaw',
				{ targetId: 'im-forma', logicalId: meta.logicalId, componentCount: components.length },
				() => transformToImFormaRaw(meta, components)
			),
		writer: new IMFormaWriter()
	}
};

/**
 * targetId に対応する出力バンドルを解決する
 */
export function resolveExportTargetBundle(targetId: string): ExportTargetBundle | undefined {
	return EXPORT_TARGET_REGISTRY[targetId];
}

/**
 * 登録済み targetId 一覧を返す
 */
export function listExportTargetIds(): string[] {
	return Object.keys(EXPORT_TARGET_REGISTRY);
}
