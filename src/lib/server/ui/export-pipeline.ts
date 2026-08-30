import {
	toEditorMeta,
	type UiDefinitionEditorMeta
} from '$lib/ir/ui-definition-meta';
import { validateRawDefinition } from '$lib/schema/validate-raw';
import {
	type DefinitionExportWriteResult,
	writeExportedDefinition
} from '$lib/server/io/definition-export-io';
import { readLatestSnapshotIfEnabled } from '$lib/server/io/ir-snapshot-io';
import { resolveExportTargetBundle } from '$lib/server/ui/export-target-registry';
import { getLogger, runLogged } from '$lib/server/logging/logger';

const logger = getLogger(import.meta.url);

/**
 * 編集中 IR から外部 UI 定義を出力する
 * Writer 前に JSON Schema → Zod で Raw を検証する
 */
export async function exportFromEditorState(
	targetId: string,
	editorMeta: UiDefinitionEditorMeta,
	components: unknown[]
): Promise<DefinitionExportWriteResult> {
	return runLogged(
		logger,
		'exportFromEditorState',
		{ targetId, logicalId: editorMeta.logicalId, componentCount: components.length },
		async () => {
			const bundle = resolveExportTargetBundle(targetId);
			if (!bundle) {
				throw new Error(`unsupported export target: ${targetId}`);
			}

			const raw = bundle.transform(editorMeta, components);
			runLogged(logger, 'validateRawDefinition', { targetId }, () => {
				validateRawDefinition(targetId, raw);
			});
			const artifact = bundle.writer.toArtifact(raw);

			return writeExportedDefinition(targetId, editorMeta.logicalId, artifact);
		}
	);
}

/**
 * 編集中 IR snapshot から外部 UI 定義を出力する
 */
export async function exportFromLatestSnapshot(
	targetId: string,
	logicalId: string
): Promise<DefinitionExportWriteResult> {
	return runLogged(logger, 'exportFromLatestSnapshot', { targetId, logicalId }, async () => {
		const snapshot = await readLatestSnapshotIfEnabled(logicalId);
		if (!snapshot?.uiDefinition) {
			throw new Error(`snapshot not found for logicalId: ${logicalId}`);
		}

		const editorMeta = toEditorMeta(snapshot.uiDefinition);
		return exportFromEditorState(targetId, editorMeta, snapshot.components);
	});
}
