import type { RawDefinition } from '$lib/raw/raw-definition';
import { IMFormaReader } from '$lib/server/io/readers/im-forma-reader';
import { PrimeFacesReader } from '$lib/server/io/readers/primefaces-reader';
import type { DefinitionReader } from '$lib/server/io/readers/definition-reader';
import type { ImportedDefinition } from '$lib/transform/imported-definition';
import { transformFromImFormaRaw } from '$lib/transform/im-forma-transform';
import { transformFromPrimeFacesRaw } from '$lib/transform/primefaces-transform';

/**
 * 取り込みターゲット一式（reader / transform）
 * Raw validate は pipeline が JSON Schema → Zod で行う（transform 前）
 */
export type ImportTargetBundle = {
	targetId: string;
	reader: DefinitionReader;
	transform: (raw: RawDefinition) => ImportedDefinition;
};

// WARN: Reader が実装済みの target だけを登録する。UI の選択肢はこの registry を正とする。
const IMPORT_TARGET_REGISTRY: Record<string, ImportTargetBundle> = {
	'im-forma': {
		targetId: 'im-forma',
		reader: new IMFormaReader(),
		transform: transformFromImFormaRaw
	},
	primefaces: {
		targetId: 'primefaces',
		reader: new PrimeFacesReader(),
		transform: transformFromPrimeFacesRaw
	}
};

/**
 * targetId に対応する取り込みバンドルを解決する
 */
export function resolveImportTargetBundle(targetId: string): ImportTargetBundle | undefined {
	return IMPORT_TARGET_REGISTRY[targetId];
}

/**
 * 登録済み targetId 一覧を返す
 */
export function listImportTargetIds(): string[] {
	return Object.keys(IMPORT_TARGET_REGISTRY);
}
