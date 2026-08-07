import { describe, expect, it } from 'vitest';
import { transformToImFormaRaw } from '$lib/transform/im-forma-transform';
import { transformToPrimeFacesRaw } from '$lib/transform/primefaces-transform';

const meta = {
	logicalId: 'myForm',
	name: 'My Form',
	description: 'demo',
	version: '1.0.0'
};

const components = [
	{
		id: 'internal',
		logicalId: 'name',
		type: 'textbox',
		label: 'Name',
		validation: { required: true }
	}
];

describe('IR to Raw transforms', () => {
	it('builds primefaces RawDefinition with fields', () => {
		const raw = transformToPrimeFacesRaw(meta, components);
		expect(raw.target).toBe('primefaces');
		expect(raw.logicalId).toBe('myForm');
		expect(raw.fields).toEqual([
			expect.objectContaining({
				logicalId: 'name',
				type: 'textbox',
				label: 'Name',
				required: true
			})
		]);
	});

	it('builds im-forma RawDefinition with items', () => {
		const raw = transformToImFormaRaw(meta, components);
		expect(raw.target).toBe('im-forma');
		expect(raw.logicalId).toBe('myForm');
		expect(raw.items).toEqual([
			expect.objectContaining({
				logicalId: 'name',
				type: 'textbox',
				label: 'Name',
				required: true
			})
		]);
	});
});
