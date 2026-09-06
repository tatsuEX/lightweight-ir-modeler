import { describe, expect, it } from 'vitest';
import { UIDefinition, createUiDefinitionData } from '$lib/ir/ui-definition';

describe('UIDefinition', () => {
	it('mutates the injected meta and components', () => {
		const data = createUiDefinitionData({
			logicalId: 'screenA',
			name: 'Screen A',
			description: '',
			version: '1.0'
		});
		const ui = new UIDefinition(data);

		ui.meta.name = 'Renamed';
		ui.append({ id: 'c1', type: 'textbox', label: 'Name' });

		expect(data.meta.name).toBe('Renamed');
		expect(data.components).toHaveLength(1);
		expect(ui.components[0].id).toBe('c1');
	});

	it('loadSnapshot replaces meta and components', () => {
		const ui = new UIDefinition(
			createUiDefinitionData({
				logicalId: '',
				name: '',
				description: '',
				version: '1.0'
			})
		);

		ui.loadSnapshot(
			[{ id: 'a', type: 'label', label: 'Hi' }],
			{
				logicalId: 'screenA',
				name: 'Screen A',
				description: 'd',
				version: '1.1',
				basedOn: '1.0',
				changeReason: '読込'
			}
		);

		expect(ui.meta.logicalId).toBe('screenA');
		expect(ui.meta.basedOn).toBe('1.0');
		expect(ui.meta.changeReason).toBe('読込');
		expect(ui.meta.releasedAt).toBe('');
		expect(ui.components).toHaveLength(1);
		expect(ui.components[0].type).toBe('label');
		expect(ui.components[0].id).toBe('a');
	});

	it('loadSnapshot hydrates vendor types to unsupported', () => {
		const ui = new UIDefinition(
			createUiDefinitionData({
				logicalId: 's',
				name: 'S',
				description: '',
				version: '1.0'
			})
		);

		ui.loadSnapshot([{ id: 'v1', type: 'product_72_shape', label: '図形' }]);

		expect(ui.components[0].type).toBe('unsupported');
		const component = ui.components[0];
		if (component.type !== 'unsupported') {
			throw new Error('expected unsupported');
		}
		expect(component.sourceType).toBe('product_72_shape');
	});

	it('removeByIds and moveItem update the list', () => {
		const ui = new UIDefinition(
			createUiDefinitionData({
				logicalId: 's',
				name: 'S',
				description: '',
				version: '1.0'
			})
		);
		ui.replaceComponents([
			{ id: 'a', type: 'label' },
			{ id: 'b', type: 'label' },
			{ id: 'c', type: 'label' }
		]);
		ui.moveItem(2, 0);
		expect(ui.components.map((component) => component.id)).toEqual(['c', 'a', 'b']);
		ui.removeByIds(['a']);
		expect(ui.components.map((component) => component.id)).toEqual(['c', 'b']);
	});
});
