import { assertSafeLogicalIdPathSegment } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import type { DefinitionArtifact, DefinitionWriter } from '$lib/server/io/writers/definition-writer';
import { escapeHtml } from '$lib/utils/escape-html';

/**
 * Raw フィールドを PrimeFaces タグへ変換する
 */
function fieldToXhtml(field: Record<string, unknown>): string {
	const id = typeof field.logicalId === 'string' && field.logicalId.trim() !== '' ? field.logicalId : 'field';
	const required = field.required === true ? ' required="true"' : '';
	const type = typeof field.type === 'string' ? field.type : 'unknown';
	const hint = field.hint ? ` placeholder="${escapeHtml(field.hint)}"` : '';

	const label = `\t\t\t<p:outputLabel for="${id}" value="${escapeHtml(field.label)}" />`;
	
	switch (type) {
		case 'textbox':
			return `${label}\t\t\t<p:inputText id="${id}"${required}${hint} />\n`;
		case 'textarea':
			return `${label}\t\t\t<p:inputTextarea id="${id}"${required}${hint} />\n`;
		case 'number':
			return `${label}\t\t\t<p:inputNumber id="${id}"${required}${hint} />\n`;
		default:
			return `${label}\t\t\t<!-- unsupported type: ${type} id=${id} -->\n`;
	}
}

/**
 * PrimeFaces Facelet 用 Writer
 */
export class PrimeFacesWriter implements DefinitionWriter {
	readonly targetId = 'primefaces';

	/**
	 * xhtml 成果物のファイル識別情報を返す
	 */
	describeArtifact(logicalId: string): Pick<DefinitionArtifact, 'filename' | 'contentType'> {
		const safeLogicalId = assertSafeLogicalIdPathSegment(logicalId);
		return {
			filename: `${safeLogicalId}.xhtml`,
			contentType: 'application/xhtml+xml; charset=utf-8'
		};
	}

	/**
	 * Raw を最小 Facelet xhtml 成果物へ変換する
	 */
	toArtifact(raw: RawDefinition): DefinitionArtifact {
		const logicalId = typeof raw.logicalId === 'string' ? raw.logicalId : 'form';
		const identity = this.describeArtifact(logicalId);
		const name = typeof raw.name === 'string' ? raw.name : identity.filename.replace(/\.xhtml$/, '');
		const formId = assertSafeLogicalIdPathSegment(logicalId);
		const fields = Array.isArray(raw.fields) ? raw.fields : [];

		const fieldLines = fields
			.filter((field): field is Record<string, unknown> =>
				field !== null && typeof field === 'object' && !Array.isArray(field)
			)
			.map(fieldToXhtml)
			.join('\n');

		const content = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<!DOCTYPE html>',
			`<html xmlns="http://www.w3.org/1999/xhtml"`,
			`\txmlns:h="http://xmlns.jcp.org/jsf/html"`,
			`\txmlns:p="http://primefaces.org/ui">`,
			`<h:head>`,
			`\t<title>${name}</title>`,
			`</h:head>`,
			`<h:body>`,
			`\t<h:form id="${formId}">`,
			`\t\t<p:messages id="messages" showDetail="true" showSummary="true" />`,
			`\t\t<p:panelGrid columns="2" columnClasses="lg:col-6" />`,
			fieldLines,
			`\t\t</p:panelGrid>`,
			`\t</h:form>`,
			`</h:body>`,
			`</html>`,
			''
		].join('\n');

		return {
			...identity,
			content
		};
	}
}

