import { validateRawDefinition } from '$lib/schema/validate-raw';
import {
	acceptsFilename,
	DefinitionReadError,
	type DefinitionSource
} from '$lib/server/io/readers/definition-reader';
import { resolveImportTargetBundle } from '$lib/server/ui/import-target-registry';
import type { ImportedDefinition } from '$lib/transform/imported-definition';

/**
 * アップロードされた外部 UI 定義ファイルを IR へ取り込む
 * Reader → SchemaValidator → Transformer の順に通す（export-pipeline の逆）
 */
export function importFromUploadedFile(
	targetId: string,
	source: DefinitionSource
): ImportedDefinition {
	const bundle = resolveImportTargetBundle(targetId);
	if (!bundle) {
		throw new Error(`unsupported import target: ${targetId}`);
	}

	if (!acceptsFilename(bundle.reader, source.filename)) {
		throw new DefinitionReadError(
			targetId,
			`対応していない拡張子です（${bundle.reader.acceptExtensions.join(' / ')} を選択してください）`
		);
	}

	const raw = bundle.reader.toRaw(source);
	validateRawDefinition(targetId, raw);

	return bundle.transform(raw);
}
