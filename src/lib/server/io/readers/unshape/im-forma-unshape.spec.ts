import { describe, expect, it } from 'vitest';
import { unshapeImForma } from '$lib/server/io/readers/unshape/im-forma-unshape';
import { shapeImForma } from '$lib/server/io/writers/shape/im-forma-shape';

describe('unshapeImForma', () => {
	it('maps IM-Forma payload keys back to Raw vocabulary', () => {
		expect(
			unshapeImForma({
				formId: 'myForm',
				formName: 'My Form',
				description: 'desc',
				version: '1.0',
				items: [{ logicalId: 'name', type: 'textbox', label: 'Name' }]
			})
		).toEqual({
			target: 'im-forma',
			logicalId: 'myForm',
			name: 'My Form',
			description: 'desc',
			version: '1.0',
			items: [{ logicalId: 'name', type: 'textbox', label: 'Name' }]
		});
	});

	it('keeps vendor specific keys as target scoped residual', () => {
		const raw = unshapeImForma({
			formSystemId: 'IMF-FORM-1',
			formId: 'myForm',
			formName: 'My Form',
			items: [{ itemSystemId: 'IMF-ITEM-1', logicalId: 'name', type: 'textbox', label: 'Name' }]
		});

		expect(raw.external).toEqual({ 'im-forma': { formSystemId: 'IMF-FORM-1' } });
		expect((raw.items as Record<string, unknown>[])[0].external).toEqual({
			'im-forma': { itemSystemId: 'IMF-ITEM-1' }
		});
	});

	it('is the inverse of shapeImForma for a shaped payload', () => {
		const raw = {
			target: 'im-forma',
			logicalId: 'myForm',
			name: 'My Form',
			description: '',
			version: '1.0.0',
			items: [{ logicalId: 'name', type: 'textbox', label: 'Name' }],
			external: { 'im-forma': { formSystemId: 'IMF-FORM-1' } }
		};

		expect(unshapeImForma(shapeImForma(raw))).toEqual(raw);
	});

	it('rejects non object payloads', () => {
		expect(() => unshapeImForma('[]')).toThrow();
	});
});
