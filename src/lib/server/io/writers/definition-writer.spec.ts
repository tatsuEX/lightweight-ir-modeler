import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
	loadApplicationConfig: vi.fn()
}));

vi.mock('$lib/server/config/application-config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config/application-config')>();
	return {
		...actual,
		loadApplicationConfig: mockConfig.loadApplicationConfig,
		// WARN: 同一モジュール内参照のため resolveExportTemplateDir も差し替える
		resolveExportTemplateDir: (targetId: string) => {
			const dir =
				mockConfig.loadApplicationConfig().app.io?.export?.templates?.[targetId]?.dir?.trim();
			if (!dir) {
				throw new Error(
					`application config "app.io.export.templates.${targetId}.dir" is not configured`
				);
			}
			return actual.resolveApplicationPath(dir);
		}
	};
});

import { IMFormaWriter } from '$lib/server/io/writers/im-forma-writer';
import { PrimeFacesWriter } from '$lib/server/io/writers/primefaces-writer';
import { clearHandlebarsTemplateCache } from '$lib/server/io/writers/serialize/serialize-handlebars';

describe('DefinitionWriter', () => {
	beforeEach(() => {
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: {
				name: 'test',
				io: {
					exportDir: './data/export',
					export: {
						templates: {
							primefaces: {
								dir: resolve(process.cwd(), 'templates/export/primefaces')
							}
						}
					}
				}
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

	afterEach(() => {
		clearHandlebarsTemplateCache();
		vi.clearAllMocks();
	});

	it('PrimeFacesWriter owns xhtml filename and content', () => {
		const writer = new PrimeFacesWriter();
		expect(writer.describeArtifact('myForm')).toEqual({
			filename: 'myForm.xhtml',
			contentType: 'application/xhtml+xml; charset=utf-8'
		});

		const artifact = writer.toArtifact({
			target: 'primefaces',
			logicalId: 'myForm',
			name: 'My Form',
			fields: [{ logicalId: 'name', type: 'textbox', required: true }]
		});

		expect(artifact.filename).toBe('myForm.xhtml');
		expect(artifact.content).toContain('<p:outputLabel for="name"');
		expect(artifact.content).toMatch(/<p:inputText[\s\S]*?id="name"[\s\S]*?required="true"/);
		expect(artifact.content).toContain('id="myForm"');
	});

	it('PrimeFacesWriter escapes user strings via Handlebars default', () => {
		const writer = new PrimeFacesWriter();
		const artifact = writer.toArtifact({
			target: 'primefaces',
			logicalId: 'myForm',
			name: 'My Form',
			fields: [
				{
					logicalId: 'name',
					type: 'textbox',
					label: '<script>',
					hint: '"quoted"'
				}
			]
		});

		// label は form.hbs の outputLabel、hint は component テンプレート
		expect(artifact.content).toContain('value="&lt;script&gt;"');
		expect(artifact.content).toContain('placeholder="&quot;quoted&quot;"');
		expect(artifact.content).not.toContain('value="<script>"');
	});

	it('PrimeFacesWriter renders per-component templates and unsupported fallback', () => {
		const writer = new PrimeFacesWriter();
		const artifact = writer.toArtifact({
			target: 'primefaces',
			logicalId: 'myForm',
			name: 'My Form',
			fields: [
				{ logicalId: 'a', type: 'textarea', label: 'A' },
				{ logicalId: 'b', type: 'number', label: 'B' },
				{ logicalId: 'c', type: 'datepicker', label: 'C' },
				{
					logicalId: 'd',
					type: 'checkbox',
					label: 'D',
					items: [{ label: 'Sun', value: 'sun' }]
				},
				{ logicalId: 'e', type: 'not-a-real-type', label: 'E' }
			]
		});

		expect(artifact.content).toContain('xmlns:f="http://xmlns.jcp.org/jsf/core"');
		expect(artifact.content).toContain('<p:outputLabel for="a" value="A" />');
		expect(artifact.content).toMatch(/<p:inputTextarea[\s\S]*?id="a"[\s\S]*?><\/p:inputTextarea>/);
		expect(artifact.content).toMatch(/<p:inputNumber[\s\S]*?id="b"/);
		expect(artifact.content).toMatch(/<p:datePicker[\s\S]*?id="c"[\s\S]*?pattern="yyyy-MM-dd"/);
		expect(artifact.content).toMatch(/<p:selectManyCheckbox[\s\S]*?id="d"/);
		expect(artifact.content).toContain('<f:selectItem itemValue="sun" itemLabel="Sun" />');
		expect(artifact.content).toContain('<!-- unsupported type: not-a-real-type id=e -->');
	});

	it('IMFormaWriter owns json filename and content', () => {
		const writer = new IMFormaWriter();
		expect(writer.describeArtifact('myForm')).toEqual({
			filename: 'myForm.json',
			contentType: 'application/json; charset=utf-8'
		});

		const artifact = writer.toArtifact({
			target: 'im-forma',
			logicalId: 'myForm',
			name: 'My Form',
			items: [{ logicalId: 'name', type: 'textbox', required: true }]
		});

		expect(artifact.filename).toBe('myForm.json');
		expect(JSON.parse(artifact.content)).toMatchObject({
			formId: 'myForm',
			formName: 'My Form',
			items: [{ logicalId: 'name', type: 'textbox', required: true }]
		});
	});
});
