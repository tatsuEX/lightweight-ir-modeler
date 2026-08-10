import { describe, expect, it } from 'vitest';
import { acceptsFilename, DefinitionReadError } from '$lib/server/io/readers/definition-reader';
import { PrimeFacesReader } from '$lib/server/io/readers/primefaces-reader';

const reader = new PrimeFacesReader();

const minimalXhtml = `<!--
  My Form
  
-->
<html xmlns:h="http://xmlns.jcp.org/jsf/html" xmlns:p="http://primefaces.org/ui">
<h:head><title>My Form</title></h:head>
<h:body>
	<h:form id="myForm">
		<p:panelGrid>
			<p:outputLabel for="tb" value="Name" />
			<p:inputText id="tb" />
		</p:panelGrid>
	</h:form>
</h:body>
</html>
`;

describe('PrimeFacesReader', () => {
	it('reads an XHTML definition into Raw', () => {
		const raw = reader.toRaw({ filename: 'myForm.xhtml', content: minimalXhtml });
		expect(raw.target).toBe('primefaces');
		expect(raw.logicalId).toBe('myForm');
		expect(raw.name).toBe('My Form');
	});

	it('raises a read error for broken XML', () => {
		expect(() => reader.toRaw({ filename: 'broken.xhtml', content: '<h:form' })).toThrow(
			DefinitionReadError
		);
	});

	it('raises a read error when h:form is missing', () => {
		expect(() =>
			reader.toRaw({ filename: 'empty.xhtml', content: '<html><body/></html>' })
		).toThrow(DefinitionReadError);
	});

	it('accepts only xhtml filenames', () => {
		expect(acceptsFilename(reader, 'myForm.XHTML')).toBe(true);
		expect(acceptsFilename(reader, 'myForm.json')).toBe(false);
	});
});
