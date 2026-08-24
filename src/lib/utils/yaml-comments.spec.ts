import { describe, expect, it } from 'vitest';
import { createYamlDocument, parseYamlDocument, stringifyYamlDocument } from '$lib/utils/yaml-document';
import { attachYamlComments, extractYamlComments } from '$lib/utils/yaml-comments';

describe('yaml-comments', () => {
	it('attaches uiDefinition and per-component comments and round-trips', () => {
		const doc = createYamlDocument(
			{
				version: 1,
				uiDefinition: { logicalId: 'screen', name: '画面' },
				components: [
					{ logicalId: 'userId', type: 'textbox' },
					{ logicalId: 'userName', type: 'label' }
				]
			},
			['uiDefinition', 'components', 'logicalId', 'type']
		);

		attachYamlComments(doc, {
			uiDefinition: '画面全体の運用メモ',
			'components[0]': 'ユーザー ID。ログイン必須',
			'components[1]': '表示専用'
		});

		const yamlText = stringifyYamlDocument(doc);
		expect(yamlText).toContain('# 画面全体の運用メモ');
		expect(yamlText).toContain('# ユーザー ID。ログイン必須');
		expect(yamlText).toContain('# 表示専用');
		expect(yamlText.indexOf('# 画面全体の運用メモ')).toBeLessThan(yamlText.indexOf('\nuiDefinition:'));

		const restored = extractYamlComments(parseYamlDocument(yamlText));
		expect(restored.uiDefinition).toBe('画面全体の運用メモ');
		expect(restored['components[0]']).toBe('ユーザー ID。ログイン必須');
		expect(restored['components[1]']).toBe('表示専用');
	});

	it('attaches comments on arbitrary external paths', () => {
		const doc = createYamlDocument(
			{
				uiDefinition: {
					external: {
						'im-forma': {
							importBase: { header: { ja: 'x' } }
						}
					}
				}
			},
			['uiDefinition', 'external']
		);

		attachYamlComments(doc, {
			"uiDefinition.external['im-forma']": 'Forma 残余',
			"uiDefinition.external['im-forma'].importBase": 'merge 用原文'
		});

		const restored = extractYamlComments(parseYamlDocument(stringifyYamlDocument(doc)));
		expect(restored["uiDefinition.external['im-forma']"]).toBe('Forma 残余');
		expect(restored["uiDefinition.external['im-forma'].importBase"]).toBe('merge 用原文');
	});

	it('keeps markdown headings in comment bodies', () => {
		const doc = createYamlDocument({ uiDefinition: { logicalId: 'a' } }, ['uiDefinition']);
		attachYamlComments(doc, { uiDefinition: '# 注意\n- コピー時は ID を変える' });
		const yamlText = stringifyYamlDocument(doc);
		expect(yamlText).toContain('# # 注意');
		expect(yamlText).toContain('# - コピー時は ID を変える');
		expect(extractYamlComments(parseYamlDocument(yamlText)).uiDefinition).toBe(
			'# 注意\n- コピー時は ID を変える'
		);
	});
});
