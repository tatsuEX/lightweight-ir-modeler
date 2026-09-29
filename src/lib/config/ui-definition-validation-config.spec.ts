import { describe, expect, it } from 'vitest';
import {
	createDefaultUiDefinitionValidationProfile,
	editorFieldMode,
	parseUiDefinitionValidationConfig
} from '$lib/config/ui-definition-validation-config';

describe('parseUiDefinitionValidationConfig', () => {
	it('defaults when uiDefinition is omitted', () => {
		expect(parseUiDefinitionValidationConfig(undefined)).toEqual(
			createDefaultUiDefinitionValidationProfile()
		);
	});

	it('reads delay, rules, and editor field modes', () => {
		const profile = parseUiDefinitionValidationConfig({
			validation: {
				delay: 800,
				rules: {
					meta: { logicalId: { prefix: 'scr_', maxLength: 64 } },
					components: { label: { maxLength: 30 } }
				},
				editor: {
					fields: {
						datetimepicker: { format: 'hidden' },
						datepicker: { format: 'disabled' }
					}
				},
				plugins: []
			}
		});
		expect(profile.delay).toBe(800);
		expect(profile.meta.logicalId?.constraint).toEqual({ prefix: 'scr_', maxLength: 64 });
		expect(profile.components.label?.constraint.maxLength).toBe(30);
		expect(editorFieldMode(profile, 'datetimepicker', 'format')).toBe('hidden');
		expect(editorFieldMode(profile, 'datepicker', 'format')).toBe('disabled');
		expect(editorFieldMode(profile, 'textbox', 'format')).toBe('editable');
	});

	it('rejects unknown keys, weakening required, and unknown plugins', () => {
		expect(() =>
			parseUiDefinitionValidationConfig({ validation: { rules: { other: {} } } })
		).toThrow('rules.other');
		expect(() =>
			parseUiDefinitionValidationConfig({
				validation: { rules: { meta: { name: { required: false } } } }
			})
		).toThrow('must be true');
		expect(() => parseUiDefinitionValidationConfig({ validation: { plugins: ['affinity'] } })).toThrow(
			'unknown uiDefinition validation plugin: affinity'
		);
	});
});
