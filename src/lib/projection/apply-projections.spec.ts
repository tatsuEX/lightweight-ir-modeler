import { describe, expect, it } from 'vitest';
import { applyProjections } from '$lib/projection/apply-projections';
import { duplicateLogicalIdWarning } from '$lib/projection/plugins/by-logical-id';
import { unknownProjectionPluginError } from '$lib/projection/registry';
import type { RestoredIrSnapshot } from '$lib/ir/snapshot';
import { hydrateEditorComponent } from '$lib/ir/elements/component-schema';

const snapshot: RestoredIrSnapshot = {
	schemaVersion: '1.0',
	savedAt: '2026-09-01T00:00:00.000Z',
	uiDefinition: {
		logicalId: 'userRegistration',
		name: 'ユーザー登録',
		description: '',
		version: '1.0',
		createdAt: '2026-09-01T00:00:00.000Z',
		modifiedAt: '2026-09-01T00:00:00.000Z'
	},
	components: [
		hydrateEditorComponent({
			id: 'c1',
			logicalId: 'userName',
			type: 'textbox',
			label: '氏名',
			validation: { required: true, maxlength: 30 }
		}),
		hydrateEditorComponent({
			id: 'c2',
			logicalId: 'age',
			type: 'number',
			label: '年齢',
			validation: { required: false }
		}),
		hydrateEditorComponent({
			id: 'c3',
			logicalId: '',
			type: 'label',
			label: '空 id'
		})
	]
};

describe('applyProjections', () => {
	it('returns the original component array when no plugins are requested', () => {
		const { view, warnings } = applyProjections(snapshot);

		expect(warnings).toEqual([]);
		expect(view.components).toBe(snapshot.components);
		expect(view.componentsByLogicalId).toBeUndefined();
	});

	it('rejects unknown plugin ids', () => {
		expect(() => applyProjections(snapshot, { projectionIds: ['nope'] })).toThrow(
			unknownProjectionPluginError('nope')
		);
	});

	it('indexes by logicalId and skips empty keys', () => {
		const { view, warnings } = applyProjections(snapshot, { projectionIds: ['by-logical-id'] });
		const byId = view.componentsByLogicalId ?? {};

		expect(warnings).toEqual([]);
		expect(byId.userName).toBe(view.components[0]);
		expect(byId.age).toBe(view.components[1]);
		expect(Object.keys(byId)).toEqual(['userName', 'age']);
	});

	it('warns on duplicate logicalId and keeps the last component', () => {
		const duplicated: RestoredIrSnapshot = {
			...snapshot,
			components: [
				hydrateEditorComponent({ id: 'd1', logicalId: 'userName', type: 'textbox', label: 'first' }),
				hydrateEditorComponent({ id: 'd2', logicalId: 'userName', type: 'textbox', label: 'second' })
			]
		};

		const { view, warnings } = applyProjections(duplicated, { projectionIds: ['by-logical-id'] });

		expect(warnings).toEqual([duplicateLogicalIdWarning('userName')]);
		expect((view.componentsByLogicalId?.userName as { label: string }).label).toBe('second');
	});

	it('adds dbMaxlength without removing maxlength', () => {
		const { view } = applyProjections(snapshot, { projectionIds: ['db-maxlength'] });
		const userName = view.components[0] as unknown as {
			validation: { maxlength: number; dbMaxlength: number; required: boolean };
		};
		const age = view.components[1] as unknown as { validation: { dbMaxlength?: number } };

		expect(userName.validation.maxlength).toBe(30);
		expect(userName.validation.dbMaxlength).toBe(90);
		expect(age.validation.dbMaxlength).toBeUndefined();
	});

	it('honors bytesPerChar', () => {
		const { view } = applyProjections(snapshot, {
			projectionIds: ['db-maxlength'],
			pluginOptions: { 'db-maxlength': { bytesPerChar: 4 } }
		});
		const userName = view.components[0] as unknown as { validation: { dbMaxlength: number } };

		expect(userName.validation.dbMaxlength).toBe(120);
	});

	it('rejects a non-integer bytesPerChar', () => {
		expect(() =>
			applyProjections(snapshot, {
				projectionIds: ['db-maxlength'],
				pluginOptions: { 'db-maxlength': { bytesPerChar: 1.5 } }
			})
		).toThrow('db-maxlength bytesPerChar must be a positive integer');
	});

	it('does not mutate the restored snapshot', () => {
		applyProjections(snapshot, {
			projectionIds: ['db-maxlength', 'by-logical-id']
		});

		const original = snapshot.components[0];
		if (original.type !== 'textbox') {
			throw new Error('expected textbox');
		}
		expect(original.validation.maxlength).toBe(30);
		expect(original.validation.required).toBe(true);
		expect(original.validation).not.toHaveProperty('dbMaxlength');
	});

	it('applies transform before index regardless of request order', () => {
		const { view } = applyProjections(snapshot, {
			projectionIds: ['by-logical-id', 'db-maxlength']
		});
		const mapped = view.componentsByLogicalId?.userName as {
			validation: { dbMaxlength: number };
		};

		expect(mapped.validation.dbMaxlength).toBe(90);
		expect(view.componentsByLogicalId?.userName).toBe(view.components[0]);
	});
});
