import { assertSafeLogicalIdPathSegment } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import type { DefinitionArtifact, DefinitionWriter } from '$lib/server/io/writers/definition-writer';
import { serializeJson } from '$lib/server/io/writers/serialize/serialize-json';
import { shapeImForma } from '$lib/server/io/writers/shape/im-forma-shape';

/**
 * IM-Forma JSON 用 Writer
 */
export class IMFormaWriter implements DefinitionWriter {
	readonly targetId = 'im-forma';

	/**
	 * JSON 成果物のファイル識別情報を返す
	 */
	describeArtifact(logicalId: string): Pick<DefinitionArtifact, 'filename' | 'contentType'> {
		const safeLogicalId = assertSafeLogicalIdPathSegment(logicalId);
		return {
			filename: `${safeLogicalId}.json`,
			contentType: 'application/json; charset=utf-8'
		};
	}

	/**
	 * Raw を pretty-print JSON 成果物へ変換する
	 */
	toArtifact(raw: RawDefinition): DefinitionArtifact {
		const shaped = shapeImForma(raw);
		const formId = assertSafeLogicalIdPathSegment(shaped.formId);
		const identity = this.describeArtifact(formId);

		return {
			...identity,
			content: serializeJson({ ...shaped, formId })
		};
	}
}
