import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseXml } from '$lib/server/io/readers/parse/parse-xml';
import { unshapePrimeFaces } from '$lib/server/io/readers/unshape/primefaces-unshape';

const richXhtml = `<!--
  申請フォーム
  取込テスト
-->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"
	xmlns:h="http://xmlns.jcp.org/jsf/html"
	xmlns:f="http://xmlns.jcp.org/jsf/core"
	xmlns:p="http://primefaces.org/ui"
	xmlns:custom="http://example.local/custom">
<h:head>
	<title>申請フォーム</title>
</h:head>
<h:body>
	<h:form id="applyForm">
		<p:messages id="messages" showDetail="true" showSummary="true" />
		<p:panelGrid columns="2" columnClasses="column-label,column-input">
			<p:outputLabel for="name" value="氏名" />
			<p:inputText id="name" required="true" placeholder="全角" data-extra="keep" />

			<p:outputLabel for="note" value="備考" />
			<p:inputTextarea id="note" rows="3" cols="40" maxlength="200"></p:inputTextarea>

			<p:outputLabel for="category" value="区分" />
			<p:selectOneRadio id="category" required="true">
				<f:selectItem itemValue="a" itemLabel="A" />
				<f:selectItem itemValue="b" itemLabel="B" />
			</p:selectOneRadio>

			<p:outputLabel for="when" value="日付" />
			<p:datePicker id="when" pattern="yyyy-MM-dd" showButtonBar="true" />

			<p:outputLabel for="span" value="期間" />
			<p:datePicker id="span" selectionMode="range" pattern="yyyy-MM-dd" />

			<p:outputLabel for="at" value="日時" />
			<p:datePicker id="at" showTime="true" pattern="yyyy-MM-dd HH:mm" />

			<p:outputLabel for="tm" value="時刻" />
			<p:datePicker id="tm" timeOnly="true" pattern="HH:mm" />

			<p:outputLabel for="lb" value="ラベル" />
			<p:outputText value="ラベル" />

			<p:outputLabel for="cb" value="複数選択" />
			<!-- unsupported type: checkbox id=cb -->
		</p:panelGrid>
	</h:form>
</h:body>
</html>
`;

describe('unshapePrimeFaces', () => {
	it('maps Export-shaped XHTML into Raw vocabulary', () => {
		const raw = unshapePrimeFaces(parseXml(richXhtml));

		expect(raw).toMatchObject({
			target: 'primefaces',
			logicalId: 'applyForm',
			name: '申請フォーム',
			description: '取込テスト',
			version: '1.0'
		});
		expect(raw.external).toEqual({
			primefaces: {
				xmlns: 'http://www.w3.org/1999/xhtml',
				'xmlns:h': 'http://xmlns.jcp.org/jsf/html',
				'xmlns:f': 'http://xmlns.jcp.org/jsf/core',
				'xmlns:p': 'http://primefaces.org/ui',
				'xmlns:custom': 'http://example.local/custom'
			}
		});

		const fields = raw.fields as Record<string, unknown>[];
		expect(fields.map((field) => field.type)).toEqual([
			'textbox',
			'textarea',
			'radio',
			'datepicker',
			'date-span',
			'datetimepicker',
			'timepicker',
			'label',
			'checkbox'
		]);

		expect(fields[0]).toMatchObject({
			logicalId: 'name',
			label: '氏名',
			hint: '全角',
			required: true,
			external: { primefaces: { 'data-extra': 'keep' } }
		});
		expect(fields[2]).toMatchObject({
			logicalId: 'category',
			type: 'radio',
			items: [
				{ label: 'A', value: 'a' },
				{ label: 'B', value: 'b' }
			]
		});
		expect(fields[3]).toMatchObject({
			type: 'datepicker',
			format: 'yyyy-MM-dd',
			clearable: true
		});
		expect(fields[8]).toMatchObject({
			logicalId: 'cb',
			type: 'checkbox',
			label: '複数選択'
		});
	});

	it('reads the sample export artifact on disk', () => {
		const xhtml = readFileSync(
			join(
				process.cwd(),
				'data/export/primefaces/multiple-ui-components-form/multiple-ui-components-form.xhtml'
			),
			'utf8'
		);
		const raw = unshapePrimeFaces(parseXml(xhtml));
		expect(raw.logicalId).toBe('multiple-ui-components-form');
		expect(raw.name).toBe('UIコンポーネントたくさんフォーム');
		const fields = raw.fields as Record<string, unknown>[];
		expect(fields.some((field) => field.logicalId === 'tb' && field.type === 'textbox')).toBe(
			true
		);
		expect(fields.some((field) => field.logicalId === 'cb' && field.type === 'checkbox')).toBe(
			true
		);
	});

	it('rejects a document without h:form', () => {
		expect(() => unshapePrimeFaces(parseXml('<html><body/></html>'))).toThrow('h:form');
	});
});
