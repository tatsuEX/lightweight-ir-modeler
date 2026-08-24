import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyUiDefinitionMeta, toEditorMeta } from '$lib/ir/ui-definition-meta';

const mockConfig = vi.hoisted(() => ({
	loadApplicationConfig: vi.fn()
}));

vi.mock('$lib/server/config/application-config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config/application-config')>();
	return {
		...actual,
		loadApplicationConfig: mockConfig.loadApplicationConfig
	};
});

import {
	listSnapshotFilenames,
	listSnapshotLogicalIds,
	pruneSnapshots,
	readLatestSnapshot,
	writeSnapshot
} from '$lib/server/io/ir-snapshot-io';

const sampleEditorMeta = {
	...createEmptyUiDefinitionMeta(),
	logicalId: 'testScreen',
	name: 'Test Screen'
};

describe('ir-snapshot-io', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'ir-snapshot-test-'));
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: { name: 'test' },
			preview: {
				theme: { default: 'tailwind-dark', options: [{ name: 'Dark', value: 'tailwind-dark' }] },
				transformTarget: { default: 'primefaces', options: [{ name: 'PF', value: 'primefaces' }] }
			},
			ir: {
				autoSave: {
					enabled: true,
					delay: 500,
					dir: tempDir,
					maxGenerations: 10
				}
			}
		});
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it('writes snapshot under logicalId directory without system id and restores with new id', async () => {
		const components = [{ id: 'internal-id', type: 'textbox', label: 'Name' }];
		const written = await writeSnapshot(sampleEditorMeta, components);
		expect(written.skipped).toBe(false);

		const screenDir = join(tempDir, sampleEditorMeta.logicalId);
		const yamlText = await readFile(join(screenDir, written.filename), 'utf8');
		expect(yamlText).not.toContain('internal-id');
		expect(yamlText).not.toMatch(/^\s+id:/m);
		expect(yamlText).toContain('logicalId: testScreen');
		expect(yamlText).toContain('createdAt:');
		expect(yamlText).toContain('modifiedAt:');

		const latest = await readLatestSnapshot(sampleEditorMeta.logicalId);
		const restored = latest?.components[0] as Record<string, unknown>;
		expect(restored).toMatchObject({ type: 'textbox', label: 'Name' });
		expect(typeof restored.id).toBe('string');
		expect(restored.id).not.toBe('internal-id');
		expect(latest?.savedAt).toBe(written.savedAt);
		expect(toEditorMeta(latest!.uiDefinition!)).toEqual(sampleEditorMeta);
		expect(latest?.uiDefinition?.createdAt).toBeTruthy();
		expect(latest?.uiDefinition?.modifiedAt).toBeTruthy();
		expect(latest?.comments).toEqual({});
	});

	it('preserves createdAt and updates modifiedAt on subsequent writes', async () => {
		await writeSnapshot(sampleEditorMeta, [{ id: '1', type: 'textbox', label: 'A' }]);
		const first = await readLatestSnapshot(sampleEditorMeta.logicalId);
		const createdAt = first?.uiDefinition?.createdAt;

		await writeSnapshot(sampleEditorMeta, [{ id: '2', type: 'textbox', label: 'B' }]);
		const second = await readLatestSnapshot(sampleEditorMeta.logicalId);

		expect(second?.uiDefinition?.createdAt).toBe(createdAt);
		expect(Date.parse(second!.uiDefinition!.modifiedAt)).toBeGreaterThanOrEqual(
			Date.parse(first!.uiDefinition!.modifiedAt)
		);
	});

	it('skips duplicate snapshot content regardless of in-memory system id', async () => {
		const first = await writeSnapshot(sampleEditorMeta, [{ id: 'id-a', type: 'textbox' }]);
		const second = await writeSnapshot(sampleEditorMeta, [{ id: 'id-b', type: 'textbox' }]);

		expect(first.skipped).toBe(false);
		expect(second.skipped).toBe(true);
		expect(second.filename).toBe(first.filename);

		const filenames = await listSnapshotFilenames(join(tempDir, sampleEditorMeta.logicalId));
		expect(filenames).toHaveLength(1);
	});

	it('writes a new generation when only comments change', async () => {
		const components = [{ id: 'id-a', type: 'textbox', logicalId: 'userId' }];
		const first = await writeSnapshot(sampleEditorMeta, components, {});
		const second = await writeSnapshot(sampleEditorMeta, components, {
			uiDefinition: '運用メモ'
		});

		expect(first.skipped).toBe(false);
		expect(second.skipped).toBe(false);

		const latest = await readLatestSnapshot(sampleEditorMeta.logicalId);
		expect(latest?.comments.uiDefinition).toBe('運用メモ');
	});

	it('prunes snapshots beyond maxGenerations', async () => {
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: { name: 'test' },
			preview: {
				theme: { default: 'tailwind-dark', options: [{ name: 'Dark', value: 'tailwind-dark' }] },
				transformTarget: { default: 'primefaces', options: [{ name: 'PF', value: 'primefaces' }] }
			},
			ir: {
				autoSave: {
					enabled: true,
					delay: 500,
					dir: tempDir,
					maxGenerations: 3
				}
			}
		});

		for (let index = 0; index < 5; index += 1) {
			await writeSnapshot(sampleEditorMeta, [
				{ id: `id-${index}`, type: 'textbox', logicalId: `field-${index}` }
			]);
		}

		const filenames = await listSnapshotFilenames(join(tempDir, sampleEditorMeta.logicalId));
		expect(filenames).toHaveLength(3);
	});

	it('pruneSnapshots deletes older files', async () => {
		await writeSnapshot(sampleEditorMeta, [{ id: '1', type: 'textbox', logicalId: 'a' }]);
		await writeSnapshot(sampleEditorMeta, [{ id: '2', type: 'textbox', logicalId: 'b' }]);
		await writeSnapshot(sampleEditorMeta, [{ id: '3', type: 'textbox', logicalId: 'c' }]);

		const screenDir = join(tempDir, sampleEditorMeta.logicalId);
		const deleted = await pruneSnapshots(screenDir, 2);
		expect(deleted).toHaveLength(1);

		const remaining = await readdir(screenDir);
		expect(remaining.filter((name) => name.startsWith('ir-snapshot-'))).toHaveLength(2);
	});

	it('lists logicalId directories', async () => {
		await writeSnapshot(sampleEditorMeta, [{ id: '1', type: 'textbox' }]);
		await writeSnapshot(
			{ ...sampleEditorMeta, logicalId: 'anotherScreen', name: 'Another' },
			[{ id: '2', type: 'textbox' }]
		);

		await expect(listSnapshotLogicalIds()).resolves.toEqual(['anotherScreen', 'testScreen']);
	});
});
