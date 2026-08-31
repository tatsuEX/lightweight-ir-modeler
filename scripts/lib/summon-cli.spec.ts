import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializeIrSnapshot } from '$lib/ir/snapshot';
import { createEmptyUiDefinitionMeta } from '$lib/ir/ui-definition-meta';
import { parseSummonCliArgs, runSummonCli } from './summon-cli';
import { missingTargetResidualWarning } from './summon';

/**
 * 一時ディレクトリに snapshot と template を置く
 */
function writeSummonFixtures(options: { yamlText: string; templateSource: string }): {
	sourcePath: string;
	templatePath: string;
} {
	const dir = mkdtempSync(join(tmpdir(), 'arcane-summon-'));
	const sourcePath = join(dir, 'ir-snapshot.yaml');
	const templatePath = join(dir, 'create-events.js.hbs');
	writeFileSync(sourcePath, options.yamlText, 'utf8');
	writeFileSync(templatePath, options.templateSource, 'utf8');
	return { sourcePath, templatePath };
}

describe('parseSummonCliArgs', () => {
	it('reads required flags and --out', () => {
		expect(
			parseSummonCliArgs([
				'--target',
				'primefaces',
				'--template',
				'./a.hbs',
				'--source',
				'./b.yaml',
				'-o',
				'./c.js'
			])
		).toEqual({
			help: false,
			target: 'primefaces',
			template: './a.hbs',
			source: './b.yaml',
			out: './c.js',
			projectionIds: undefined,
			bytesPerChar: undefined
		});
	});

	it('rejects unknown arguments', () => {
		expect(() => parseSummonCliArgs(['--nope'])).toThrow('unknown argument: --nope');
	});

	it('reads --projection and --bytes-per-char', () => {
		expect(
			parseSummonCliArgs([
				'--target',
				'primefaces',
				'--template',
				'./a.hbs',
				'--source',
				'./b.yaml',
				'--projection',
				'by-logical-id, db-maxlength',
				'--bytes-per-char',
				'4'
			])
		).toEqual({
			help: false,
			target: 'primefaces',
			template: './a.hbs',
			source: './b.yaml',
			out: undefined,
			projectionIds: ['by-logical-id', 'db-maxlength'],
			bytesPerChar: 4
		});
	});

	it('rejects a non-positive --bytes-per-char', () => {
		expect(() =>
			parseSummonCliArgs(['--target', 'x', '--template', 'a', '--source', 'b', '--bytes-per-char', '0'])
		).toThrow('--bytes-per-char must be a positive integer');
	});
});

describe('runSummonCli', () => {
	it('renders from snapshot and template files', () => {
		const yamlText = serializeIrSnapshot({
			version: 1,
			savedAt: '2026-08-25T00:00:00.000Z',
			uiDefinition: {
				...createEmptyUiDefinitionMeta(),
				logicalId: 'userRegistration',
				name: 'ユーザー登録',
				createdAt: '2026-08-25T00:00:00.000Z',
				modifiedAt: '2026-08-25T00:00:00.000Z',
				external: { primefaces: { formId: 'userForm' } }
			},
			components: [
				{
					type: 'textbox',
					external: { primefaces: { widgetVar: 'nameWv' } }
				}
			]
		});
		const { sourcePath, templatePath } = writeSummonFixtures({
			yamlText,
			templateSource: '{{external.formId}}-{{#each components}}{{external.widgetVar}}{{/each}}'
		});

		const result = runSummonCli([
			'--target',
			'primefaces',
			'--template',
			templatePath,
			'--source',
			sourcePath
		]);

		expect(result.warnings).toEqual([]);
		expect(result.outPath).toBeUndefined();
		expect(result.output).toBe('userForm-nameWv');
	});

	it('warns when the target residual is missing', () => {
		const yamlText = serializeIrSnapshot({
			version: 1,
			savedAt: '2026-08-25T00:00:00.000Z',
			components: [{ type: 'textbox' }]
		});
		const { sourcePath, templatePath } = writeSummonFixtures({
			yamlText,
			templateSource: '{{target}}'
		});

		const result = runSummonCli([
			'--target',
			'unknown-target',
			'--template',
			templatePath,
			'--source',
			sourcePath
		]);

		expect(result.output).toBe('unknown-target');
		expect(result.warnings).toEqual([missingTargetResidualWarning('unknown-target')]);
	});

	it('applies by-logical-id when --projection is set', () => {
		const yamlText = serializeIrSnapshot({
			version: 1,
			savedAt: '2026-08-25T00:00:00.000Z',
			uiDefinition: {
				...createEmptyUiDefinitionMeta(),
				logicalId: 'userRegistration',
				name: 'ユーザー登録',
				createdAt: '2026-08-25T00:00:00.000Z',
				modifiedAt: '2026-08-25T00:00:00.000Z'
			},
			components: [
				{
					logicalId: 'userName',
					type: 'textbox',
					label: '氏名',
					validation: { maxlength: 30 }
				}
			]
		});
		const { sourcePath, templatePath } = writeSummonFixtures({
			yamlText,
			templateSource:
				'{{componentsByLogicalId.userName.logicalId}}:{{componentsByLogicalId.userName.validation.dbMaxlength}}'
		});

		const result = runSummonCli([
			'--target',
			'primefaces',
			'--template',
			templatePath,
			'--source',
			sourcePath,
			'--projection',
			'by-logical-id,db-maxlength'
		]);

		expect(result.output).toBe('userName:90');
	});
});
