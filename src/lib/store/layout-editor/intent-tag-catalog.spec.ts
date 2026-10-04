import { describe, expect, it, vi } from 'vitest';
import { IntentTagCatalog } from './intent-tag-catalog.svelte';

/**
 * JSON 応答を返す fetch スタブを作る
 */
function stubFetch(status: number, body: unknown): typeof fetch {
	return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('IntentTagCatalog', () => {
	const view = {
		tags: [
			{ id: 'auto-layout', description: '自動配置', source: 'default' },
			{ id: 'depends-on:{logicalId}', description: '関連', source: 'common' }
		],
		canRegister: true,
		sharedWithIrTypes: []
	};

	it('finds and suggests tags from the composed catalog', () => {
		const catalog = new IntentTagCatalog(view);
		expect(catalog.find('depends-on:user')?.source).toBe('common');
		expect(catalog.suggest('dep', { logicalIds: ['user'] }).map((item) => item.value)).toEqual([
			'depends-on:user'
		]);
	});

	it('registers a tag and updates the local list and shared irTypes', async () => {
		const fetchImpl = stubFetch(201, {
			definition: { id: 'validator:email', description: 'メール', source: 'default' },
			sharedWithIrTypes: ['layout']
		});
		const catalog = new IntentTagCatalog(view, { fetchImpl });

		const definition = await catalog.register('validator:email', 'メール');
		expect(definition.source).toBe('default');
		expect(catalog.tags.map((tag) => tag.id)).toContain('validator:email');
		expect(catalog.sharedWithIrTypes).toEqual(['layout']);
		expect(catalog.shouldWarnShared()).toBe(true);
	});

	it('throws the server error message on failure', async () => {
		const catalog = new IntentTagCatalog(view, {
			fetchImpl: stubFetch(409, { error: 'intent tag は登録済みです' })
		});
		await expect(catalog.register('auto-layout', '')).rejects.toThrow('intent tag は登録済みです');
	});

	it('does not warn when the default file is not shared', () => {
		expect(new IntentTagCatalog(view).shouldWarnShared()).toBe(false);
	});
});
