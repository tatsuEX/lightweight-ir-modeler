import { json } from '@sveltejs/kit';
import {
	isUiDefinitionMetaReady,
	isValidLogicalId,
	parseEditorMetaFromRecord
} from '$lib/ir/ui-definition-meta';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { exportFromEditorState } from '$lib/server/ui/export-pipeline';
import { resolveExportTargetBundle } from '$lib/server/ui/export-target-registry';
import type { RequestHandler } from './$types';

/**
 * 編集中 UI 定義を外部形式として exportDir へ出力する
 */
export const POST: RequestHandler = async ({ request }) => {
	const config = loadApplicationConfig();
	if (!config.app.io?.exportDir) {
		return json({ error: 'app.io.exportDir is not configured' }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid JSON body' }, { status: 400 });
	}

	if (body === null || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'body must be an object' }, { status: 400 });
	}

	const record = body as Record<string, unknown>;
	const target = typeof record.target === 'string' ? record.target.trim() : '';
	if (!target || !resolveExportTargetBundle(target)) {
		return json({ error: 'unsupported or missing target' }, { status: 400 });
	}

	const components = record.components;
	if (!Array.isArray(components)) {
		return json({ error: 'components must be an array' }, { status: 400 });
	}

	const uiDefinitionRaw = record.uiDefinition;
	if (
		uiDefinitionRaw === null ||
		typeof uiDefinitionRaw !== 'object' ||
		Array.isArray(uiDefinitionRaw)
	) {
		return json({ error: 'uiDefinition must be an object' }, { status: 400 });
	}

	const editorMeta = parseEditorMetaFromRecord(uiDefinitionRaw as Record<string, unknown>);
	if (!isUiDefinitionMetaReady(editorMeta) || !isValidLogicalId(editorMeta.logicalId)) {
		return json(
			{ error: 'uiDefinition.logicalId and uiDefinition.name are required' },
			{ status: 400 }
		);
	}

	try {
		const result = await exportFromEditorState(target, editorMeta, components);
		return json(
			{
				target: result.targetId,
				logicalId: result.logicalId,
				relativePath: result.relativePath,
				filename: result.filename,
				writtenAt: result.writtenAt
			},
			{ status: 201 }
		);
	} catch (error) {
		if (error instanceof RawValidationError) {
			return json(
				{ error: error.message, target: error.targetId, issues: error.issues },
				{ status: 400 }
			);
		}
		console.warn('[api/ui/export] write failed:', error);
		return json({ error: 'failed to export UI definition' }, { status: 500 });
	}
};
