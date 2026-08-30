	import { json } from '@sveltejs/kit';
	import { isUiDefinitionMetaReady, isValidLogicalId, parseEditorMetaFromRecord } from '$lib/ir/ui-definition-meta';
	import { loadApplicationConfig } from '$lib/server/config/application-config';
	import { readLatestSnapshotIfEnabled, writeSnapshot } from '$lib/server/io/ir-snapshot-io';
	import { getLogger } from '$lib/server/logging/logger';
	import { parseYamlCommentMap } from '$lib/utils/yaml-comments';
	import type { RequestHandler } from './$types';

const logger = getLogger(import.meta.url);

/**
 * logicalId 別ディレクトリの最新 snapshot を取得する
 * GET /api/ir/snapshot?logicalId=...
 */
export const GET: RequestHandler = async ({ url }) => {
	const config = loadApplicationConfig();

	// autoSave 設定が無効な場合はエラーを返す
	if (!config.ir?.autoSave?.enabled) {
		return json({ error: 'autoSave is disabled' }, { status: 403 });
	}

	// logicalId を URL パラメータから取得する
	const logicalId = url.searchParams.get('logicalId')?.trim() ?? '';
	if (!isValidLogicalId(logicalId)) {
		return json({ error: 'logicalId is required and must be a valid identifier' }, { status: 400 });
	}

	try {
		// 最新 snapshot を取得する
		const snapshot = await readLatestSnapshotIfEnabled(logicalId);
		if (!snapshot) {
			return json({ error: 'snapshot not found' }, { status: 404 });
		}

		// 最新 snapshot を JSON として返す
		return json(snapshot);
	} catch (error) {
		logger.error('snapshot read failed', { errorMessage: error instanceof Error ? error.message : String(error) });
		return json({ error: 'failed to read snapshot' }, { status: 500 });
	}
};

/**
 * 編集中 UI 定義の snapshot を保存する  
 * POST /api/ir/snapshot  
 * payload: {  
 *   uiDefinition: {  
 *     logicalId: string;  
 *     name: string; 
 *     description: string; 
 *     version: string; 
 *   }; 
 *   components: unknown[]; 
 *   comments: Record<string, string>; 
 * }  
 */
export const POST: RequestHandler = async ({ request }) => {
	const config = loadApplicationConfig();
	if (!config.ir?.autoSave?.enabled) {
		return json({ error: 'autoSave is disabled' }, { status: 403 });
	}

	// リクエストボディを JSON としてパースする
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

	// validate comopnents
	const components = record.components;
	if (!Array.isArray(components)) {
		return json({ error: 'components must be an array' }, { status: 400 });
	}

	// validate uiDefinition
	const uiDefinitionRaw = record.uiDefinition;
	if (
		uiDefinitionRaw === null ||
		typeof uiDefinitionRaw !== 'object' ||
		Array.isArray(uiDefinitionRaw)
	) {
		return json({ error: 'uiDefinition must be an object' }, { status: 400 });
	}

	const uiDefinitionRecord = uiDefinitionRaw as Record<string, unknown>;
	const editorMeta = parseEditorMetaFromRecord(uiDefinitionRecord);

	if (!isUiDefinitionMetaReady(editorMeta) || !isValidLogicalId(editorMeta.logicalId)) {
		return json({ error: 'uiDefinition.logicalId and uiDefinition.name are required' }, { status: 400 });
	}

	let comments;
	try {
		comments = parseYamlCommentMap(record.comments);
	} catch {
		return json({ error: 'comments must be a mapping of path to string' }, { status: 400 });
	}

	try {
		const result = await writeSnapshot(editorMeta, components, comments);
		return json(result, { status: result.skipped ? 200 : 201 });
	} catch (error) {
		logger.error('snapshot write failed', { errorMessage: error instanceof Error ? error.message : String(error) });
		return json({ error: 'failed to write snapshot' }, { status: 500 });
	}
};
