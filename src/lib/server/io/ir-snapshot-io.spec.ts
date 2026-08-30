import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIrSnapshot, serializeIrSnapshot } from '$lib/ir/snapshot';
import {
	buildSnapshotMetaForWrite,
	createEmptyUiDefinitionMeta,
	toEditorMeta
} from '$lib/ir/ui-definition-meta';

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
	listPublishedVersions,
	listSnapshotDirectories,
	listSnapshotFilenames,
	listSnapshotLogicalIds,
	loadPublishedVersion,
	pruneSnapshots,
	publishSnapshot,
	readLatestSnapshot,
	writeSnapshot
} from '$lib/server/io/ir-snapshot-io';

const sampleEditorMeta = {
	...createEmptyUiDefinitionMeta(),
	logicalId: 'testScreen',
	name: 'Test Screen'
};

/**
 * 画面ディレクトリ内の current / history パスを返す
 */
function layoutPaths(tempDir: string, logicalId: string) {
	const screenDir = join(tempDir, logicalId);

	return {
		screenDir,
		currentFile: join(screenDir, 'current', 'snapshot.yml'),
		historyDir: join(screenDir, 'history')
	};
}

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

	it('writes snapshot under current and history and restores with new id', async () => {
		const components = [{ id: 'internal-id', type: 'textbox', label: 'Name' }];
		const written = await writeSnapshot(sampleEditorMeta, components);
		expect(written.skipped).toBe(false);
		expect(written.filename).toBe('current/snapshot.yml');

		const { screenDir, currentFile, historyDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		const yamlText = await readFile(currentFile, 'utf8');
		expect(yamlText).not.toContain('internal-id');
		expect(yamlText).not.toMatch(/^\s+id:/m);
		expect(yamlText).toContain('logicalId: testScreen');
		expect(yamlText).toContain('createdAt:');
		expect(yamlText).toContain('modifiedAt:');

		const historyFiles = await listSnapshotFilenames(historyDir);
		expect(historyFiles).toHaveLength(1);
		const historyYaml = await readFile(join(historyDir, historyFiles[0]), 'utf8');
		expect(historyYaml).toBe(yamlText);

		const tree = await listSnapshotDirectories(screenDir);
		expect(tree.current).toBe(join(screenDir, 'current'));
		expect(tree.history).toBe(join(screenDir, 'history'));
		expect(tree.versions).toBeUndefined();

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

		const { historyDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		expect(await listSnapshotFilenames(historyDir)).toHaveLength(1);
	});

	it('writes a new generation when only comments change', async () => {
		const components = [{ id: 'id-a', type: 'textbox', logicalId: 'userId' }];
		const first = await writeSnapshot(sampleEditorMeta, components, {});
		const second = await writeSnapshot(sampleEditorMeta, components, {
			uiDefinition: '運用メモ'
		});

		expect(first.skipped).toBe(false);
		expect(second.skipped).toBe(false);

		const { currentFile, historyDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		expect(await listSnapshotFilenames(historyDir)).toHaveLength(2);
		const latest = await readLatestSnapshot(sampleEditorMeta.logicalId);
		expect(latest?.comments.uiDefinition).toBe('運用メモ');
		const currentYaml = await readFile(currentFile, 'utf8');
		expect(currentYaml).toContain('運用メモ');
	});

	it('prunes history snapshots beyond maxGenerations', async () => {
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

		const { currentFile, historyDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		expect(await listSnapshotFilenames(historyDir)).toHaveLength(3);
		await expect(readFile(currentFile, 'utf8')).resolves.toContain('field-4');
	});

	it('pruneSnapshots deletes older files in the given directory', async () => {
		await writeSnapshot(sampleEditorMeta, [{ id: '1', type: 'textbox', logicalId: 'a' }]);
		await writeSnapshot(sampleEditorMeta, [{ id: '2', type: 'textbox', logicalId: 'b' }]);
		await writeSnapshot(sampleEditorMeta, [{ id: '3', type: 'textbox', logicalId: 'c' }]);

		const { historyDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		const deleted = await pruneSnapshots(historyDir, 2);
		expect(deleted).toHaveLength(1);

		const remaining = await readdir(historyDir);
		expect(remaining.filter((name) => name.startsWith('ir-snapshot-'))).toHaveLength(2);
	});

	it('lists logicalId directories', async () => {
		await writeSnapshot(sampleEditorMeta, [{ id: '1', type: 'textbox' }]);
		await writeSnapshot({ ...sampleEditorMeta, logicalId: 'anotherScreen', name: 'Another' }, [
			{ id: '2', type: 'textbox' }
		]);

		await expect(listSnapshotLogicalIds()).resolves.toEqual(['anotherScreen', 'testScreen']);
	});

	it('reads legacy flat snapshot when current is missing', async () => {
		const { screenDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		await mkdir(screenDir, { recursive: true });

		const savedAt = new Date('2026-01-15T00:00:00.000Z');
		const uiDefinition = buildSnapshotMetaForWrite(sampleEditorMeta, null, savedAt);
		const snapshot = createIrSnapshot(
			uiDefinition,
			[{ id: 'legacy-id', type: 'textbox', label: 'Legacy' }],
			savedAt
		);
		await writeFile(
			join(screenDir, 'ir-snapshot-20260115T090000.yml'),
			serializeIrSnapshot(snapshot, { uiDefinition: '旧世代' }),
			'utf8'
		);

		const latest = await readLatestSnapshot(sampleEditorMeta.logicalId);
		expect(latest?.comments.uiDefinition).toBe('旧世代');
		expect(latest?.uiDefinition?.createdAt).toBe('2026-01-15T00:00:00.000Z');
		expect((latest?.components[0] as Record<string, unknown>).label).toBe('Legacy');
	});

	it('does not skip when only a legacy flat snapshot exists', async () => {
		const { screenDir, currentFile, historyDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		await mkdir(screenDir, { recursive: true });

		const savedAt = new Date('2026-01-15T00:00:00.000Z');
		const uiDefinition = buildSnapshotMetaForWrite(sampleEditorMeta, null, savedAt);
		const snapshot = createIrSnapshot(uiDefinition, [{ id: 'legacy-id', type: 'textbox' }], savedAt);
		await writeFile(
			join(screenDir, 'ir-snapshot-20260115T090000.yml'),
			serializeIrSnapshot(snapshot, {}),
			'utf8'
		);

		const written = await writeSnapshot(sampleEditorMeta, [{ id: 'id-b', type: 'textbox' }]);
		expect(written.skipped).toBe(false);
		expect(written.filename).toBe('current/snapshot.yml');
		await expect(readFile(currentFile, 'utf8')).resolves.toContain('logicalId: testScreen');
		expect(await listSnapshotFilenames(historyDir)).toHaveLength(1);

		const latest = await readLatestSnapshot(sampleEditorMeta.logicalId);
		expect(latest?.uiDefinition?.createdAt).toBe('2026-01-15T00:00:00.000Z');
	});

	it('publishes current as 1.0 then 2.0 on revision', async () => {
		await writeSnapshot(
			{ ...sampleEditorMeta, changeReason: '初回' },
			[{ id: '1', type: 'textbox', logicalId: 'a' }]
		);
		const first = await publishSnapshot(sampleEditorMeta.logicalId);
		expect(first.version).toBe('1.0');
		expect(first.snapshot.uiDefinition?.version).toBe('1.0');
		expect(first.snapshot.uiDefinition?.releasedAt).toBeUndefined();
		expect(first.snapshot.uiDefinition?.basedOn).toBeUndefined();

		const { screenDir } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		const publishedYaml = await readFile(join(screenDir, 'versions', '1.0', 'snapshot.yml'), 'utf8');
		expect(publishedYaml).toContain('初回');
		expect(publishedYaml).not.toContain('releasedAt:');
		expect(publishedYaml).toContain('version: "1.0"');

		await writeSnapshot(sampleEditorMeta, [{ id: '2', type: 'textbox', logicalId: 'b' }]);
		const second = await publishSnapshot(sampleEditorMeta.logicalId);
		expect(second.version).toBe('2.0');
		expect(await listPublishedVersions(sampleEditorMeta.logicalId)).toMatchObject({
			head: '2.0',
			selectable: ['1.0', '2.0'],
			summaries: [
				{ version: '1.0', changeReason: '初回' },
				{ version: '2.0' }
			]
		});
	});

	it('loads a past version, clears history, and records basedOn', async () => {
		await writeSnapshot(sampleEditorMeta, [{ id: '1', type: 'textbox', logicalId: 'a' }]);
		await publishSnapshot(sampleEditorMeta.logicalId);
		await writeSnapshot(sampleEditorMeta, [{ id: '2', type: 'textbox', logicalId: 'b' }]);
		await publishSnapshot(sampleEditorMeta.logicalId);
		await writeSnapshot(sampleEditorMeta, [{ id: '3', type: 'textbox', logicalId: 'c' }]);

		const { historyDir, currentFile } = layoutPaths(tempDir, sampleEditorMeta.logicalId);
		expect(await listSnapshotFilenames(historyDir)).not.toHaveLength(0);

		const loaded = await loadPublishedVersion(sampleEditorMeta.logicalId, '1.0');
		expect(loaded.uiDefinition?.basedOn).toBe('1.0');
		expect(loaded.uiDefinition?.version).toBe('1.0');
		expect((loaded.components[0] as Record<string, unknown>).logicalId).toBe('a');
		expect(await listSnapshotFilenames(historyDir)).toHaveLength(0);
		expect(Date.parse(loaded.uiDefinition!.createdAt)).toBeGreaterThan(0);

		const currentYaml = await readFile(currentFile, 'utf8');
		expect(currentYaml).toContain('basedOn: "1.0"');
		expect(currentYaml).not.toContain('releasedAt:');
	});

	it('publishes a HEAD patch as same-main sub increment', async () => {
		await writeSnapshot(
			{ ...sampleEditorMeta, changeReason: '初回' },
			[{ id: '1', type: 'textbox', logicalId: 'a' }]
		);
		await publishSnapshot(sampleEditorMeta.logicalId);
		await writeSnapshot(
			{ ...sampleEditorMeta, changeReason: 'メタ修正' },
			[{ id: '1', type: 'textbox', logicalId: 'a' }]
		);

		const patched = await publishSnapshot(sampleEditorMeta.logicalId, 'patch');
		expect(patched.version).toBe('1.1');
		expect(patched.snapshot.uiDefinition?.changeReason).toBe('メタ修正');
		expect(patched.snapshot.uiDefinition?.basedOn).toBeUndefined();
		expect(await listPublishedVersions(sampleEditorMeta.logicalId)).toMatchObject({
			head: '1.1',
			selectable: ['1.1'],
			summaries: [
				{ version: '1.0', changeReason: '初回' },
				{ version: '1.1', changeReason: 'メタ修正' }
			]
		});
	});

	it('publishes patch and new-head from a past version', async () => {
		await writeSnapshot(sampleEditorMeta, [{ id: '1', type: 'textbox', logicalId: 'a' }]);
		await publishSnapshot(sampleEditorMeta.logicalId);
		await writeSnapshot(sampleEditorMeta, [{ id: '2', type: 'textbox', logicalId: 'b' }]);
		await publishSnapshot(sampleEditorMeta.logicalId);

		await loadPublishedVersion(sampleEditorMeta.logicalId, '1.0');
		await writeSnapshot(
			{ ...sampleEditorMeta, basedOn: '1.0', version: '1.0' },
			[{ id: '1', type: 'textbox', logicalId: 'a-patched' }]
		);

		const patched = await publishSnapshot(sampleEditorMeta.logicalId, 'patch');
		expect(patched.version).toBe('1.1');
		expect(patched.snapshot.uiDefinition?.basedOn).toBe('1.0');
		expect(await listPublishedVersions(sampleEditorMeta.logicalId)).toMatchObject({
			head: '2.0',
			selectable: ['1.1', '2.0']
		});

		await loadPublishedVersion(sampleEditorMeta.logicalId, '1.1');
		await writeSnapshot(
			{ ...sampleEditorMeta, basedOn: '1.1', version: '1.1' },
			[{ id: '1', type: 'textbox', logicalId: 'a-head' }]
		);
		const promoted = await publishSnapshot(sampleEditorMeta.logicalId, 'new-head');
		expect(promoted.version).toBe('3.0');
		expect(promoted.snapshot.uiDefinition?.basedOn).toBeUndefined();
		expect(await listPublishedVersions(sampleEditorMeta.logicalId)).toMatchObject({
			head: '3.0',
			selectable: ['1.1', '2.0', '3.0']
		});
	});
});
