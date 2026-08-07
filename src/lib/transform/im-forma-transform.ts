import type { UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import { mapComponentToRawField } from '$lib/transform/ir-to-raw-fields';

/**
 * IR を IM-Forma 向け RawDefinition へ変換する
 */
export function transformToImFormaRaw(
	meta: UiDefinitionEditorMeta,
	components: unknown[]
): RawDefinition {
	return {
		target: 'im-forma',
		logicalId: meta.logicalId,
		name: meta.name,
		description: meta.description,
		version: meta.version,
		items: components.map(mapComponentToRawField)
	};
}
