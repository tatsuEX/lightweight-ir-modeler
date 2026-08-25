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
			out: './c.js'
		});
	});

	it('rejects unknown arguments', () => {
		expect(() => parseSummonCliArgs(['--nope'])).toThrow('unknown argument: --nope');
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
});
