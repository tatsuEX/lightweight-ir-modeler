import { describe, expect, it } from 'vitest';
import { IMFormaWriter } from '$lib/server/io/writers/im-forma-writer';
import { PrimeFacesWriter } from '$lib/server/io/writers/primefaces-writer';

describe('DefinitionWriter', () => {
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
		expect(artifact.content).toContain('<p:inputText id="name" required="true" />');
		expect(artifact.content).toContain('id="myForm"');
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
