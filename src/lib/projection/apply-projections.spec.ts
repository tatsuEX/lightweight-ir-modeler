import { describe, expect, it } from 'vitest';
import { applyProjections } from '$lib/projection/apply-projections';
import { duplicateLogicalIdWarning } from '$lib/projection/plugins/by-logical-id';
import { unknownProjectionPluginError } from '$lib/projection/registry';
import type { RestoredIrSnapshot } from '$lib/ir/snapshot';

const snapshot: RestoredIrSnapshot = {
	version: 1,
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
		{
			logicalId: 'userName',
			type: 'textbox',
			label: '氏名',
			validation: { required: true, maxlength: 30 }
		},
		{
			logicalId: 'age',
			type: 'number',
			label: '年齢',
			validation: { required: false }
		},
		{
			logicalId: '',
			type: 'label',
			label: '空 id'
		}
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
				{ logicalId: 'userName', type: 'textbox', label: 'first' },
				{ logicalId: 'userName', type: 'textbox', label: 'second' }
			]
		};

		const { view, warnings } = applyProjections(duplicated, { projectionIds: ['by-logical-id'] });

		expect(warnings).toEqual([duplicateLogicalIdWarning('userName')]);
		expect((view.componentsByLogicalId?.userName as { label: string }).label).toBe('second');
	});

	it('adds dbMaxlength without removing maxlength', () => {
		const { view } = applyProjections(snapshot, { projectionIds: ['db-maxlength'] });
		const userName = view.components[0] as {
			validation: { maxlength: number; dbMaxlength: number; required: boolean };
		};
		const age = view.components[1] as { validation: { dbMaxlength?: number } };

		expect(userName.validation.maxlength).toBe(30);
		expect(userName.validation.dbMaxlength).toBe(90);
		expect(age.validation.dbMaxlength).toBeUndefined();
	});

	it('honors bytesPerChar', () => {
		const { view } = applyProjections(snapshot, {
			projectionIds: ['db-maxlength'],
			pluginOptions: { 'db-maxlength': { bytesPerChar: 4 } }
		});
		const userName = view.components[0] as { validation: { dbMaxlength: number } };

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

		const original = snapshot.components[0] as { validation: Record<string, unknown> };
		expect(original.validation).toEqual({ required: true, maxlength: 30 });
		expect(original.validation.dbMaxlength).toBeUndefined();
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
