import { describe, expect, it } from 'vitest';
import {
	findXmlNodeByTag,
	getXmlAttribute,
	getXmlCommentText,
	parseXml
} from '$lib/server/io/readers/parse/parse-xml';

describe('parseXml', () => {
	it('parses ordered XHTML with attributes and comments', () => {
		const nodes = parseXml(`<!--
  Sample
  desc
-->
<html xmlns:p="http://primefaces.org/ui">
  <h:form id="myForm" xmlns:h="http://xmlns.jcp.org/jsf/html">
    <p:inputText id="tb" required="true" />
  </h:form>
</html>`);

		expect(getXmlCommentText(nodes[0] as Record<string, unknown>)).toContain('Sample');
		const form = findXmlNodeByTag(nodes, 'h:form');
		expect(form).toBeDefined();
		expect(getXmlAttribute(form!, 'id')).toBe('myForm');
	});

	it('throws on empty input that is not an ordered array result', () => {
		// WARN: FXP は不正 XML で例外を投げる。ここでは例外経路を確認する。
		expect(() => parseXml('<not-closed')).toThrow();
	});
});
