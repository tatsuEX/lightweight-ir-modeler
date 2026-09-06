import { describe, expect, it } from 'vitest';
import {
	COMPONENT_TYPES,
	EditorComponentSchema,
	hydrateEditorComponent,
	KNOWN_COMPONENT_TYPES,
	PersistedComponentSchema,
	toPersistedComponent
} from '$lib/ir/elements/component-schema';
import { createComponentByType, createUnsupported, SYSTEM_ID_LENGTH } from '$lib/ir/elements/factories';

/**
 * 既存 snapshot 相当（tooltip 付き、defaultValue なし、id なし）
 */
const legacyTextbox = {
	logicalId: 'userName',
	type: 'textbox',
	label: '氏名',
	hint: '',
	disabled: false,
	readonly: false,
	hidden: false,
	tooltip: '',
	validation: {
		required: true,
		pattern: '',
		maxlength: 30
	}
};

/**
 * 既存 snapshot 相当の textarea（autosize と tooltip 付き）
 */
const legacyTextarea = {
	logicalId: 'description',
	type: 'textarea',
	label: '概要',
	hint: '',
	disabled: false,
	readonly: false,
	hidden: false,
	tooltip: '',
	autosize: false,
	validation: {
		required: false,
		maxlength: 200
	},
	rows: 3
};

describe('IR component schema', () => {
	it('parses a legacy snapshot textbox and strips tooltip / id', () => {
		const parsed = PersistedComponentSchema.parse({ ...legacyTextbox, id: 'should-not-persist' });
		expect(parsed.type).toBe('textbox');
		if (parsed.type !== 'textbox') {
			throw new Error('expected textbox');
		}
		expect(parsed).not.toHaveProperty('tooltip');
		expect(parsed).not.toHaveProperty('id');
		expect(parsed.defaultValue).toBe('');
		expect(parsed.validation.minlength).toBe(0);
		expect(parsed.validation.required).toBe(true);
	});

	it('parses a legacy snapshot textarea and strips autosize / tooltip', () => {
		const parsed = PersistedComponentSchema.parse(legacyTextarea);
		expect(parsed.type).toBe('textarea');
		if (parsed.type !== 'textarea') {
			throw new Error('expected textarea');
		}
		expect(parsed).not.toHaveProperty('autosize');
		expect(parsed).not.toHaveProperty('tooltip');
		expect(parsed.cols).toBe(30);
		expect(parsed.rows).toBe(3);
	});

	it('requires id on the editor schema', () => {
		const result = EditorComponentSchema.safeParse(legacyTextbox);
		expect(result.success).toBe(false);
	});

	it('accepts factory output as an editor component and drops id on persist', () => {
		for (const type of KNOWN_COMPONENT_TYPES) {
			const created = createComponentByType({ type });
			const editor = EditorComponentSchema.parse(created);
			expect(editor.type).toBe(type);
			expect(editor.id.length).toBe(SYSTEM_ID_LENGTH);

			const persisted = toPersistedComponent(editor);
			expect(persisted).not.toHaveProperty('id');
			expect(persisted).not.toHaveProperty('tooltip');
			expect(persisted).not.toHaveProperty('autosize');
			expect(persisted.type).toBe(type);
		}
	});

	it('keeps factory-emitted keys after a persist parse (no silent drop of declared fields)', () => {
		const created = createComponentByType({ type: 'textbox' });
		const editor = EditorComponentSchema.parse(created);
		const persisted = toPersistedComponent(editor);
		const { id: _id, ...withoutId } = editor;
		expect(Object.keys(persisted).sort()).toEqual(Object.keys(withoutId).sort());
	});

	it('parses unsupported with sourceType', () => {
		const created = createUnsupported({ sourceType: 'product_72_shape', label: '図形' });
		const editor = EditorComponentSchema.parse(created);
		expect(editor.type).toBe('unsupported');
		if (editor.type !== 'unsupported') {
			throw new Error('expected unsupported');
		}
		expect(editor.sourceType).toBe('product_72_shape');
		const persisted = toPersistedComponent(editor);
		if (persisted.type !== 'unsupported') {
			throw new Error('expected unsupported');
		}
		expect(persisted.sourceType).toBe('product_72_shape');
	});

	it('lists every ComponentType exactly once', () => {
		expect(new Set(COMPONENT_TYPES).size).toBe(COMPONENT_TYPES.length);
		expect(COMPONENT_TYPES).toContain('unsupported');
		expect(KNOWN_COMPONENT_TYPES).not.toContain('unsupported');
	});

	it('hydrates a vendor type into unsupported and keeps sourceType', () => {
		const editor = hydrateEditorComponent(
			{ type: 'product_72_shape', label: '図形', tooltip: '' },
			'cmp-1'
		);
		expect(editor.type).toBe('unsupported');
		if (editor.type !== 'unsupported') {
			throw new Error('expected unsupported');
		}
		expect(editor.id).toBe('cmp-1');
		expect(editor.sourceType).toBe('product_72_shape');
		expect(editor.label).toBe('図形');
		expect(editor).not.toHaveProperty('tooltip');
	});

	it('rejects hydrate without an id', () => {
		expect(() => hydrateEditorComponent({ type: 'textbox' })).toThrow(/non-empty id/);
	});
});
