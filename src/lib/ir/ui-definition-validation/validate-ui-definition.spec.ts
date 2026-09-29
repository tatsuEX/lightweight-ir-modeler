import { describe, expect, it } from 'vitest';
import { hydrateEditorComponent } from '$lib/ir/elements/component-schema';
import { createEmptyUiDefinitionMeta } from '$lib/ir/ui-definition-meta';
import { parseUiDefinitionValidationConfig } from '$lib/config/ui-definition-validation-config';
import { validateUiDefinition } from '$lib/ir/ui-definition-validation/validate-ui-definition';

/**
 * テスト用の EditorComponent を作る
 */
function component(id: string, logicalId: string, label: string, type = 'textbox') {
	return hydrateEditorComponent({ type, logicalId, label }, id);
}

describe('validateUiDefinition', () => {
	const meta = {
		...createEmptyUiDefinitionMeta(),
		logicalId: 'screenA',
		name: '画面A'
	};

	it('accepts a complete definition', () => {
		const report = validateUiDefinition(meta, [component('c1', 'userName', '氏名')]);
		expect(report.ok).toBe(true);
	});

	it('requires meta logicalId and name', () => {
		const report = validateUiDefinition(
			{ ...meta, logicalId: '', name: '  ' },
			[component('c1', 'userName', '氏名')]
		);
		expect(report.issues).toEqual([
			expect.objectContaining({
				path: 'meta.logicalId',
				code: 'logical-id-required',
				message: '基本情報の ID (logicalId) は必須です'
			}),
			expect.objectContaining({
				path: 'meta.name',
				code: 'name-required',
				message: '基本情報の 画面名 (name) は必須です'
			})
		]);
	});

	it('rejects filesystem characters in logicalId and allows hash and a leading digit', () => {
		const report = validateUiDefinition(
			{ ...meta, logicalId: 'a/b' },
			[component('c1', '1name', '氏名'), component('c2', 'ok#id', '備考')]
		);
		expect(report.issues.map((issue) => issue.path)).toEqual(['meta.logicalId']);
		expect(report.issues[0]?.code).toBe('logical-id-charset');
	});

	it('requires label except unsupported', () => {
		const report = validateUiDefinition(meta, [
			component('c1', 'userName', ''),
			component('c2', 'vendor', '', 'unsupported')
		]);
		expect(report.issues).toEqual([
			expect.objectContaining({
				path: 'components/c1/label',
				code: 'label-required',
				message: '1行目 userName (textbox) の label は必須です'
			})
		]);
	});

	it('uses a dash when component logicalId is empty in messages', () => {
		const report = validateUiDefinition(meta, [component('c1', '', '')]);
		expect(report.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: 'components/c1/logicalId',
					message: '1行目 - (textbox) の logicalId は必須です'
				}),
				expect.objectContaining({
					path: 'components/c1/label',
					message: '1行目 - (textbox) の label は必須です'
				})
			])
		);
	});

	it('reports duplicate logicalIds on every owner and ignores empty ids', () => {
		const report = validateUiDefinition(meta, [
			component('c1', 'same', 'A'),
			component('c2', 'same', 'B'),
			component('c3', '', 'C')
		]);
		const codes = report.issues.map((issue) => `${issue.path}:${issue.code}`);
		expect(codes).toContain('components/c1/logicalId:logical-id-duplicate');
		expect(codes).toContain('components/c2/logicalId:logical-id-duplicate');
		expect(codes).toContain('components/c3/logicalId:logical-id-required');
		expect(codes.some((code) => code.includes('duplicate') && code.includes('c3'))).toBe(false);
	});

	it('counts label length in code points and does not stack profile pattern on a charset failure', () => {
		const profile = parseUiDefinitionValidationConfig({
			validation: {
				rules: {
					components: {
						logicalId: { pattern: '^[a-z]+$', maxLength: 4 },
						label: { maxLength: 2 }
					},
					limits: { maxComponents: 1 }
				}
			}
		});
		const report = validateUiDefinition(
			meta,
			[component('c1', 'bad/id', 'あいう'), component('c2', 'abcd', '名')],
			profile
		);
		const logical = report.issues.filter((issue) => issue.path === 'components/c1/logicalId');
		expect(logical.map((issue) => issue.code)).toEqual(['logical-id-charset']);
		expect(report.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: 'components/c1/label', code: 'max-length' }),
				expect.objectContaining({ path: 'document/maxComponents', code: 'max-components' })
			])
		);
	});

	it('applies byType item constraints', () => {
		const profile = parseUiDefinitionValidationConfig({
			validation: {
				rules: {
					components: {
						byType: {
							checkbox: {
								items: {
									maxItems: 1,
									value: { pattern: '^[A-Z]+$', maxLength: 2 }
								}
							}
						}
					}
				}
			}
		});
		const checkbox = hydrateEditorComponent(
			{
				type: 'checkbox',
				logicalId: 'colors',
				label: '色',
				items: [
					{ label: '赤', value: 'RED' },
					{ label: '青', value: 'blue' }
				]
			},
			'c1'
		);
		const report = validateUiDefinition(meta, [checkbox], profile);
		expect(report.issues.map((issue) => issue.path)).toEqual(
			expect.arrayContaining(['components/c1/items', 'components/c1/items/1/value'])
		);
	});
});
