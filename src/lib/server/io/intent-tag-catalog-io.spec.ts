import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntentTagIrTypeConfig } from '$lib/config/application-types';

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
	IntentTagRequestError,
	readIntentTagCatalog,
	registerIntentTag
} from '$lib/server/io/intent-tag-catalog-io';

describe('intent-tag-catalog-io', () => {
	let tempDir: string;

	/**
	 * ir.intentTags だけを持つ設定をモックへ載せる
	 */
	function useIntentTags(intentTags: IntentTagIrTypeConfig[] | undefined): void {
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: { name: 'test' },
			ir: intentTags ? { intentTags } : undefined
		});
	}

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'intent-tags-test-'));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		mockConfig.loadApplicationConfig.mockReset();
	});

	it('composes files in order and keeps the earlier id on duplicates', async () => {
		const defaultPath = join(tempDir, 'default.yaml');
		const commonPath = join(tempDir, 'common.yaml');
		await writeFile(defaultPath, "tags:\n  - id: 'auto-layout'\n    description: 固有\n", 'utf8');
		await writeFile(
			commonPath,
			"tags:\n  - id: 'auto-layout'\n    description: 共通\n  - id: 'validator:email'\n",
			'utf8'
		);
		useIntentTags([
			{
				irType: 'ui-definition',
				files: [
					{ path: defaultPath, alias: 'default' },
					{ path: commonPath, alias: 'common' }
				]
			}
		]);

		const catalog = await readIntentTagCatalog();
		expect(catalog.tags).toEqual([
			{ id: 'auto-layout', description: '固有', source: 'default' },
			{ id: 'validator:email', description: '', source: 'common' }
		]);
		expect(catalog.canRegister).toBe(true);
		expect(catalog.sharedWithIrTypes).toEqual([]);
	});

	it('does not mix files of another irType and treats missing files as empty', async () => {
		const layoutPath = join(tempDir, 'layout.yaml');
		await writeFile(layoutPath, "tags:\n  - id: 'grid'\n", 'utf8');
		useIntentTags([
			{
				irType: 'ui-definition',
				files: [{ path: join(tempDir, 'missing.yaml'), alias: 'common' }]
			},
			{ irType: 'layout', files: [{ path: layoutPath, alias: 'default' }] }
		]);

		const catalog = await readIntentTagCatalog();
		expect(catalog.tags).toEqual([]);
		expect(catalog.canRegister).toBe(false);
	});

	it('returns an empty catalog when ir.intentTags is not configured', async () => {
		useIntentTags(undefined);
		expect(await readIntentTagCatalog()).toEqual({
			tags: [],
			canRegister: false,
			sharedWithIrTypes: []
		});
	});

	it('detects irTypes sharing the default file', async () => {
		const sharedPath = join(tempDir, 'shared.yaml');
		useIntentTags([
			{ irType: 'ui-definition', files: [{ path: sharedPath, alias: 'default' }] },
			{
				irType: 'layout',
				files: [{ path: join(tempDir, '.', 'shared.yaml'), alias: 'common' }]
			},
			{ irType: 'event-action', files: [{ path: join(tempDir, 'other.yaml'), alias: 'default' }] }
		]);

		const catalog = await readIntentTagCatalog();
		expect(catalog.sharedWithIrTypes).toEqual(['layout']);
	});

	it('rejects a malformed master file', async () => {
		const badPath = join(tempDir, 'bad.yaml');
		await writeFile(badPath, 'tags: nope\n', 'utf8');
		useIntentTags([{ irType: 'ui-definition', files: [{ path: badPath, alias: 'common' }] }]);

		await expect(readIntentTagCatalog()).rejects.toThrow('Intent Tags マスタ（common）の形式が不正です');
	});

	it('appends to the default file keeping comments, and creates it when missing', async () => {
		const defaultPath = join(tempDir, 'default.yaml');
		await writeFile(
			defaultPath,
			"# 固有マスタ\ntags:    # ordered list\n  - id: 'auto-layout'\n    description: 自動配置\n",
			'utf8'
		);
		const layoutDefault = join(tempDir, 'nested', 'layout-default.yaml');
		useIntentTags([
			{ irType: 'ui-definition', files: [{ path: defaultPath, alias: 'default' }] },
			{ irType: 'layout', files: [{ path: defaultPath, alias: 'common' }, { path: layoutDefault, alias: 'default' }] }
		]);

		const result = await registerIntentTag('ui-definition', {
			id: 'validator:email',
			description: '1 行目\n2 行目'
		});
		expect(result.definition).toEqual({
			id: 'validator:email',
			description: '1 行目\n2 行目',
			source: 'default'
		});
		expect(result.sharedWithIrTypes).toEqual(['layout']);

		const text = await readFile(defaultPath, 'utf8');
		expect(text).toContain('# 固有マスタ');
		expect(text).toContain('# ordered list');
		expect(text).toContain("- id: 'validator:email'");
		expect(text).toContain('description: |-');
		const catalog = await readIntentTagCatalog();
		expect(catalog.tags.map((tag) => tag.id)).toEqual(['auto-layout', 'validator:email']);

		await registerIntentTag('layout', { id: 'grid', description: '' });
		const created = await readFile(layoutDefault, 'utf8');
		expect(created).toContain("- id: 'grid'");
	});

	it('rejects duplicates, bad ids, and a missing default', async () => {
		const defaultPath = join(tempDir, 'default.yaml');
		const commonPath = join(tempDir, 'common.yaml');
		await writeFile(commonPath, "tags:\n  - id: 'auto-layout'\n", 'utf8');
		useIntentTags([
			{
				irType: 'ui-definition',
				files: [
					{ path: defaultPath, alias: 'default' },
					{ path: commonPath, alias: 'common' }
				]
			},
			{ irType: 'layout', files: [{ path: commonPath, alias: 'common' }] }
		]);

		await expect(
			registerIntentTag('ui-definition', { id: 'auto-layout', description: '' })
		).rejects.toMatchObject({ httpStatus: 409 });
		await expect(
			registerIntentTag('ui-definition', { id: 'Bad Id', description: '' })
		).rejects.toMatchObject({ httpStatus: 400 });
		await expect(registerIntentTag('layout', { id: 'grid', description: '' })).rejects.toBeInstanceOf(
			IntentTagRequestError
		);
		await expect(registerIntentTag('layout', { id: 'grid', description: '' })).rejects.toMatchObject({
			httpStatus: 503
		});
	});
});
