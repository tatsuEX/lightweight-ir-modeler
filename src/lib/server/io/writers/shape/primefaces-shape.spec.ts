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
				placeholder: '____-__-__',
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
				placeholder: '____-__-__ __:__',
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
				placeholder: '__:__:__',
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
				placeholder: '____-__-__',
				clearable: false,
				requiredFrom: true,
				requiredTo: true
			}
		]);
	});

	it('copies a literal default and a textbox pattern', () => {
		const shaped = shapePrimeFaces({
			target: 'primefaces',
			logicalId: 'myForm',
			name: 'My Form',
			fields: [
				{
					logicalId: 'name',
					type: 'textbox',
					label: 'Name',
					defaultValue: '太郎',
					validation: { pattern: '.{1,30}' }
				},
				{
					logicalId: 'qty',
					type: 'number',
					label: 'Qty',
					defaultValue: 0
				}
			]
		});

		expect(shaped.fields[0]).toMatchObject({ defaultValue: '太郎', pattern: '.{1,30}' });
		expect(shaped.fields[1]).toMatchObject({ defaultValue: '0' });
	});

	it('copies IR lineage keys onto form context when present', () => {
		expect(
			shapePrimeFaces({
				target: 'primefaces',
				logicalId: 'myForm',
				name: 'My Form',
				description: 'Screen',
				version: '1.1',
				basedOn: '1.0',
				changeReason: 'メタ修正',
				fields: []
			})
		).toMatchObject({
			formId: 'myForm',
			name: 'My Form',
			description: 'Screen',
			version: '1.1',
			basedOn: '1.0',
			changeReason: 'メタ修正',
			fields: []
		});
	});
});
