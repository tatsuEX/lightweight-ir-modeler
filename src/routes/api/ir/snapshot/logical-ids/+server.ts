import { json } from '@sveltejs/kit';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { listSnapshotLogicalIds } from '$lib/server/io/ir-snapshot-io';
import type { RequestHandler } from './$types';

/**
 * snapshot 保存済み logicalId 一覧を返す（autocomplete 用）
 */
export const GET: RequestHandler = async () => {
	const config = loadApplicationConfig();
	if (!config.ir?.autoSave?.enabled) {
		return json({ logicalIds: [] });
	}

	try {
		const logicalIds = await listSnapshotLogicalIds();
		return json({ logicalIds });
	} catch (error) {
		console.warn('[api/ir/snapshot/logical-ids] list failed:', error);
		return json({ error: 'failed to list logicalIds' }, { status: 500 });
	}
};
