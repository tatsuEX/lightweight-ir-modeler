import { describe, expect, it } from 'vitest';
import {
	deepMergeConfig,
	loadMergedApplicationConfigRoot,
	parseApplicationConfig,
	parseApplicationConfigRoot,
	resolveProfileConfigPath
} from '$lib/server/config/application-config';

const minimalPreviewYaml = `
preview:
  theme:
    default: tailwind-dark
    options:
      - name: Tailwind Dark
        value: tailwind-dark
  transformTarget:
    default: primefaces
    options:
      - name: PrimeFaces
        value: primefaces
`;

describe('parseApplicationConfig', () => {
	it('requires preview object', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
`)
		).toThrow('application config requires a "preview" object');
	});

	it('parses ir.autoSave with defaults when disabled', () => {
		const config = parseApplicationConfig(`
app:
  name: test-app
${minimalPreviewYaml}
ir:
  autoSave:
    enabled: false
    dir: ./data/ir
`);
		expect(config.ir?.autoSave).toEqual({
			enabled: false,
			delay: 500,
			dir: './data/ir',
			maxGenerations: 10
		});
	});

	it('parses enabled ir.autoSave', () => {
		const config = parseApplicationConfig(`
app:
  name: test-app
${minimalPreviewYaml}
ir:
  autoSave:
    enabled: true
    delay: 800
    dir: ./snapshots
    maxGenerations: 5
`);
		expect(config.ir?.autoSave).toEqual({
			enabled: true,
			delay: 800,
			dir: './snapshots',
			maxGenerations: 5
		});
	});

	it('requires dir when enabled is true', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
${minimalPreviewYaml}
ir:
  autoSave:
    enabled: true
`)
		).toThrow('ir.autoSave.dir" is required when enabled is true');
	});

	it('rejects invalid delay', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
${minimalPreviewYaml}
ir:
  autoSave:
    enabled: true
    delay: 0
    dir: ./data/ir
`)
		).toThrow('ir.autoSave.delay" must be a positive integer');
	});

	it('rejects invalid maxGenerations', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
${minimalPreviewYaml}
ir:
  autoSave:
    enabled: true
    dir: ./data/ir
    maxGenerations: 1
`)
		).toThrow('ir.autoSave.maxGenerations" must be an integer >= 2');
	});

	it('parses preview.theme and preview.transformTarget', () => {
		const config = parseApplicationConfig(`
app:
  name: test-app
preview:
  theme:
    default: tailwind-dark
    options:
      - name: Tailwind Dark
        value: tailwind-dark
      - name: Tailwind Light
        value: tailwind-light
  transformTarget:
    default: primefaces
    options:
      - name: PrimeFaces
        value: primefaces
`);
		expect(config.preview).toEqual({
			theme: {
				default: 'tailwind-dark',
				options: [
					{ name: 'Tailwind Dark', value: 'tailwind-dark' },
					{ name: 'Tailwind Light', value: 'tailwind-light' }
				]
			},
			transformTarget: {
				default: 'primefaces',
				options: [{ name: 'PrimeFaces', value: 'primefaces' }]
			}
		});
	});

	it('requires preview default to match an option value', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
preview:
  theme:
    default: missing
    options:
      - name: Tailwind Dark
        value: tailwind-dark
  transformTarget:
    default: primefaces
    options:
      - name: PrimeFaces
        value: primefaces
`)
		).toThrow('preview.theme.default" must match one of options[].value');
	});

	it('rejects empty preview.theme options', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
preview:
  theme:
    default: tailwind-dark
    options: []
  transformTarget:
    default: primefaces
    options:
      - name: PrimeFaces
        value: primefaces
`)
		).toThrow('preview.theme.options" must be a non-empty array');
	});

	it('rejects empty preview.transformTarget options', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
preview:
  theme:
    default: tailwind-dark
    options:
      - name: Tailwind Dark
        value: tailwind-dark
  transformTarget:
    default: primefaces
    options: []
`)
		).toThrow('preview.transformTarget.options" must be a non-empty array');
	});
});

describe('deepMergeConfig', () => {
	it('merges nested objects without replacing sibling keys', () => {
		const merged = deepMergeConfig(
			{
				app: { name: 'base-app', version: '1' },
				ir: { autoSave: { enabled: false, delay: 500 } }
			},
			{
				ir: { autoSave: { enabled: true, dir: './data/ir' } }
			}
		);

		expect(merged).toEqual({
			app: { name: 'base-app', version: '1' },
			ir: { autoSave: { enabled: true, delay: 500, dir: './data/ir' } }
		});
	});
});

describe('profile overlay', () => {
	it('resolves profile config path from base path', () => {
		expect(resolveProfileConfigPath('./config/application.yml', 'dev')).toMatch(
			/application-dev\.yml$/
		);
	});

	it('loads base and dev overlay like Spring profiles', () => {
		const mergedRoot = loadMergedApplicationConfigRoot('./config/application.yml', 'dev');
		const config = parseApplicationConfigRoot(mergedRoot);

		expect(config.app.name).toBe('lightweight-ir-modeler');
		expect(config.ir?.autoSave).toEqual({
			enabled: true,
			delay: 500,
			dir: './data/ir',
			maxGenerations: 10
		});
	});

	it('loads base only when profile is omitted', () => {
		const mergedRoot = loadMergedApplicationConfigRoot('./config/application.yml');
		const config = parseApplicationConfigRoot(mergedRoot);

		expect(config.app.name).toBe('lightweight-ir-modeler');
		expect(config.app.io?.exportDir).toBe('./data/export');
		expect(config.app.io?.export?.templates?.primefaces?.dir).toBe(
			'./templates/export/primefaces'
		);
		expect(config.ir).toBeUndefined();
		expect(config.preview.theme.default).toBe('tailwind-light');
		expect(config.preview.transformTarget.options).toHaveLength(2);
		expect(config.preview.transformTarget.options.map((option) => option.value)).toEqual([
			'primefaces',
			'im-forma'
		]);
	});
});

describe('app.io', () => {
	it('parses exportDir', () => {
		const config = parseApplicationConfig(`
app:
  name: test-app
  io:
    exportDir: ./data/export
${minimalPreviewYaml}
`);
		expect(config.app.io).toEqual({ exportDir: './data/export' });
	});

	it('rejects empty exportDir', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
  io:
    exportDir: "  "
${minimalPreviewYaml}
`)
		).toThrow('app.io.exportDir" must be a non-empty string when set');
	});

	it('parses export.templates.<targetId>.dir', () => {
		const config = parseApplicationConfig(`
app:
  name: test-app
  io:
    exportDir: ./data/export
    export:
      templates:
        primefaces:
          dir: ./templates/export/primefaces
${minimalPreviewYaml}
`);
		expect(config.app.io?.export?.templates).toEqual({
			primefaces: { dir: './templates/export/primefaces' }
		});
	});

	it('rejects empty export.templates.<targetId>.dir', () => {
		expect(() =>
			parseApplicationConfig(`
app:
  name: test-app
  io:
    export:
      templates:
        primefaces:
          dir: "  "
${minimalPreviewYaml}
`)
		).toThrow('app.io.export.templates.primefaces.dir" must be a non-empty string');
	});
});
