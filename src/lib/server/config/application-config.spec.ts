import { describe, expect, it } from 'vitest';
import {
	deepMergeConfig,
	loadMergedApplicationConfigRoot,
	parseApplicationConfig,
	parseApplicationConfigRoot,
	resolveProfileConfigPath
} from '$lib/server/config/application-config';

describe('parseApplicationConfig', () => {
	it('parses app.name only', () => {
		const config = parseApplicationConfig(`
app:
  name: test-app
`);
		expect(config).toEqual({ app: { name: 'test-app' } });
	});

	it('parses ir.autoSave with defaults when disabled', () => {
		const config = parseApplicationConfig(`
app:
  name: test-app
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
ir:
  autoSave:
    enabled: true
    dir: ./data/ir
    maxGenerations: 1
`)
		).toThrow('ir.autoSave.maxGenerations" must be an integer >= 2');
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
		expect(config.ir).toBeUndefined();
	});
});
