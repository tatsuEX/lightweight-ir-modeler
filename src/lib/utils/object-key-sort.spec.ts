import { describe, expect, it } from 'vitest';
import {
	compareAsciiKeys,
	compareObjectKeys,
	mergePreferredObjectKeys,
	sortObjectKeysDeep,
	SYSTEM_META_OBJECT_KEYS
} from '$lib/utils/object-key-sort';

describe('object-key-sort', () => {
	it('places system meta keys first in fixed order', () => {
		expect(SYSTEM_META_OBJECT_KEYS).toEqual(['version', 'createdAt', 'modifiedAt', 'savedAt']);
		expect(mergePreferredObjectKeys(['logicalId', 'version', 'type'])).toEqual([
			'version',
			'createdAt',
			'modifiedAt',
			'savedAt',
			'logicalId',
			'type'
		]);
	});

	it('compares leftover keys in ASCII code-unit order', () => {
		expect(compareAsciiKeys('Z', 'a')).toBeLessThan(0);
		expect(compareAsciiKeys('item10', 'item2')).toBeLessThan(0);
		expect(compareAsciiKeys('same', 'same')).toBe(0);
	});

	it('orders preferred keys after system meta, then ASCII leftovers', () => {
		const preferred = ['logicalId', 'type', 'label'];
		const keys = ['zebra', 'type', 'savedAt', 'label', 'logicalId', 'version', 'alpha'];
		const sorted = [...keys].sort((a, b) => compareObjectKeys(a, b, preferred));
		expect(sorted).toEqual([
			'version',
			'savedAt',
			'logicalId',
			'type',
			'label',
			'alpha',
			'zebra'
		]);
	});

	it('sorts nested objects and keeps array element order', () => {
		const sorted = sortObjectKeysDeep(
			{
				label: 'A',
				version: 1,
				items: [
					{ type: 'x', logicalId: 'b' },
					{ type: 'y', logicalId: 'a' }
				]
			},
			['logicalId', 'type']
		);
		expect(Object.keys(sorted as Record<string, unknown>)).toEqual(['version', 'items', 'label']);
		expect((sorted as { items: Record<string, unknown>[] }).items.map((item) => Object.keys(item))).toEqual([
			['logicalId', 'type'],
			['logicalId', 'type']
		]);
		expect((sorted as { items: { logicalId: string }[] }).items.map((item) => item.logicalId)).toEqual(['b', 'a']);
	});
});
