import { json } from '@sveltejs/kit';
import { isValidLogicalId } from '$lib/ir/ui-definition-meta';
import type { PublishKind } from '$lib/ir/snapshot-version';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { IrSnapshotRequestError, publishSnapshot } from '$lib/server/io/ir-snapshot-io';
import { getLogger } from '$lib/server/logging/logger';
import type { RequestHandler } from './$types';

const logger = getLogger(import.meta.url);

/**
 * リクエスト body から確定系統を取り出す
 */
function parsePublishKind(value: unknown): PublishKind | null {
	if (value === undefined) {
		return 'revision';
	}
	if (value === 'revision' || value === 'patch' || value === 'new-head') {
		return value;
	}

	return null;
}

/**
 * 編集中 snapshot を確定版として保存する
 * POST /api/ir/snapshot/publish
 */
export const POST: RequestHandler = async ({ request }) => {
	const config = loadApplicationConfig();
	if (!config.ir?.autoSave?.enabled) {
		return json({ error: 'autoSave is disabled' }, { status: 403 });
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
	const logicalId = typeof record.logicalId === 'string' ? record.logicalId.trim() : '';
	if (!isValidLogicalId(logicalId)) {
		return json({ error: 'logicalId is required and must be a valid identifier' }, { status: 400 });
	}

	const kind = parsePublishKind(record.mode);
	if (kind === null) {
		return json({ error: 'mode must be revision, patch, or new-head' }, { status: 400 });
	}

	try {
		const result = await publishSnapshot(logicalId, kind);
		return json(result, { status: 201 });
	} catch (error) {
		if (error instanceof IrSnapshotRequestError) {
			return json({ error: error.message }, { status: error.httpStatus });
		}

		logger.error('snapshot publish failed', {
			errorMessage: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'failed to publish snapshot' }, { status: 500 });
	}
};
