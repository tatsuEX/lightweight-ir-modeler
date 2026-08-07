import { describe, expect, it } from 'vitest';
import {
	createIrSnapshot,
	deserializeIrSnapshot,
	normalizeComponentsForCompare,
	restoreSnapshotComponents,
	SNAPSHOT_COMPONENT_EXCLUDE_TREE,
	serializeIrSnapshot,
	stripByExcludeTree,
	stripSnapshotComponents
} from '$lib/ir/snapshot';

describe('ir snapshot', () => {
	it('strips excluded keys when creating snapshot', () => {
		const snapshot = createIrSnapshot([{ id: 'internal-id', type: 'textbox', label: 'A' }]);
		expect(snapshot.components[0]).toEqual({ type: 'textbox', label: 'A' });
	});

	it('round-trips persisted payload without excluded keys', () => {
		const snapshot = createIrSnapshot([{ id: 'internal-id', type: 'textbox', label: 'A' }]);
		const restored = deserializeIrSnapshot(serializeIrSnapshot(snapshot));
		expect(restored.components[0]).toEqual({ type: 'textbox', label: 'A' });
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

	it('documents current default exclude tree', () => {
		expect(SNAPSHOT_COMPONENT_EXCLUDE_TREE).toEqual({ id: true });
	});
});
