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
		).toEqual({ required: true });
	});

	it('carries type specific keys and residual', () => {
		const component = mapRawFieldToComponent({
			logicalId: 'category',
			type: 'radio',
			label: '区分',
			items: [{ label: 'A', value: 'a' }],
			external: { 'im-forma': { itemSystemId: 'IMF-ITEM-1' } }
		});

		expect(component.items).toEqual([{ label: 'A', value: 'a' }]);
		expect(component.external).toEqual({ 'im-forma': { itemSystemId: 'IMF-ITEM-1' } });
	});

	it('falls back to unknown for malformed input', () => {
		expect(mapRawFieldToComponent(null)).toEqual({ logicalId: '', type: 'unknown', label: '' });
	});

	it('round-trips through mapComponentToRawField', () => {
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

		expect(mapComponentToRawField(mapRawFieldToComponent(field))).toEqual(field);
	});
});
