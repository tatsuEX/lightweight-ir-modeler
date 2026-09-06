import { describe, expect, it } from 'vitest';
import { createComponentByType, createTextbox, isPropertyEditableType } from '$lib/ir/elements/factories';

describe('component factories', () => {
	it('createTextbox fills defaults and keeps type', () => {
		const textbox = createTextbox({});
		expect(textbox.type).toBe('textbox');
		expect(textbox.validation.required).toBe(false);
		expect(typeof textbox.id).toBe('string');
	});

	it('isPropertyEditableType matches registered factories', () => {
		expect(isPropertyEditableType('textbox')).toBe(true);
		expect(isPropertyEditableType('unknown')).toBe(false);
	});

	it('createComponentByType passes through unregistered types with an id', () => {
		const passed = createComponentByType({ type: 'custom', label: 'X' });
		expect(passed.type).toBe('custom');
		expect(passed.label).toBe('X');
		expect(typeof passed.id).toBe('string');
	});
});
