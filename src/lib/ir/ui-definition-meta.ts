/** 画面定義 version の初期値 */
export const DEFAULT_UI_DEFINITION_VERSION = '1.0.0';

/**
 * エディタ UI から編集する画面定義メタデータ
 */
export type UiDefinitionEditorMeta = {
	logicalId: string;
	name: string;
	description: string;
	version: string;
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
	return {
		logicalId: meta.logicalId,
		name: meta.name,
		description: meta.description,
		version: meta.version
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
	return {
		logicalId: typeof record.logicalId === 'string' ? record.logicalId : '',
		name: typeof record.name === 'string' ? record.name : '',
		description: typeof record.description === 'string' ? record.description : '',
		version: typeof record.version === 'string' ? record.version : ''
	};
}
