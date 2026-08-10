import { normalizeExternalResidual } from '$lib/ir/external-residual';
import type { UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import type { ImportedDefinition } from '$lib/transform/imported-definition';
import { mapComponentToRawField } from '$lib/transform/ir-to-raw-fields';
import { mapRawFieldToComponent } from '$lib/transform/raw-to-ir-fields';

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
		items: components.map(mapComponentToRawField),
		...(meta.external ? { external: meta.external } : {})
	};
}

/**
 * IM-Forma 向け検証済み Raw を IR へ変換する
 */
export function transformFromImFormaRaw(raw: RawDefinition): ImportedDefinition {
	const external = normalizeExternalResidual(raw.external);

	return {
		uiDefinition: {
			logicalId: typeof raw.logicalId === 'string' ? raw.logicalId : '',
			name: typeof raw.name === 'string' ? raw.name : '',
			description: typeof raw.description === 'string' ? raw.description : '',
			version: typeof raw.version === 'string' ? raw.version : '',
			...(external ? { external } : {})
		},
		components: Array.isArray(raw.items) ? raw.items.map(mapRawFieldToComponent) : []
	};
}
