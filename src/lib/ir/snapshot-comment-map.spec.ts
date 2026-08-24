import { describe, expect, it } from 'vitest';
import {
	UI_DEFINITION_COMMENT_KEY,
	componentCommentKey,
	componentExternalCommentKey,
	ownerCommentsFromYamlMap,
	retainOwnerCommentsForComponentIds,
	yamlCommentsFromOwnerMap
} from '$lib/ir/snapshot-comment-map';

describe('snapshot-comment-map', () => {
	it('maps component index paths to ids and back', () => {
		const ids = ['id-a', 'id-b'];
		const yamlMap = {
			[UI_DEFINITION_COMMENT_KEY]: 'meta',
			'components[0]': 'first',
			'components[1]': 'second',
			"uiDefinition.external['im-forma']": 'ext',
			"components[1].external['im-forma'].item_id": 'item'
		};

		const owner = ownerCommentsFromYamlMap(yamlMap, ids);
		expect(owner[UI_DEFINITION_COMMENT_KEY]).toBe('meta');
		expect(owner[componentCommentKey('id-a')]).toBe('first');
		expect(owner[componentCommentKey('id-b')]).toBe('second');
		expect(owner["uiDefinition.external['im-forma']"]).toBe('ext');
		expect(owner[componentExternalCommentKey('id-b', "external['im-forma'].item_id")]).toBe('item');

		expect(yamlCommentsFromOwnerMap(owner, ids)).toEqual(yamlMap);
	});

	it('drops comments for removed component ids', () => {
		const owner = {
			[componentCommentKey('keep')]: 'yes',
			[componentCommentKey('gone')]: 'no',
			[componentExternalCommentKey('gone', 'external')]: 'no-ext',
			[UI_DEFINITION_COMMENT_KEY]: 'meta'
		};

		expect(retainOwnerCommentsForComponentIds(owner, new Set(['keep']))).toEqual({
			[componentCommentKey('keep')]: 'yes',
			[UI_DEFINITION_COMMENT_KEY]: 'meta'
		});
	});
});
