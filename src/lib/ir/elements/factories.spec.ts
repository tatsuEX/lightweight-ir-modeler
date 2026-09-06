import { describe, expect, it } from 'vitest';
import {
	createComponentByType,
	createLabel,
	createTextarea,
	createTextbox,
	isPropertyEditableType,
	SYSTEM_ID_LENGTH
} from '$lib/ir/elements/factories';

describe('component factories', () => {
	it('createTextbox fills defaults and keeps type', () => {
		const textbox = createTextbox({});
		expect(textbox.type).toBe('textbox');
		expect(textbox.validation.required).toBe(false);
		expect(typeof textbox.id).toBe('string');
		expect(textbox.id.length).toBe(SYSTEM_ID_LENGTH);
	});

	it('does not emit tooltip or autosize', () => {
		const textbox = createTextbox({});
		const textarea = createTextarea({});
		expect(textbox).not.toHaveProperty('tooltip');
		expect(textarea).not.toHaveProperty('tooltip');
		expect(textarea).not.toHaveProperty('autosize');
	});

	it('createLabel shares the common base fields', () => {
		const label = createLabel({});
		expect(label.hint).toBe('');
		expect(label.disabled).toBe(false);
		expect(label.readonly).toBe(false);
		expect(label.hidden).toBe(false);
		expect(label.validation.required).toBe(false);
	});

	it('isPropertyEditableType matches registered factories', () => {
		expect(isPropertyEditableType('textbox')).toBe(true);
		expect(isPropertyEditableType('unknown')).toBe(false);
		expect(isPropertyEditableType('unsupported')).toBe(false);
	});

	it('createComponentByType passes through unregistered types with an id', () => {
		const passed = createComponentByType({ type: 'custom', label: 'X' });
		expect(passed.type).toBe('custom');
		expect(passed.label).toBe('X');
		expect(typeof passed.id).toBe('string');
	});
});
