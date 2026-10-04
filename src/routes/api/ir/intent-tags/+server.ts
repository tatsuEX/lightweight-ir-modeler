import { json } from '@sveltejs/kit';
import { UI_DEFINITION_INTENT_TAG_IR_TYPE } from '$lib/ir/intent-tags';
import {
	IntentTagRequestError,
	readIntentTagCatalog,
	registerIntentTag
} from '$lib/server/io/intent-tag-catalog-io';
import { getLogger } from '$lib/server/logging/logger';
import type { RequestHandler } from './$types';

const logger = getLogger(import.meta.url);

/**
 * ui-definition の合成済み Intent Tags マスタを返す
 * GET /api/ir/intent-tags
 */
export const GET: RequestHandler = async () => {
	try {
		return json(await readIntentTagCatalog(UI_DEFINITION_INTENT_TAG_IR_TYPE));
	} catch (error) {
		logger.error('intent tag catalog read failed', {
			errorMessage: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'failed to read intent tag catalog' }, { status: 500 });
	}
};

/**
 * ui-definition の default マスタへタグを新規登録する
 * POST /api/ir/intent-tags
 */
export const POST: RequestHandler = async ({ request }) => {
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
	if (typeof record.id !== 'string') {
		return json({ error: 'id is required' }, { status: 400 });
	}
	const description = typeof record.description === 'string' ? record.description : '';

	try {
		const result = await registerIntentTag(UI_DEFINITION_INTENT_TAG_IR_TYPE, {
			id: record.id,
			description
		});
		return json(result, { status: 201 });
	} catch (error) {
		if (error instanceof IntentTagRequestError) {
			return json({ error: error.message }, { status: error.httpStatus });
		}
		logger.error('intent tag register failed', {
			errorMessage: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'failed to register intent tag' }, { status: 500 });
	}
};
