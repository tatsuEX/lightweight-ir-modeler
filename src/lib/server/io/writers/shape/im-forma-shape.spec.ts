import { describe, expect, it } from 'vitest';
import { shapeImForma } from '$lib/server/io/writers/shape/im-forma-shape';

describe('shapeImForma', () => {
	it('maps Raw keys to IM-Forma transport payload', () => {
		expect(
			shapeImForma({
				target: 'im-forma',
				logicalId: 'myForm',
				name: 'My Form',
				description: 'desc',
				version: '1.0',
				items: [{ logicalId: 'name', type: 'textbox', label: 'Name' }]
			})
		).toEqual({
			formId: 'myForm',
			formName: 'My Form',
			description: 'desc',
			version: '1.0',
			items: [{ logicalId: 'name', type: 'textbox', label: 'Name' }]
		});
	});

	it('fills defaults for missing optional fields', () => {
		expect(
			shapeImForma({
				target: 'im-forma',
				logicalId: 'myForm',
				name: 'My Form'
			})
		).toEqual({
			formId: 'myForm',
			formName: 'My Form',
			description: '',
			version: '',
			items: []
		});
	});
});
