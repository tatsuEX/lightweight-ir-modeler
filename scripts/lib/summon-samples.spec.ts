import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RestoredIrSnapshot } from '$lib/ir/snapshot';
import { summonFromSnapshot } from './summon';

const SAMPLE_DIR = resolve('templates/cli/summon/primefaces');

const sampleSnapshot: RestoredIrSnapshot = {
	version: 1,
	savedAt: '2026-08-25T00:00:00.000Z',
	uiDefinition: {
		logicalId: 'userRegistration',
		name: 'ユーザー登録',
		description: '',
		version: '1.0.0',
		createdAt: '2026-08-25T00:00:00.000Z',
		modifiedAt: '2026-08-25T00:00:00.000Z',
		external: { formId: 'userForm' }
	},
	components: [
		{
			id: 'cmp-1',
			logicalId: 'userName',
			type: 'textbox',
			label: '氏名',
			required: true,
			maxlength: 64,
			external: { widgetVar: 'userNameWv' }
		},
		{
			id: 'cmp-2',
			logicalId: 'age',
			type: 'number',
			label: '年齢',
			external: {}
		},
		{
			id: 'cmp-3',
			logicalId: 'sectionTitle',
			type: 'label',
			label: '見出し',
			external: {}
		},
		{
			id: 'cmp-4',
			logicalId: 'birthDate',
			type: 'datepicker',
			label: '生年月日',
			external: {}
		}
	]
};

/**
 * サンプル hbs を読んで描画する
 */
function renderSample(fileName: string): string {
	const templateSource = readFileSync(resolve(SAMPLE_DIR, fileName), 'utf8');
	const { output } = summonFromSnapshot({
		target: 'primefaces',
		templateSource,
		snapshot: sampleSnapshot
	});
	return output;
}

describe('templates/cli/summon/primefaces samples', () => {
	it('renders logicalId / type / label TSV', () => {
		const output = renderSample('logical-id-type-label.tsv.hbs');
		expect(output).toContain('logicalId\ttype\tlabel');
		expect(output).toContain('userName\ttextbox\t氏名');
		expect(output).toContain('age\tnumber\t年齢');
	});

	it('renders a JS object and forEach loop', () => {
		const output = renderSample('components.js.hbs');
		expect(output).toContain("const userRegistration = {");
		expect(output).toContain("logicalId: 'userName'");
		expect(output).toContain("widgetVar: 'userNameWv'");
		expect(output).toContain('userRegistration.components.forEach');
		expect(output).toContain('console.log(component.logicalId, component.type, component.label)');
	});

	it('renders CREATE TABLE DDL and skips label columns', () => {
		const output = renderSample('create-table.sql.hbs');
		expect(output).toContain('CREATE TABLE userRegistration');
		expect(output).toContain('userName VARCHAR(64) NOT NULL');
		expect(output).toContain('age INTEGER');
		expect(output).toContain('birthDate DATE');
		expect(output).not.toContain('sectionTitle');
	});
});
