import { describe, expect, it } from 'vitest';
import type { RestoredIrSnapshot } from '$lib/ir/snapshot';
import {
	buildSummonContext,
	missingTargetResidualWarning,
	summonFromSnapshot
} from './summon';

const snapshotWithPrimefaces: RestoredIrSnapshot = {
	version: 1,
	savedAt: '2026-08-25T00:00:00.000Z',
	uiDefinition: {
		logicalId: 'userRegistration',
		name: 'ユーザー登録',
		description: '',
		version: '1.0.0',
		createdAt: '2026-08-25T00:00:00.000Z',
		modifiedAt: '2026-08-25T00:00:00.000Z',
		external: {
			primefaces: { formId: 'userForm' },
			'im-forma': { formSystemId: 'SYS-1' }
		}
	},
	components: [
		{
			id: 'cmp-1',
			type: 'textbox',
			label: '名前',
			external: {
				primefaces: { widgetVar: 'nameWv' },
				'im-forma': { itemId: 'name' }
			}
		}
	]
};

describe('buildSummonContext', () => {
	it('projects only the requested target residual onto context', () => {
		const { context, warnings } = buildSummonContext(snapshotWithPrimefaces, 'primefaces');
		const component = context.components[0] as Record<string, unknown>;

		expect(warnings).toEqual([]);
		expect(context.target).toBe('primefaces');
		expect(context.external).toEqual({ formId: 'userForm' });
		expect(context.uiDefinition.external).toEqual({ formId: 'userForm' });
		expect(component.external).toEqual({ widgetVar: 'nameWv' });
		expect(component.label).toBe('名前');
	});

	it('warns when the target residual is absent everywhere', () => {
		const { context, warnings } = buildSummonContext(snapshotWithPrimefaces, 'unknown-target');
		const component = context.components[0] as Record<string, unknown>;

		expect(warnings).toEqual([missingTargetResidualWarning('unknown-target')]);
		expect(context.external).toEqual({});
		expect(component.external).toEqual({});
	});

	it('does not mutate the restored snapshot', () => {
		buildSummonContext(snapshotWithPrimefaces, 'primefaces');
		expect(snapshotWithPrimefaces.uiDefinition.external).toEqual({
			primefaces: { formId: 'userForm' },
			'im-forma': { formSystemId: 'SYS-1' }
		});
	});
});

describe('summonFromSnapshot', () => {
	it('renders the target residual through Handlebars', () => {
		const { output, warnings } = summonFromSnapshot({
			target: 'primefaces',
			templateSource:
				'{{target}} {{external.formId}} {{#each components}}{{external.widgetVar}}{{/each}}',
			snapshot: snapshotWithPrimefaces
		});

		expect(warnings).toEqual([]);
		expect(output).toBe('primefaces userForm nameWv');
	});

	it('projects target residual onto componentsByLogicalId', () => {
		const snapshot: RestoredIrSnapshot = {
			...snapshotWithPrimefaces,
			components: [
				{
					id: 'cmp-1',
					logicalId: 'userName',
					type: 'textbox',
					label: '名前',
					external: {
						primefaces: { widgetVar: 'nameWv' },
						'im-forma': { itemId: 'name' }
					}
				}
			]
		};

		const { output, warnings } = summonFromSnapshot({
			target: 'primefaces',
			templateSource: '{{componentsByLogicalId.userName.external.widgetVar}}',
			snapshot,
			projectionIds: ['by-logical-id']
		});

		expect(warnings).toEqual([]);
		expect(output).toBe('nameWv');
	});

	it('omits componentsByLogicalId when projections are not requested', () => {
		const { output } = summonFromSnapshot({
			target: 'primefaces',
			templateSource: '{{#if componentsByLogicalId}}yes{{else}}no{{/if}}',
			snapshot: snapshotWithPrimefaces
		});

		expect(output).toBe('no');
	});
});
