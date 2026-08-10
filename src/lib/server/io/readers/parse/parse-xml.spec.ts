import { describe, expect, it } from 'vitest';
import {
	findXmlNodeByTag,
	getXmlAttribute,
	getXmlChildren,
	getXmlCommentText,
	getXmlTagName,
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

	it('keeps a single f:selectItem as an ordered child array under preserveOrder', () => {
		const nodes = parseXml(`
<html xmlns:f="http://xmlns.jcp.org/jsf/core" xmlns:p="http://primefaces.org/ui">
  <p:selectOneMenu id="category">
    <f:selectItem itemValue="a" itemLabel="A" />
  </p:selectOneMenu>
</html>`);

		const menu = findXmlNodeByTag(nodes, 'p:selectOneMenu');
		expect(menu).toBeDefined();
		const children = getXmlChildren(menu!);
		expect(children).toHaveLength(1);
		expect(getXmlTagName(children[0]!)).toBe('f:selectItem');
		expect(getXmlAttribute(children[0]!, 'itemValue')).toBe('a');
	});

	it('throws on empty input that is not an ordered array result', () => {
		// WARN: FXP は不正 XML で例外を投げる。ここでは例外経路を確認する。
		expect(() => parseXml('<not-closed')).toThrow();
	});
});
