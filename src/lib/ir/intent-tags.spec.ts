import { describe, expect, it } from 'vitest';
import {
	addIntentTags,
	findIntentTagDefinition,
	formatIntentTagIrTypeLabel,
	IntentTagCatalogFileSchema,
	isValidIntentTagId,
	normalizeIntentTags,
	removeIntentTags,
	sharedWarningKey,
	suggestIntentTags,
	type IntentTagDefinition
} from '$lib/ir/intent-tags';

const definitions: IntentTagDefinition[] = [
	{ id: 'auto-layout', description: '自動配置', source: 'default' },
	{ id: 'validator:email', description: 'eメール検証', source: 'common' },
	{ id: 'depends-on:{logicalId}', description: '関連定義', source: 'common' }
];

describe('intent tags', () => {
	it('validates tag ids', () => {
		expect(isValidIntentTagId('auto-layout')).toBe(true);
		expect(isValidIntentTagId('validator:email')).toBe(true);
		expect(isValidIntentTagId('depends-on:user_name#1')).toBe(true);
		expect(isValidIntentTagId('depends-on:{logicalId}')).toBe(true);
		expect(isValidIntentTagId('Auto-Layout')).toBe(false);
		expect(isValidIntentTagId('a b')).toBe(false);
		expect(isValidIntentTagId(':email')).toBe(false);
	});

	it('normalizes tags keeping order', () => {
		expect(normalizeIntentTags([' a ', 'b', 'a', '', 1, 'c'])).toEqual(['a', 'b', 'c']);
		expect(normalizeIntentTags(undefined)).toEqual([]);
	});

	it('adds and removes tags, returning undefined when empty', () => {
		expect(addIntentTags(undefined, ['a', 'b'])).toEqual(['a', 'b']);
		expect(addIntentTags(['a'], ['b', 'a'])).toEqual(['a', 'b']);
		expect(addIntentTags(undefined, [])).toBeUndefined();
		expect(removeIntentTags(['a', 'b'], ['a'])).toEqual(['b']);
		expect(removeIntentTags(['a'], ['a'])).toBeUndefined();
	});

	it('finds definitions by exact id or placeholder', () => {
		expect(findIntentTagDefinition(definitions, 'auto-layout')?.source).toBe('default');
		expect(findIntentTagDefinition(definitions, 'depends-on:user-name')?.id).toBe(
			'depends-on:{logicalId}'
		);
		expect(findIntentTagDefinition(definitions, 'depends-on:')).toBeUndefined();
		expect(findIntentTagDefinition(definitions, 'unknown')).toBeUndefined();
	});

	it('suggests tags with placeholder expansion and prefix-first order', () => {
		const all = suggestIntentTags(definitions, '', { logicalIds: ['user', 'mail'] });
		expect(all.map((item) => item.value)).toEqual([
			'auto-layout',
			'validator:email',
			'depends-on:user',
			'depends-on:mail'
		]);

		const dependsOn = suggestIntentTags(definitions, 'depends-on:', { logicalIds: ['user'] });
		expect(dependsOn.map((item) => item.value)).toEqual(['depends-on:user']);

		const mail = suggestIntentTags(definitions, 'mail', {
			logicalIds: ['mail'],
			exclude: ['validator:email']
		});
		expect(mail.map((item) => item.value)).toEqual(['depends-on:mail']);
	});

	it('parses a catalog file and rejects bad ids', () => {
		const parsed = IntentTagCatalogFileSchema.parse({ tags: [{ id: 'auto-layout' }] });
		expect(parsed.tags[0]).toEqual({ id: 'auto-layout', description: '' });
		expect(IntentTagCatalogFileSchema.safeParse({ tags: [{ id: 'Bad Id' }] }).success).toBe(false);
		expect(IntentTagCatalogFileSchema.safeParse({ tags: 'x' }).success).toBe(false);
	});

	it('formats ir type labels', () => {
		expect(formatIntentTagIrTypeLabel('ui-definition')).toBe('UI Definition');
		expect(formatIntentTagIrTypeLabel('custom-ir')).toBe('custom-ir');
	});

	it('builds a shared warning key independent of order', () => {
		expect(sharedWarningKey('ui-definition', ['layout', 'event-action'])).toBe(
			sharedWarningKey('ui-definition', ['event-action', 'layout'])
		);
		expect(sharedWarningKey('ui-definition', ['layout'])).not.toBe(
			sharedWarningKey('ui-definition', ['layout', 'event-action'])
		);
	});
});
