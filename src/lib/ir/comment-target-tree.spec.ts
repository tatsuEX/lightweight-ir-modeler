import { describe, expect, it } from 'vitest';
import { buildComponentCommentTree, buildUiDefinitionCommentTree } from '$lib/ir/comment-target-tree';
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
});
