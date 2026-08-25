import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializeIrSnapshot } from '$lib/ir/snapshot';
import { loadRestoredIrSnapshotFile } from '$lib/server/io/ir-snapshot-file';

describe('loadRestoredIrSnapshotFile', () => {
	it('reads a snapshot YAML file', () => {
		const dir = mkdtempSync(join(tmpdir(), 'ir-snapshot-file-'));
		const filePath = join(dir, 'ir-snapshot.yaml');
		writeFileSync(
			filePath,
			serializeIrSnapshot({
				version: 1,
				savedAt: '2026-08-25T00:00:00.000Z',
				components: [{ type: 'textbox', label: 'A' }]
			}),
			'utf8'
		);

		const restored = loadRestoredIrSnapshotFile(filePath);
		const component = restored.components[0] as Record<string, unknown>;
		expect(component.type).toBe('textbox');
		expect(typeof component.id).toBe('string');
	});

	it('throws when the file is missing', () => {
		expect(() => loadRestoredIrSnapshotFile(join(tmpdir(), 'missing-ir-snapshot.yaml'))).toThrow(
			'IR snapshot not found'
		);
	});
});
