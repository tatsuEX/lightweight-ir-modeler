import { describe, expect, it } from 'vitest';
import {
	adoptHotEntries,
	ClientSessionRepository,
	clientSessionMapKey,
	type ClientSessionKey,
	type ClientSessionRecord
} from './client-session-repository';

/**
 * テスト用キーを作る
 */
function key(overrides: Partial<ClientSessionKey> = {}): ClientSessionKey {
	return {
		sessionId: 'session-a',
		logicalId: 'screenA',
		version: '1.0',
		...overrides
	};
}

describe('ClientSessionRepository', () => {
	it('creates on first acquire and reuses the same value', () => {
		const repository = new ClientSessionRepository<number>({ maxLifetimeMs: 1_000, now: () => 0 });
		const first = repository.acquire(key(), () => 1);
		const second = repository.acquire(key(), () => 2);

		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.record.value).toBe(1);
		expect(repository.size()).toBe(1);
	});

	it('keeps a different sessionId apart from the same logicalId and version', () => {
		const repository = new ClientSessionRepository<string>({ maxLifetimeMs: 1_000, now: () => 0 });
		repository.acquire(key(), () => 'a');
		repository.acquire(key({ sessionId: 'session-b' }), () => 'b');

		expect(repository.peek(key())).toBe('a');
		expect(repository.peek(key({ sessionId: 'session-b' }))).toBe('b');
	});

	it('rekeys logicalId and keeps sessionId, value, and createdAt', () => {
		let now = 10;
		const repository = new ClientSessionRepository<{ n: number }>({
			maxLifetimeMs: 1_000,
			now: () => now
		});
		const created = repository.acquire(key({ logicalId: 'draft:one' }), () => ({ n: 7 }));
		now = 40;
		const moved = repository.rekey(key({ logicalId: 'draft:one' }), key({ logicalId: 'screenB' }));

		expect(moved.value).toBe(created.record.value);
		expect(moved.createdAt).toBe(10);
		expect(moved.key).toEqual(key({ logicalId: 'screenB' }));
		expect(repository.peek(key({ logicalId: 'draft:one' }))).toBeUndefined();
		expect(repository.peek(key({ logicalId: 'screenB' }))).toEqual({ n: 7 });
	});

	it('refuses to change sessionId or to overwrite a live destination', () => {
		const repository = new ClientSessionRepository<number>({ maxLifetimeMs: 1_000, now: () => 0 });
		repository.acquire(key(), () => 1);
		repository.acquire(key({ logicalId: 'screenB' }), () => 2);

		expect(() => repository.rekey(key(), key({ sessionId: 'other' }))).toThrow(/sessionId/);
		expect(() => repository.rekey(key(), key({ logicalId: 'screenB' }))).toThrow(/occupied/);
		expect(repository.peek(key())).toBe(1);
	});

	it('drops an entry once maxLifetimeMs has elapsed and keeps session lookup for a new one', () => {
		let now = 0;
		const repository = new ClientSessionRepository<number>({
			maxLifetimeMs: 1_000,
			now: () => now
		});
		repository.acquire(key(), () => 1);
		now = 999;
		expect(repository.peek(key())).toBe(1);

		now = 1_000;
		expect(repository.peek(key())).toBeUndefined();
		const again = repository.acquire(key(), () => 3);
		expect(again.created).toBe(true);
		expect(again.record.value).toBe(3);
		expect(again.record.createdAt).toBe(1_000);
	});

	it('evictExpired removes only elapsed records', () => {
		let now = 0;
		const repository = new ClientSessionRepository<number>({
			maxLifetimeMs: 100,
			now: () => now
		});
		repository.acquire(key(), () => 1);
		now = 50;
		repository.acquire(key({ logicalId: 'screenB' }), () => 2);
		now = 100;

		expect(repository.evictExpired()).toBe(1);
		expect(repository.peek(key())).toBeUndefined();
		expect(repository.peek(key({ logicalId: 'screenB' }))).toBe(2);
	});

	it('uses a hot-retained map instead of the empty fallback', () => {
		const sample = key();
		const retained = new Map<string, ClientSessionRecord<number>>();
		retained.set(clientSessionMapKey(sample), {
			key: sample,
			value: 9,
			createdAt: 0
		});
		const hot = { data: { entries: retained } as Record<string, unknown> };
		const entries = adoptHotEntries(new Map<string, ClientSessionRecord<number>>(), hot);
		const repository = new ClientSessionRepository<number>({
			maxLifetimeMs: 1_000,
			now: () => 0,
			entries
		});

		expect(repository.peek(sample)).toBe(9);
		expect(hot.data.entries).toBe(entries);
	});
});
