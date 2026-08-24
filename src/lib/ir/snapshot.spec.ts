import { describe, expect, it } from 'vitest';
import { isMap, isScalar, parseDocument } from 'yaml';
import { createEmptyUiDefinitionMeta } from '$lib/ir/ui-definition-meta';
import {
	createIrSnapshot,
	deserializeIrSnapshot,
	deserializeIrSnapshotDocument,
	normalizeComponentsForCompare,
	restoreSnapshotComponents,
	SNAPSHOT_COMPONENT_EXCLUDE_TREE,
	serializeIrSnapshot,
	stripByExcludeTree,
	stripSnapshotComponents
} from '$lib/ir/snapshot';

/**
 * YAML Map ノードのキー順を取り出す
 */
function yamlMapKeys(node: unknown): string[] {
	if (!isMap(node)) {
		return [];
	}
	return node.items.map((pair) => (isScalar(pair.key) ? String(pair.key.value) : String(pair.key)));
}

const sampleEditorMeta = {
	...createEmptyUiDefinitionMeta(),
	logicalId: 'userRegistration',
	name: 'ユーザー登録'
};

const sampleSnapshotMeta = {
	...sampleEditorMeta,
	createdAt: '2026-08-07T10:00:00.000Z',
	modifiedAt: '2026-08-07T10:00:00.000Z'
};

describe('ir snapshot', () => {
	it('strips excluded keys when creating snapshot', () => {
		const snapshot = createIrSnapshot(sampleSnapshotMeta, [{ id: 'internal-id', type: 'textbox', label: 'A' }]);
		expect(snapshot.components[0]).toEqual({ type: 'textbox', label: 'A' });
		expect(snapshot.uiDefinition).toEqual(sampleSnapshotMeta);
	});

	it('round-trips persisted payload without excluded keys', () => {
		const snapshot = createIrSnapshot(sampleSnapshotMeta, [{ id: 'internal-id', type: 'textbox', label: 'A' }]);
		const restored = deserializeIrSnapshot(serializeIrSnapshot(snapshot));
		expect(restored.components[0]).toEqual({ type: 'textbox', label: 'A' });
		expect(restored.uiDefinition).toEqual(sampleSnapshotMeta);
	});

	it('restoreSnapshotComponents assigns generated values', () => {
		const restored = restoreSnapshotComponents([{ type: 'textbox', label: 'A' }]);
		const component = restored[0] as Record<string, unknown>;

		expect(component.type).toBe('textbox');
		expect(component.label).toBe('A');
		expect(typeof component.id).toBe('string');
		expect((component.id as string).length).toBe(16);
	});

	it('restoreSnapshotComponents replaces legacy persisted excluded keys', () => {
		const restored = restoreSnapshotComponents([{ id: 'legacy-id', type: 'textbox' }]);
		const component = restored[0] as Record<string, unknown>;

		expect(component.id).not.toBe('legacy-id');
		expect((component.id as string).length).toBe(16);
	});

	it('normalize ignores excluded key differences', () => {
		const left = normalizeComponentsForCompare([{ id: 'a', type: 'textbox' }]);
		const right = normalizeComponentsForCompare([{ id: 'b', type: 'textbox' }]);
		expect(left).toBe(right);
	});

	it('stripSnapshotComponents removes configured top-level keys', () => {
		expect(stripSnapshotComponents([{ id: 'x', logicalId: 'userName', type: 'textbox' }])).toEqual([
			{ logicalId: 'userName', type: 'textbox' }
		]);
	});

	it('stripByExcludeTree removes nested excluded keys', () => {
		const excludeTree = {
			id: true,
			meta: {
				sessionId: true
			}
		} as const;

		expect(
			stripByExcludeTree(
				{
					id: 'internal',
					type: 'textbox',
					meta: {
						sessionId: 'sess-1',
						version: 1
					}
				},
				excludeTree
			)
		).toEqual({
			type: 'textbox',
			meta: {
				version: 1
			}
		});
	});


	it('serializes YAML with system meta first then preferred keys', () => {
		const snapshot = createIrSnapshot(sampleSnapshotMeta, [
			{ zebra: 1, type: 'textbox', label: 'A', logicalId: 'userName' }
		]);
		const doc = parseDocument(serializeIrSnapshot(snapshot));
		expect(yamlMapKeys(doc.contents)).toEqual(['version', 'savedAt', 'uiDefinition', 'components']);
		expect(yamlMapKeys(doc.get('uiDefinition'))).toEqual([
			'version',
			'createdAt',
			'modifiedAt',
			'logicalId',
			'name',
			'description'
		]);
		const components = doc.get('components');
		expect(yamlMapKeys(components.get(0))).toEqual(['logicalId', 'type', 'label', 'zebra']);
	});
	it('documents current default exclude tree', () => {
		expect(SNAPSHOT_COMPONENT_EXCLUDE_TREE).toEqual({ id: true });
	});
	it('round-trips operational comments on uiDefinition and each component', () => {
		const snapshot = createIrSnapshot(sampleSnapshotMeta, [
			{ logicalId: 'userId', type: 'textbox' },
			{ logicalId: 'userName', type: 'label' }
		]);
		const yamlText = serializeIrSnapshot(snapshot, {
			uiDefinition: '画面メモ',
			'components[0]': 'ユーザー ID',
			'components[1]': '表示専用'
		});
		const loaded = deserializeIrSnapshotDocument(yamlText);
		expect(loaded.comments.uiDefinition).toBe('画面メモ');
		expect(loaded.comments['components[0]']).toBe('ユーザー ID');
		expect(loaded.comments['components[1]']).toBe('表示専用');
		expect(loaded.snapshot.uiDefinition).toEqual(sampleSnapshotMeta);
	});
});
