import { describe, expect, it } from 'vitest';
import { acceptsFilename, DefinitionReadError } from '$lib/server/io/readers/definition-reader';
import { IMFormaReader } from '$lib/server/io/readers/im-forma-reader';

const reader = new IMFormaReader();

describe('IMFormaReader', () => {
	it('reads a JSON definition into Raw', () => {
		const raw = reader.toRaw({
			filename: 'myForm.json',
			content: JSON.stringify({
				formId: 'myForm',
				formName: 'My Form',
				items: [{ logicalId: 'name', type: 'textbox', label: 'Name' }]
			})
		});

		expect(raw.target).toBe('im-forma');
		expect(raw.logicalId).toBe('myForm');
	});

	it('raises a read error for broken JSON', () => {
		expect(() => reader.toRaw({ filename: 'broken.json', content: '{' })).toThrow(
			DefinitionReadError
		);
	});

	it('raises a read error for a non object document', () => {
		expect(() => reader.toRaw({ filename: 'array.json', content: '[]' })).toThrow(
			DefinitionReadError
		);
	});

	it('accepts only json filenames', () => {
		expect(acceptsFilename(reader, 'myForm.JSON')).toBe(true);
		expect(acceptsFilename(reader, 'myForm.xhtml')).toBe(false);
	});
});
