import { describe, expect, it } from 'vitest';
import {
	buildComponentCommentTree,
	buildUiDefinitionCommentTree,
	collectAncestorOwnerKeys,
	defaultExpandedOwnerKeys
} from '$lib/ir/comment-target-tree';
import { UI_DEFINITION_COMMENT_KEY, componentCommentKey, componentRelCommentKey } from '$lib/ir/snapshot-comment-map';

describe('comment-target-tree', () => {
	it('includes uiDefinition domain keys and external descendants', () => {
		const tree = buildUiDefinitionCommentTree({
			logicalId: 'screen',
			name: '画面',
			description: '',
			version: '1.0.0',
			external: { 'im-forma': { importBase: { ja: 'x' } } }
		});

		expect(tree.ownerKey).toBe(UI_DEFINITION_COMMENT_KEY);
		const labels = tree.children.map((node) => node.label);
		expect(labels).toEqual(['logicalId', 'name', 'description', 'external', 'version']);
		expect(tree.children[0].ownerKey).toBe('uiDefinition.logicalId');
		expect(tree.children[3].children[0].ownerKey).toBe("uiDefinition.external['im-forma']");
	});

	it('includes component domain keys and skips session id', () => {
		const tree = buildComponentCommentTree({
			id: 'cid',
			logicalId: 'userId',
			type: 'textbox',
			label: 'ユーザー ID',
			external: { 'im-forma': { item_id: 'a' } }
		});

		expect(tree.ownerKey).toBe(componentCommentKey('cid'));
		expect(tree.children.map((node) => node.label)).not.toContain('id');
		expect(tree.children.some((node) => node.ownerKey === componentRelCommentKey('cid', 'logicalId'))).toBe(true);
		const external = tree.children.find((node) => node.label === 'external');
		expect(external?.ownerKey).toBe(componentRelCommentKey('cid', 'external'));
		expect(external?.children[0].ownerKey).toBe(componentRelCommentKey('cid', "external['im-forma']"));
	});

	it('defaults expanded keys to the root only for uiDefinition trees', () => {
		const tree = buildUiDefinitionCommentTree({
			logicalId: 'screen',
			external: { 'im-forma': { importBase: { ja: 'x' } } }
		});
		const expanded = defaultExpandedOwnerKeys(tree);
		const external = tree.children.find((node) => node.label === 'external');

		expect([...expanded]).toEqual([tree.ownerKey]);
		expect(external && expanded.has(external.ownerKey)).toBe(false);
	});

	it('defaults expanded keys to the root only for component trees', () => {
		const tree = buildComponentCommentTree({
			id: 'cid',
			logicalId: 'userId',
			type: 'textbox',
			validation: { required: true, minlength: 1 },
			items: [{ value: 'a', label: 'A' }],
			external: { 'im-forma': { item_id: 'a' } }
		});
		const expanded = defaultExpandedOwnerKeys(tree);

		expect([...expanded]).toEqual([tree.ownerKey]);
		expect(expanded.has(componentRelCommentKey('cid', 'validation'))).toBe(false);
		expect(expanded.has(componentRelCommentKey('cid', 'items'))).toBe(false);
		expect(expanded.has(componentRelCommentKey('cid', 'external'))).toBe(false);
	});

	it('collects ancestor owner keys for a nested external node', () => {
		const tree = buildUiDefinitionCommentTree({
			logicalId: 'screen',
			external: { 'im-forma': { importBase: { ja: 'x' } } }
		});
		const external = tree.children.find((node) => node.label === 'external');
		const forma = external?.children[0];

		expect(collectAncestorOwnerKeys(tree, tree.ownerKey)).toEqual([UI_DEFINITION_COMMENT_KEY]);
		expect(forma && collectAncestorOwnerKeys(tree, forma.ownerKey)).toEqual([
			UI_DEFINITION_COMMENT_KEY,
			'uiDefinition.external'
		]);
	});
});
