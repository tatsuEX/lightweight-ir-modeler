import { describe, expect, it } from 'vitest';
import { parseYamlKeyPath, stringifyYamlKeyPath, joinYamlKeyPath } from '$lib/ir/snapshot-comment-path';

describe('snapshot-comment-path', () => {
	it('round-trips ident, index, and hyphenated keys', () => {
		const path = "uiDefinition.external['im-forma'].importBase";
		expect(stringifyYamlKeyPath(parseYamlKeyPath(path))).toBe(path);
		expect(stringifyYamlKeyPath(parseYamlKeyPath('components[0]'))).toBe('components[0]');
		expect(stringifyYamlKeyPath(parseYamlKeyPath("components[2].external['im-forma'].item_id"))).toBe(
			"components[2].external['im-forma'].item_id"
		);
	});

	it('joins relative external paths without an extra dot before brackets', () => {
		expect(joinYamlKeyPath('uiDefinition.external', "['im-forma']")).toBe(
			"uiDefinition.external['im-forma']"
		);
		expect(joinYamlKeyPath('components[0]', 'external')).toBe('components[0].external');
	});

	it('rejects empty and malformed paths', () => {
		expect(() => parseYamlKeyPath('')).toThrow();
		expect(() => parseYamlKeyPath('uiDefinition.')).toThrow();
		expect(() => parseYamlKeyPath("['unterminated")).toThrow();
	});
});
