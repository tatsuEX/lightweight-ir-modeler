import { json } from '@sveltejs/kit';
import { isValidLogicalId } from '$lib/ir/ui-definition-meta';
import { EMPTY_PUBLISHED_VERSIONS_LISTING } from '$lib/ir/snapshot-version';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { listPublishedVersions } from '$lib/server/io/ir-snapshot-io';
import { getLogger } from '$lib/server/logging/logger';
import type { RequestHandler } from './$types';

const logger = getLogger(import.meta.url);

/**
 * 確定版 version 一覧を返す
 * GET /api/ir/snapshot/versions?logicalId=...
 */
export const GET: RequestHandler = async ({ url }) => {
	const config = loadApplicationConfig();
	if (!config.ir?.autoSave?.enabled) {
		return json({ ...EMPTY_PUBLISHED_VERSIONS_LISTING });
	}

	const logicalId = url.searchParams.get('logicalId')?.trim() ?? '';
	if (!isValidLogicalId(logicalId)) {
		return json({ error: 'logicalId is required and must be a valid identifier' }, { status: 400 });
	}

	try {
		const listing = await listPublishedVersions(logicalId);
		return json(listing);
	} catch (error) {
		logger.error('published versions list failed', {
			errorMessage: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'failed to list published versions' }, { status: 500 });
	}
};
