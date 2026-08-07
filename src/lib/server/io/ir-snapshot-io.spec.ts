import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
	pruneSnapshots,
	readLatestSnapshot,
	writeSnapshot
} from '$lib/server/io/ir-snapshot-io';

describe('ir-snapshot-io', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'ir-snapshot-test-'));
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: { name: 'test' },
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

	it('writes snapshot without system id and restores with new id', async () => {
		const components = [{ id: 'internal-id', type: 'textbox', label: 'Name' }];
		const written = await writeSnapshot(components);
		expect(written.skipped).toBe(false);

		const yamlText = await readFile(join(tempDir, written.filename), 'utf8');
		expect(yamlText).not.toContain('internal-id');
		expect(yamlText).not.toMatch(/^\s+id:/m);

		const latest = await readLatestSnapshot();
		const restored = latest?.components[0] as Record<string, unknown>;
		expect(restored).toMatchObject({ type: 'textbox', label: 'Name' });
		expect(typeof restored.id).toBe('string');
		expect(restored.id).not.toBe('internal-id');
		expect(latest?.savedAt).toBe(written.savedAt);
	});

	it('skips duplicate snapshot content regardless of in-memory system id', async () => {
		const first = await writeSnapshot([{ id: 'id-a', type: 'textbox' }]);
		const second = await writeSnapshot([{ id: 'id-b', type: 'textbox' }]);

		expect(first.skipped).toBe(false);
		expect(second.skipped).toBe(true);
		expect(second.filename).toBe(first.filename);

		const filenames = await listSnapshotFilenames(tempDir);
		expect(filenames).toHaveLength(1);
	});

	it('prunes snapshots beyond maxGenerations', async () => {
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: { name: 'test' },
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
			await writeSnapshot([{ id: `id-${index}`, type: 'textbox', logicalId: `field-${index}` }]);
		}

		const filenames = await listSnapshotFilenames(tempDir);
		expect(filenames).toHaveLength(3);
	});

	it('pruneSnapshots deletes older files', async () => {
		await writeSnapshot([{ id: '1', type: 'textbox', logicalId: 'a' }]);
		await writeSnapshot([{ id: '2', type: 'textbox', logicalId: 'b' }]);
		await writeSnapshot([{ id: '3', type: 'textbox', logicalId: 'c' }]);

		const deleted = await pruneSnapshots(tempDir, 2);
		expect(deleted).toHaveLength(1);

		const remaining = await readdir(tempDir);
		expect(remaining.filter((name) => name.startsWith('ir-snapshot-'))).toHaveLength(2);
	});
});
