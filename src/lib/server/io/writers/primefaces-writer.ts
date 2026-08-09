import { assertSafeLogicalIdPathSegment } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import type { DefinitionArtifact, DefinitionWriter } from '$lib/server/io/writers/definition-writer';
import {
	serializeHandlebarsTemplate,
	toHandlebarsSafeString
} from '$lib/server/io/writers/serialize/serialize-handlebars';
import { shapePrimeFaces } from '$lib/server/io/writers/shape/primefaces-shape';

const PRIMEFACES_FORM_TEMPLATE = 'form.hbs';

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
	 * Raw をコンポーネント別 Handlebars + form 合成で Facelet xhtml へ変換する
	 */
	toArtifact(raw: RawDefinition): DefinitionArtifact {
		const shaped = shapePrimeFaces(raw);
		const formId = assertSafeLogicalIdPathSegment(shaped.formId);
		const identity = this.describeArtifact(formId);
		const name = shaped.name.trim() !== '' ? shaped.name : identity.filename.replace(/\.xhtml$/, '');

		const fields = shaped.fields.map((field) => {
			const markup = serializeHandlebarsTemplate(this.targetId, field);
			return {
				...field,
				// WARN: markup は component hbs で既に escape 済み。form では {{{markup}}} で挿入する。
				markup: toHandlebarsSafeString(markup)
			};
		});

		return {
			...identity,
			content: serializeHandlebarsTemplate(
				this.targetId,
				{ formId, name, fields },
				PRIMEFACES_FORM_TEMPLATE
			)
		};
	}
}
