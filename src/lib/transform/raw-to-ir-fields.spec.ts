import { describe, expect, it } from 'vitest';
import { mapComponentToRawField } from '$lib/transform/ir-to-raw-fields';
import { mapRawFieldToComponent } from '$lib/transform/raw-to-ir-fields';

describe('mapRawFieldToComponent', () => {
	it('folds the duplicated required flag back into validation', () => {
		expect(
			mapRawFieldToComponent({
				logicalId: 'name',
				type: 'textbox',
				label: 'Name',
				required: true
			}).validation
		).toMatchObject({ required: true });
	});

	it('carries type specific keys and residual', () => {
		const component = mapRawFieldToComponent({
			logicalId: 'category',
			type: 'radio',
			label: '区分',
			items: [{ label: 'A', value: 'a' }],
			external: { 'im-forma': { itemSystemId: 'IMF-ITEM-1' } }
		});

		expect(component.type).toBe('radio');
		if (component.type !== 'radio') {
			throw new Error('expected radio');
		}
		expect(component.items).toEqual([{ label: 'A', value: 'a' }]);
		expect(component.external).toEqual({ 'im-forma': { itemSystemId: 'IMF-ITEM-1' } });
	});

	it('falls back to unsupported for malformed input', () => {
		const component = mapRawFieldToComponent(null);
		expect(component.type).toBe('unsupported');
		if (component.type !== 'unsupported') {
			throw new Error('expected unsupported');
		}
		expect(component.logicalId).toBe('');
		expect(component.label).toBe('');
		expect(component.sourceType).toBe('');
		expect(component).not.toHaveProperty('id');
	});

	it('normalizes a vendor type to unsupported and restores it on Raw', () => {
		const component = mapRawFieldToComponent({
			logicalId: 'shape',
			type: 'product_72_shape',
			label: '図形'
		});
		expect(component.type).toBe('unsupported');
		if (component.type !== 'unsupported') {
			throw new Error('expected unsupported');
		}
		expect(component.sourceType).toBe('product_72_shape');
		expect(mapComponentToRawField(component).type).toBe('product_72_shape');
	});

	it('restores unsupported sourceType as the Raw type', () => {
		expect(
			mapComponentToRawField({
				logicalId: 'shape',
				type: 'unsupported',
				sourceType: 'product_72_shape',
				label: '図形'
			}).type
		).toBe('product_72_shape');
	});

	it('round-trips default values', () => {
		const field = {
			logicalId: 'span',
			type: 'date-span',
			label: '期間',
			defaultValueFrom: '2026-01-01',
			defaultValueTo: null
		};

		const component = mapRawFieldToComponent(field);
		expect(component.type).toBe('date-span');
		if (component.type !== 'date-span') {
			throw new Error('expected date-span');
		}
		expect(component.defaultValueFrom).toBe('2026-01-01');
		expect(component.defaultValueTo).toBeNull();
		expect(mapComponentToRawField(component)).toMatchObject({
			defaultValueFrom: '2026-01-01',
			defaultValueTo: null
		});
	});

	it('round-trips allowlisted Raw keys through mapComponentToRawField', () => {
		const field = {
			logicalId: 'name',
			type: 'textbox',
			label: 'Name',
			hint: '',
			disabled: false,
			readonly: false,
			hidden: false,
			required: true,
			validation: { required: true, maxlength: 30 },
			external: { 'im-forma': { itemSystemId: 'IMF-ITEM-1' } }
		};

		expect(mapComponentToRawField(mapRawFieldToComponent(field))).toMatchObject(field);
	});
});
