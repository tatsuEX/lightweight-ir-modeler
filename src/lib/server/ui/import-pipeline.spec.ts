import { afterEach, describe, expect, it } from 'vitest';
import { invalidateRawZodSchema } from '$lib/schema/json-schema-loader';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { validateRawDefinition } from '$lib/schema/validate-raw';
import { resetZodLocaleForTests } from '$lib/schema/zod-locale';
import { DefinitionReadError } from '$lib/server/io/readers/definition-reader';
import { IMFormaWriter } from '$lib/server/io/writers/im-forma-writer';
import { importFromUploadedFile } from '$lib/server/ui/import-pipeline';
import { transformToImFormaRaw } from '$lib/transform/im-forma-transform';

/** ベンダー固有のシステム ID を含む IM-Forma 定義ファイル */
const imFormaDocument = {
	formSystemId: 'IMF-FORM-0001',
	revision: 7,
	formId: 'applyForm',
	formName: '申請フォーム',
	description: '取込テスト',
	version: '1.0.0',
	items: [
		{
			itemSystemId: 'IMF-ITEM-0001',
			logicalId: 'applicantName',
			type: 'textbox',
			label: '申請者名',
			hint: '全角で入力',
			disabled: false,
			readonly: false,
			hidden: false,
			required: true,
			validation: { required: true, maxlength: 30 }
		},
		{
			itemSystemId: 'IMF-ITEM-0002',
			logicalId: 'category',
			type: 'radio',
			label: '区分',
			hint: '',
			disabled: false,
			readonly: false,
			hidden: false,
			required: false,
			validation: { required: false },
			items: [
				{ label: 'A', value: 'a' },
				{ label: 'B', value: 'b' }
			]
		}
	]
};

/**
 * IM-Forma 定義ファイルの取り込み用 source を組み立てる
 */
function sourceOf(payload: unknown, filename = 'applyForm.json') {
	return { filename, content: JSON.stringify(payload) };
}

describe('importFromUploadedFile', () => {
	afterEach(() => {
		invalidateRawZodSchema();
		resetZodLocaleForTests();
	});

	it('converts an IM-Forma document into editor meta and components', () => {
		const imported = importFromUploadedFile('im-forma', sourceOf(imFormaDocument));

		expect(imported.uiDefinition).toEqual({
			logicalId: 'applyForm',
			name: '申請フォーム',
			description: '取込テスト',
			version: '1.0.0',
			external: { 'im-forma': { formSystemId: 'IMF-FORM-0001', revision: 7 } }
		});
		expect(imported.components).toHaveLength(2);
		expect(imported.components[0]).toMatchObject({
			logicalId: 'applicantName',
			type: 'textbox',
			validation: { required: true, maxlength: 30 },
			external: { 'im-forma': { itemSystemId: 'IMF-ITEM-0001' } }
		});
	});

	it('restores the original document on the next export', () => {
		const imported = importFromUploadedFile('im-forma', sourceOf(imFormaDocument));
		const raw = transformToImFormaRaw(imported.uiDefinition, imported.components);
		validateRawDefinition('im-forma', raw);

		expect(JSON.parse(new IMFormaWriter().toArtifact(raw).content)).toEqual(imFormaDocument);
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

	it('rejects a document whose formId is not a valid logicalId', () => {
		expect(() =>
			importFromUploadedFile('im-forma', sourceOf({ ...imFormaDocument, formId: '1-invalid' }))
		).toThrow(RawValidationError);
	});
});
