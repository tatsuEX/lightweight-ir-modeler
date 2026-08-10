import { normalizeExternalResidual, type ExternalResidual } from '$lib/ir/external-residual';

/** 画面定義 version の初期値 */
export const DEFAULT_UI_DEFINITION_VERSION = '1.0.0';

/**
 * エディタ UI から編集する画面定義メタデータ
 *
 * WARN: `external` は import 元の外部定義が持っていたベンダー固有キーの退避先。
 * エディタでは編集せず、export 時に shape 層が元の形へ復元するためだけに保持する。
 */
export type UiDefinitionEditorMeta = {
	logicalId: string;
	name: string;
	description: string;
	version: string;
	external?: ExternalResidual;
};

/**
 * snapshot に永続化する画面定義メタデータ
 */
export type UiDefinitionSnapshotMeta = UiDefinitionEditorMeta & {
	createdAt: string;
	modifiedAt: string;
};

/**
 * layout-editor 初期化用の空メタデータ
 */
export function createEmptyUiDefinitionMeta(): UiDefinitionEditorMeta {
	return {
		logicalId: '',
		name: '',
		description: '',
		version: DEFAULT_UI_DEFINITION_VERSION
	};
}

/**
 * snapshot 用メタデータからエディタ編集フィールドのみを取り出す
 */
export function toEditorMeta(meta: UiDefinitionSnapshotMeta | UiDefinitionEditorMeta): UiDefinitionEditorMeta {
	const external = normalizeExternalResidual(meta.external);

	// WARN: external は無い場合キー自体を落とす。YAML dump / 比較ハッシュに undefined を混ぜない。
	return {
		logicalId: meta.logicalId,
		name: meta.name,
		description: meta.description,
		version: meta.version,
		...(external ? { external } : {})
	};
}

/**
 * snapshot 保存用メタデータを組み立てる（createdAt / modifiedAt はサーバー側で付与）
 */
export function buildSnapshotMetaForWrite(
	editorMeta: UiDefinitionEditorMeta,
	previous: UiDefinitionSnapshotMeta | null | undefined,
	now: Date = new Date()
): UiDefinitionSnapshotMeta {
	const iso = now.toISOString();

	if (!previous?.createdAt) {
		return {
			...editorMeta,
			createdAt: iso,
			modifiedAt: iso
		};
	}

	return {
		...editorMeta,
		createdAt: previous.createdAt,
		modifiedAt: iso
	};
}

/**
 * logicalId が snapshot ディレクトリ名として安全か判定する
 */
export function isValidLogicalId(value: string): boolean {
	const trimmed = value.trim();
	return trimmed.length > 0 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed);
}

/**
 * auto-save 可能な必須メタデータが揃っているか判定する
 */
export function isUiDefinitionMetaReady(meta: Pick<UiDefinitionEditorMeta, 'logicalId' | 'name'>): boolean {
	return meta.logicalId.trim().length > 0 && meta.name.trim().length > 0;
}

/**
 * logicalId を snapshot 用ディレクトリ名へ正規化する
 */
export function assertSafeLogicalIdPathSegment(logicalId: string): string {
	const trimmed = logicalId.trim();
	if (!isValidLogicalId(trimmed)) {
		throw new Error(`invalid logicalId for snapshot path: ${logicalId}`);
	}
	return trimmed;
}

/**
 * API リクエスト body からエディタ編集メタデータを取り出す（日時は無視）
 */
export function parseEditorMetaFromRecord(record: Record<string, unknown>): UiDefinitionEditorMeta {
	const external = normalizeExternalResidual(record.external);

	return {
		logicalId: typeof record.logicalId === 'string' ? record.logicalId : '',
		name: typeof record.name === 'string' ? record.name : '',
		description: typeof record.description === 'string' ? record.description : '',
		version: typeof record.version === 'string' ? record.version : '',
		...(external ? { external } : {})
	};
}
