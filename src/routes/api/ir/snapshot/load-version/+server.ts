import { json } from '@sveltejs/kit';
import { isValidLogicalId } from '$lib/ir/ui-definition-meta';
import { isValidSnapshotVersion } from '$lib/ir/snapshot-version';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { IrSnapshotRequestError, loadPublishedVersion } from '$lib/server/io/ir-snapshot-io';
import { getLogger } from '$lib/server/logging/logger';
import type { RequestHandler } from './$types';

const logger = getLogger(import.meta.url);

/**
 * 確定版を編集中コピーへ載せる
 * POST /api/ir/snapshot/load-version
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

	const version = typeof record.version === 'string' ? record.version.trim() : '';
	if (!isValidSnapshotVersion(version)) {
		return json({ error: 'version must be main.sub' }, { status: 400 });
	}

	try {
		const snapshot = await loadPublishedVersion(logicalId, version);
		return json(snapshot);
	} catch (error) {
		if (error instanceof IrSnapshotRequestError) {
			return json({ error: error.message }, { status: error.httpStatus });
		}

		logger.error('snapshot load-version failed', {
			errorMessage: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'failed to load published version' }, { status: 500 });
	}
};
