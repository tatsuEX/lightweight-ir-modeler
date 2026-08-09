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
					required: true,
					disabled: false,
					readonly: false
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
			fields: [
				{
					id: 'ok',
					type: 'number',
					label: 'N',
					hint: '',
					required: false,
					disabled: false,
					readonly: false
				}
			]
		});
	});

	it('shapes select fields with normalized items', () => {
		const shaped = shapePrimeFaces({
			target: 'primefaces',
			logicalId: 'myForm',
			name: 'My Form',
			fields: [
				{
					logicalId: 'days',
					type: 'checkbox',
					label: 'Days',
					items: [{ label: 'Sun', value: 'sun' }, 'mon']
				},
				{
					logicalId: 'sort',
					type: 'dropdown',
					label: 'Sort',
					required: true,
					items: [{ label: 'Popular', value: 'popular' }]
				}
			]
		});

		expect(shaped.fields).toEqual([
			{
				id: 'days',
				type: 'checkbox',
				label: 'Days',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				items: [
					{ label: 'Sun', value: 'sun' },
					{ label: 'mon', value: 'mon' }
				]
			},
			{
				id: 'sort',
				type: 'dropdown',
				label: 'Sort',
				hint: '',
				required: true,
				disabled: false,
				readonly: false,
				items: [{ label: 'Popular', value: 'popular' }]
			}
		]);
	});

	it('shapes date family with format defaults and date-span flags', () => {
		const shaped = shapePrimeFaces({
			target: 'primefaces',
			logicalId: 'myForm',
			name: 'My Form',
			fields: [
				{ logicalId: 'd', type: 'datepicker', label: 'D' },
				{ logicalId: 'dt', type: 'datetimepicker', label: 'DT', clearable: true },
				{ logicalId: 't', type: 'timepicker', label: 'T', format: 'HH:mm:ss' },
				{
					logicalId: 'span',
					type: 'date-span',
					label: 'Span',
					validation: { requiredFrom: true, requiredTo: true }
				}
			]
		});

		expect(shaped.fields).toEqual([
			{
				id: 'd',
				type: 'datepicker',
				label: 'D',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				format: 'yyyy-MM-dd',
				placeholder: 'yyyy-MM-dd',
				clearable: false
			},
			{
				id: 'dt',
				type: 'datetimepicker',
				label: 'DT',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				format: 'yyyy-MM-dd HH:mm',
				placeholder: 'yyyy-MM-dd HH:mm',
				clearable: true
			},
			{
				id: 't',
				type: 'timepicker',
				label: 'T',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				format: 'HH:mm:ss',
				placeholder: 'HH:mm:ss',
				clearable: false
			},
			{
				id: 'span',
				type: 'date-span',
				label: 'Span',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				format: 'yyyy-MM-dd',
				placeholder: 'yyyy-MM-dd',
				clearable: false,
				requiredFrom: true,
				requiredTo: true
			}
		]);
	});
});
