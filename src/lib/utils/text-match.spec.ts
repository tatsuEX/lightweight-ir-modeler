import { describe, expect, it } from 'vitest';
import { matchesText } from '$lib/utils/text-match';

describe('matchesText', () => {
	it('treats empty or whitespace query as match-all', () => {
		expect(matchesText('anything', '', 'contains')).toBe(true);
		expect(matchesText('', '   ', 'startsWith')).toBe(true);
		expect(matchesText(undefined, '', 'endsWith')).toBe(true);
	});

	it('matches contains case-insensitively', () => {
		expect(matchesText('UserName', 'name', 'contains')).toBe(true);
		expect(matchesText('UserName', 'USER', 'contains')).toBe(true);
		expect(matchesText('UserName', 'id', 'contains')).toBe(false);
	});

	it('matches startsWith and endsWith', () => {
		expect(matchesText('item_001', 'item_', 'startsWith')).toBe(true);
		expect(matchesText('item_001', 'ITEM_', 'startsWith')).toBe(true);
		expect(matchesText('item_001', '_001', 'startsWith')).toBe(false);
		expect(matchesText('item_001', '_001', 'endsWith')).toBe(true);
		expect(matchesText('item_001', 'item', 'endsWith')).toBe(false);
	});

	it('treats nullish value as empty string', () => {
		expect(matchesText(null, 'a', 'contains')).toBe(false);
		expect(matchesText(undefined, 'a', 'contains')).toBe(false);
		expect(matchesText(null, '', 'contains')).toBe(true);
	});
});
