import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { invalidateRawZodSchema } from '$lib/schema/json-schema-loader';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { validateRawDefinition } from '$lib/schema/validate-raw';
import { resetZodLocaleForTests } from '$lib/schema/zod-locale';
import { DefinitionReadError } from '$lib/server/io/readers/definition-reader';
import { IMFormaWriter } from '$lib/server/io/writers/im-forma-writer';
import { serializeFormaJson } from '$lib/server/io/writers/serialize/serialize-forma-json';
import { importFromUploadedFile } from '$lib/server/ui/import-pipeline';
import { transformToImFormaRaw } from '$lib/transform/im-forma-transform';

/** 最小の実 Forma 画面定義フィクスチャ */
const imFormaDocument = {
	header: {
		display_available: true,
		item_view_name: { ja: '' },
		label_name: { ja: '申請フォーム' },
		left_toolbar_icon_list: [],
		right_toolbar_icon_list: []
	},
	item_list: [
		{
			item_id: 'abcdefghijkl',
			item_view_names: { ja: '申請者名' },
			item_type: 'product_72_textbox',
			item_view_type: {
				REGISTRATION: '1',
				EDIT: '1',
				REFERENCE: '2',
				POSTSCRIPT: '2'
			},
			item_exist_dbinput: true,
			style: { top: 10, left: 10, width: 120, height: 25, zindex: null },
			input_list: [
				{
					input_id: 'applicantName',
					input_data_type: '0',
					input_view_names: { ja: '申請者名' },
					input_dbinput: true,
					input_properties: {
						required: true,
						max_length: 30,
						min_length: 0
					}
				}
			],
			item_properties: { labels: [{ ja: '申請者名' }], label_size: [], label_styles: [] }
		},
		{
			item_id: 'radioitem0001',
			item_view_names: { ja: '区分' },
			item_type: 'product_72_radio',
			item_view_type: {
				REGISTRATION: '1',
				EDIT: '1',
				REFERENCE: '2',
				POSTSCRIPT: '2'
			},
			item_exist_dbinput: true,
			style: { top: 40, left: 10, width: 200, height: 30, zindex: null },
			input_list: [
				{
					input_id: 'category',
					input_data_type: '0',
					input_view_names: { ja: '区分' },
					input_dbinput: true,
					input_properties: { required: false, max_length: 10, min_length: 0 },
					property_setting: [
						{ send_value: 'a', display_names: { ja: 'A' } },
						{ send_value: 'b', display_names: { ja: 'B' } }
					]
				}
			],
			item_properties: { labels: [{ ja: '区分' }], label_size: [], label_styles: [] }
		}
	],
	footer: { display_available: true },
	event: {
		event_setting_list: [],
		action_setting_list: {},
		table_event_setting_list: [],
		table_action_setting_list: [],
		form_action_setting_list: {}
	},
	sp_item_list: [],
	shared_resource: { display_available: false, use_lock: false, display_position: '' }
};

/**
 * IM-Forma 定義ファイルの取り込み用 source を組み立てる
 */
function sourceOf(payload: unknown, filename = 'applyForm.json') {
	return { filename, content: serializeFormaJson(payload) };
}

describe('importFromUploadedFile', () => {
	afterEach(() => {
		invalidateRawZodSchema();
		resetZodLocaleForTests();
	});

	it('converts a Forma screen document into editor meta and components', () => {
		const imported = importFromUploadedFile('im-forma', sourceOf(imFormaDocument));

		expect(imported.uiDefinition.logicalId).toBe('applyForm');
		expect(imported.uiDefinition.name).toBe('申請フォーム');
		expect(imported.uiDefinition.external?.['im-forma']?.importBase).toEqual(imFormaDocument);
		expect(imported.components).toHaveLength(2);
		expect(imported.components[0]).toMatchObject({
			logicalId: 'applicantName',
			type: 'textbox',
			validation: { required: true, maxlength: 30, minlength: 0 },
			external: {
				'im-forma': expect.objectContaining({ item_id: 'abcdefghijkl' })
			}
		});
		expect(imported.components[1]).toMatchObject({
			logicalId: 'category',
			type: 'radio',
			items: [
				{ value: 'a', label: 'A' },
				{ value: 'b', label: 'B' }
			]
		});
	});

	it('restores the original document on the next export', () => {
		const imported = importFromUploadedFile('im-forma', sourceOf(imFormaDocument));
		const raw = transformToImFormaRaw(imported.uiDefinition, imported.components);
		validateRawDefinition('im-forma', raw);

		expect(JSON.parse(new IMFormaWriter().toArtifact(raw).content)).toEqual(imFormaDocument);
	});

	it('round-trips application_form.json without edits', () => {
		const content = readFileSync(
			resolve(process.cwd(), '.samples/forma/application_form.json'),
			'utf8'
		);
		const imported = importFromUploadedFile('im-forma', {
			filename: 'application_form.json',
			content
		});
		const raw = transformToImFormaRaw(imported.uiDefinition, imported.components);
		validateRawDefinition('im-forma', raw);
		const artifact = new IMFormaWriter().toArtifact(raw);

		expect(JSON.parse(artifact.content)).toEqual(JSON.parse(content));
		expect(artifact.content).toBe(content);
	});

	it('rejects an unsupported target', () => {
		expect(() => importFromUploadedFile('not-a-target', sourceOf(imFormaDocument))).toThrow(
			'unsupported import target: not-a-target'
		);
	});

	it('rejects an unexpected file extension', () => {
		expect(() =>
			importFromUploadedFile('im-forma', sourceOf(imFormaDocument, 'applyForm.xhtml'))
		).toThrow(DefinitionReadError);
	});

	it('rejects a datamapper Family B file', () => {
		expect(() =>
			importFromUploadedFile('im-forma', {
				filename: '8hs3wpe7xg389il.json',
				content: readFileSync(
					resolve(process.cwd(), '.samples/forma/8hs3wpe7xg389il.json'),
					'utf8'
				)
			})
		).toThrow(DefinitionReadError);
	});

	it('accepts numeric filename stems via f_ prefix', () => {
		const content = readFileSync(
			resolve(process.cwd(), '.samples/forma/8hvx450fu9l31il.json'),
			'utf8'
		);
		const imported = importFromUploadedFile('im-forma', {
			filename: '8hvx450fu9l31il.json',
			content
		});
		expect(imported.uiDefinition.logicalId).toBe('f_8hvx450fu9l31il');
		const raw = transformToImFormaRaw(imported.uiDefinition, imported.components);
		expect(() => validateRawDefinition('im-forma', raw)).not.toThrow(RawValidationError);
	});
});
