import { json } from '@sveltejs/kit';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { writeSnapshot } from '$lib/server/io/ir-snapshot-io';
import type { RequestHandler } from './$types';

/**
 * 編集中 UI 定義の snapshot を保存する
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

	const components = (body as Record<string, unknown>).components;
	if (!Array.isArray(components)) {
		return json({ error: 'components must be an array' }, { status: 400 });
	}

	try {
		const result = await writeSnapshot(components);
		return json(result, { status: result.skipped ? 200 : 201 });
	} catch (error) {
		console.warn('[api/ir/snapshot] write failed:', error);
		return json({ error: 'failed to write snapshot' }, { status: 500 });
	}
};
