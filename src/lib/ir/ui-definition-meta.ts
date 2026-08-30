import { normalizeExternalResidual, type ExternalResidual } from '$lib/ir/external-residual';

/** 画面定義 version の初期値（`<main>.<sub>`。第 3 段は使わない） */
export const DEFAULT_UI_DEFINITION_VERSION = '1.0';

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
	/** 過去版読込元の version（`<main>.<sub>`） */
	basedOn?: string;
	/** ユーザ任意の版識別名・変更点 */
	changeReason?: string;
	/** リリース日（`YYYY-MM-DD`） */
	releasedAt?: string;
	/** 廃止日（`YYYY-MM-DD`） */
	closedAt?: string;
	/** 廃止理由 */
	closedReason?: string;
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
 * 空でない文字列だけを返す
 */
function optionalNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * 日付のみ（YYYY-MM-DD）に正規化する
 *
 * WARN: 旧確定 YAML の ISO datetime `releasedAt` は日付部分だけ残す。
 */
function optionalDateOnly(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return trimmed;
	}

	const isoDate = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed);
	return isoDate ? isoDate[1] : undefined;
}

/**
 * エディタ任意項目をキー省略付きで取り出す
 */
function pickOptionalEditorFields(meta: {
	basedOn?: unknown;
	changeReason?: unknown;
	releasedAt?: unknown;
	closedAt?: unknown;
	closedReason?: unknown;
}): Pick<
	UiDefinitionEditorMeta,
	'basedOn' | 'changeReason' | 'releasedAt' | 'closedAt' | 'closedReason'
> {
	const basedOn = optionalNonEmptyString(meta.basedOn);
	const changeReason = optionalNonEmptyString(meta.changeReason);
	const releasedAt = optionalDateOnly(meta.releasedAt);
	const closedAt = optionalDateOnly(meta.closedAt);
	const closedReason = optionalNonEmptyString(meta.closedReason);

	return {
		...(basedOn ? { basedOn } : {}),
		...(changeReason ? { changeReason } : {}),
		...(releasedAt ? { releasedAt } : {}),
		...(closedAt ? { closedAt } : {}),
		...(closedReason ? { closedReason } : {})
	};
}

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

	// WARN: 任意キーは無い場合キー自体を落とす。YAML dump / 比較ハッシュに undefined を混ぜない。
	return {
		logicalId: meta.logicalId,
		name: meta.name,
		description: meta.description,
		version: meta.version,
		...pickOptionalEditorFields(meta),
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
	const editor = toEditorMeta(editorMeta);

	if (!previous?.createdAt) {
		return {
			...editor,
			createdAt: iso,
			modifiedAt: iso
		};
	}

	return {
		...editor,
		createdAt: previous.createdAt,
		modifiedAt: iso
	};
}

/**
 * 確定版 snapshot 用メタデータを組み立てる（新ファイルのライフサイクル）
 *
 * WARN: `releasedAt` はユーザ入力。空ならキーを書かない（確定時刻では埋めない）。
 */
export function buildPublishedSnapshotMeta(
	editorMeta: UiDefinitionEditorMeta,
	publishedVersion: string,
	now: Date = new Date()
): UiDefinitionSnapshotMeta {
	const iso = now.toISOString();
	const editor = toEditorMeta({ ...editorMeta, version: publishedVersion });

	return {
		...editor,
		version: publishedVersion,
		createdAt: iso,
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
 * API リクエスト body からエディタ編集メタデータを取り出す（システム日時は無視）
 */
export function parseEditorMetaFromRecord(record: Record<string, unknown>): UiDefinitionEditorMeta {
	const external = normalizeExternalResidual(record.external);

	return {
		logicalId: typeof record.logicalId === 'string' ? record.logicalId : '',
		name: typeof record.name === 'string' ? record.name : '',
		description: typeof record.description === 'string' ? record.description : '',
		version: typeof record.version === 'string' ? record.version : '',
		...pickOptionalEditorFields(record),
		...(external ? { external } : {})
	};
}
