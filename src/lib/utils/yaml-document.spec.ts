import { describe, expect, it } from 'vitest';
import { isMap, isScalar, parseDocument } from 'yaml';
import { createYamlDocument, parseYaml, stringifyYaml } from '$lib/utils/yaml-document';

/**
 * YAML Map ノードのキー順を取り出す
 */
function yamlMapKeys(node: unknown): string[] {
	if (!isMap(node)) {
		return [];
	}
	return node.items.map((pair) => (isScalar(pair.key) ? String(pair.key.value) : String(pair.key)));
}

describe('yaml-document', () => {
	it('stringifies maps with system meta first, then preferred, then ASCII', () => {
		const yamlText = stringifyYaml(
			{
				zebra: 1,
				label: 'A',
				savedAt: 'now',
				type: 'textbox',
				version: 1,
				nested: { type: 'inner', version: 2, alpha: true }
			},
			['type', 'label']
		);
		const doc = parseDocument(yamlText);
		expect(yamlMapKeys(doc.contents)).toEqual(['version', 'savedAt', 'type', 'label', 'nested', 'zebra']);
		expect(yamlMapKeys(doc.get('nested'))).toEqual(['version', 'type', 'alpha']);
	});

	it('keeps Document available for future comments', () => {
		const doc = createYamlDocument({ version: 1, label: 'A' }, ['label']);
		doc.commentBefore = ' snapshot';
		expect(doc.toString({ lineWidth: 0 })).toContain('# snapshot');
	});

	it('round-trips YAML text through parseYaml', () => {
		const source = { version: 1, logicalId: 'screen', extra: { b: 2, a: 1 } };
		const restored = parseYaml(stringifyYaml(source, ['logicalId']));
		expect(restored).toEqual(source);
	});
});
