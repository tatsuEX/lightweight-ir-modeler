import { describe, expect, it } from 'vitest';
import { shapePrimeFaces } from '$lib/server/io/writers/shape/primefaces-shape';

describe('shapePrimeFaces', () => {
	it('maps fields for Handlebars context without escaping', () => {
		expect(
			shapePrimeFaces({
				target: 'primefaces',
				logicalId: 'myForm',
				name: 'My Form',
				fields: [
					{
						logicalId: 'name',
						type: 'textbox',
						label: '<b>Name</b>',
						hint: 'x',
						required: true
					}
				]
			})
		).toEqual({
			formId: 'myForm',
			name: 'My Form',
			fields: [
				{
					id: 'name',
					type: 'textbox',
					label: '<b>Name</b>',
					hint: 'x',
					required: true
				}
			]
		});
	});

	it('skips non-object fields and defaults empty collections', () => {
		expect(
			shapePrimeFaces({
				target: 'primefaces',
				logicalId: 'myForm',
				name: 'My Form',
				fields: [null, 'x', { logicalId: 'ok', type: 'number', label: 'N' }]
			})
		).toEqual({
			formId: 'myForm',
			name: 'My Form',
			fields: [{ id: 'ok', type: 'number', label: 'N', hint: '', required: false }]
		});
	});
});
