import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
	hasExportedDefinition,
	resolveExportDirForTarget,
	writeExportedDefinition
} from '$lib/server/io/definition-export-io';

describe('definition-export-io', () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'ui-export-test-'));
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: {
				name: 'test',
				io: { exportDir: tempDir }
			},
			preview: {
				theme: { default: 'tailwind-dark', options: [{ name: 'Dark', value: 'tailwind-dark' }] },
				transformTarget: {
					default: 'primefaces',
					options: [{ name: 'PF', value: 'primefaces' }]
				}
			}
		});
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it('writes under exportDir/target/logicalId without knowing extensions', async () => {
		const dir = resolveExportDirForTarget('primefaces', 'myForm');
		expect(dir).toBe(join(tempDir, 'primefaces', 'myForm'));

		expect(await hasExportedDefinition('primefaces', 'myForm', 'myForm.xhtml')).toBe(false);

		const written = await writeExportedDefinition('primefaces', 'myForm', {
			filename: 'myForm.xhtml',
			content: '<html />\n',
			contentType: 'application/xhtml+xml; charset=utf-8'
		});

		expect(written.relativePath).toBe(join('primefaces', 'myForm', 'myForm.xhtml'));
		expect(await hasExportedDefinition('primefaces', 'myForm', 'myForm.xhtml')).toBe(true);
		expect(await readFile(written.absolutePath, 'utf8')).toBe('<html />\n');
	});
});
