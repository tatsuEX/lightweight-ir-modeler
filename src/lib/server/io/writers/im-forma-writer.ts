import { assertSafeLogicalIdPathSegment } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import type { DefinitionArtifact, DefinitionWriter } from '$lib/server/io/writers/definition-writer';

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
		const logicalId = typeof raw.logicalId === 'string' ? raw.logicalId : 'form';
		const identity = this.describeArtifact(logicalId);
		const formId = assertSafeLogicalIdPathSegment(logicalId);

		const payload = {
			formId,
			formName: typeof raw.name === 'string' ? raw.name : '',
			description: typeof raw.description === 'string' ? raw.description : '',
			version: typeof raw.version === 'string' ? raw.version : '',
			items: Array.isArray(raw.items) ? raw.items : []
		};

		return {
			...identity,
			content: `${JSON.stringify(payload, null, 2)}\n`
		};
	}
}
