import { describe, expect, it } from 'vitest';
import {
	CLIENT_SESSION_ID_STORAGE_KEY,
	readOrCreateClientSessionId,
	type ClientSessionIdStorage
} from './client-session-id';

/**
 * テスト用のインメモリ storage を作る
 */
function memoryStorage(): ClientSessionIdStorage & { values: Map<string, string> } {
	const values = new Map<string, string>();
	return {
		values,
		getItem(key: string): string | null {
			return values.get(key) ?? null;
		},
		setItem(key: string, value: string): void {
			values.set(key, value);
		}
	};
}

describe('readOrCreateClientSessionId', () => {
	it('stores a new id and reuses it', () => {
		const storage = memoryStorage();
		let issued = 0;
		const first = readOrCreateClientSessionId(storage, () => {
			issued += 1;
			return 'id-1';
		});
		const second = readOrCreateClientSessionId(storage, () => {
			issued += 1;
			return 'id-2';
		});

		expect(first).toBe('id-1');
		expect(second).toBe('id-1');
		expect(issued).toBe(1);
		expect(storage.values.get(CLIENT_SESSION_ID_STORAGE_KEY)).toBe('id-1');
	});

	it('replaces a blank stored id', () => {
		const storage = memoryStorage();
		storage.setItem(CLIENT_SESSION_ID_STORAGE_KEY, '   ');

		expect(readOrCreateClientSessionId(storage, () => 'id-next')).toBe('id-next');
	});
});
