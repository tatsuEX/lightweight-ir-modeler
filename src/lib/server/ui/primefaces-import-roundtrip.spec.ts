import { afterEach, describe, expect, it } from 'vitest';
import { invalidateRawZodSchema } from '$lib/schema/json-schema-loader';
import { validateRawDefinition } from '$lib/schema/validate-raw';
import { resetZodLocaleForTests } from '$lib/schema/zod-locale';
import { shapePrimeFaces } from '$lib/server/io/writers/shape/primefaces-shape';
import { importFromUploadedFile } from '$lib/server/ui/import-pipeline';
import { transformToPrimeFacesRaw } from '$lib/transform/primefaces-transform';

const roundTripXhtml = `<!--
  RoundTrip Form
  desc
-->
<html xmlns="http://www.w3.org/1999/xhtml"
	xmlns:h="http://xmlns.jcp.org/jsf/html"
	xmlns:f="http://xmlns.jcp.org/jsf/core"
	xmlns:p="http://primefaces.org/ui">
<h:head>
	<title>RoundTrip Form</title>
</h:head>
<h:body>
	<h:form id="roundTripForm">
		<p:messages id="messages" showDetail="true" showSummary="true" />
		<p:panelGrid columns="2">
			<p:outputLabel for="name" value="氏名" />
			<p:inputText id="name" required="true" placeholder="hint" />

			<p:outputLabel for="category" value="区分" />
			<p:selectOneMenu id="category">
				<f:selectItem itemValue="a" itemLabel="A" />
				<f:selectItem itemValue="b" itemLabel="B" />
			</p:selectOneMenu>

			<p:outputLabel for="when" value="日付" />
			<p:datePicker id="when" pattern="yyyy-MM-dd" showButtonBar="true" />

			<p:outputLabel for="cb" value="複数選択" />
			<!-- unsupported type: checkbox id=cb -->
		</p:panelGrid>
	</h:form>
</h:body>
</html>
`;

/**
 * shape 比較用に fields を正規化する（placeholder 派生差を除く）
 */
function normalizeShapedFields(fields: unknown[]): unknown[] {
	return fields.map((field) => {
		if (field === null || typeof field !== 'object' || Array.isArray(field)) {
			return field;
		}
		const record = { ...(field as Record<string, unknown>) };
		delete record.placeholder;
		return record;
	});
}

describe('primefaces import round-trip', () => {
	afterEach(() => {
		invalidateRawZodSchema();
		resetZodLocaleForTests();
	});

	it('keeps semantic field shape after import → transform → shape', () => {
		const imported = importFromUploadedFile('primefaces', {
			filename: 'roundTripForm.xhtml',
			content: roundTripXhtml
		});

		expect(imported.uiDefinition.logicalId).toBe('roundTripForm');
		expect(imported.components.map((component) => (component as { type: string }).type)).toEqual([
			'textbox',
			'dropdown',
			'datepicker',
			'checkbox'
		]);

		const raw = transformToPrimeFacesRaw(imported.uiDefinition, imported.components);
		validateRawDefinition('primefaces', raw);
		const shaped = shapePrimeFaces(raw);

		expect(normalizeShapedFields(shaped.fields)).toEqual([
			{
				id: 'name',
				type: 'textbox',
				label: '氏名',
				hint: 'hint',
				required: true,
				disabled: false,
				readonly: false
			},
			{
				id: 'category',
				type: 'dropdown',
				label: '区分',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				items: [
					{ label: 'A', value: 'a' },
					{ label: 'B', value: 'b' }
				]
			},
			{
				id: 'when',
				type: 'datepicker',
				label: '日付',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				format: 'yyyy-MM-dd',
				clearable: true
			},
			{
				id: 'cb',
				type: 'checkbox',
				label: '複数選択',
				hint: '',
				required: false,
				disabled: false,
				readonly: false,
				items: []
			}
		]);
	});

	it('rejects json uploads for primefaces', () => {
		expect(() =>
			importFromUploadedFile('primefaces', {
				filename: 'roundTripForm.json',
				content: roundTripXhtml
			})
		).toThrow(/拡張子/);
	});
});
