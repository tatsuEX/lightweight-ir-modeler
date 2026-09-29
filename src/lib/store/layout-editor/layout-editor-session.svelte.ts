/**
 * layout-editor の編集束を client session として保持し、Svelte Context へ渡す側に渡す
 *
 * このモジュールだけが $state の生成と Repository 登録を行う。
 */

import { nanoid } from 'nanoid';
import { DEFAULT_CLIENT_SESSION_MAX_LIFETIME_MS } from '$lib/config/layout-editor-config';
import type { PreviewConfig } from '$lib/config/preview-config';
import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';
import {
	DEFAULT_UI_DEFINITION_VERSION,
	isValidLogicalId,
	parseEditorMetaFromRecord,
	type UiDefinitionEditorMeta
} from '$lib/ir/ui-definition-meta';
import type { UIDefinition } from '$lib/ir/ui-definition';
import { createPreviewTheme, type PreviewTheme } from '$lib/store/layout-editor/preview-theme.svelte';
import {
	createSnapshotComments,
	type SnapshotComments
} from '$lib/store/layout-editor/snapshot-comments.svelte';
import { createTransformTarget, type TransformTarget } from '$lib/store/layout-editor/transform-target.svelte';
import {
	captureAutoSaveCheckpoint,
	type AutoSaveCheckpoint
} from '$lib/store/layout-editor/ir-auto-save.svelte';
import { createReactiveUIDefinition } from '$lib/store/layout-editor/layout-editor.svelte';
import { createLayoutColumns, type LayoutColumns } from '$lib/store/layout-editor/layout-columns.svelte';
import {
	blockSchemaMigrationSave,
	requestSchemaConsent
} from '$lib/store/layout-editor/schema-migration-consent.svelte';
import { readOrCreateClientSessionId } from './client-session-id';
import {
	adoptHotEntries,
	ClientSessionRepository,
	clientSessionKeysEqual,
	type ClientSessionHot,
	type ClientSessionKey
} from './client-session-repository';

/** logicalId 未確定のときのキー接頭辞。sessionId とは別 */
const DRAFT_LOGICAL_ID_PREFIX = 'draft:';

/**
 * 画面定義 1 件分の編集状態
 */
export type LayoutEditorSession = {
	key: ClientSessionKey;
	uiDefinition: UIDefinition;
	snapshotComments: SnapshotComments;
	previewTheme: PreviewTheme;
	transformTarget: TransformTarget;
	checkpoint: AutoSaveCheckpoint;
	schemaAnnounced: boolean;
	/** 並べ替え列と退避列。snapshot には載せない */
	layoutColumns: LayoutColumns;
};

/**
 * layout load から session を初めて作るときの種
 */
export type LayoutEditorSessionSeed = {
	maxLifetimeMs: number;
	logicalId: string;
	name: string;
	description: string;
	version: string;
	preview: PreviewConfig;
	initialSnapshot: unknown[] | null;
	initialUiDefinition: UiDefinitionEditorMeta | null;
	initialComments: Record<string, string>;
	schemaBlock: SnapshotSchemaBlock | null;
};

/**
 * ディスク上の snapshot をスロットへ載せるときの形
 */
export type LayoutEditorDiskSnapshot = {
	uiDefinition?: object;
	components?: unknown[];
	comments?: Record<string, string>;
};

const hot = import.meta.hot as (ClientSessionHot & { accept: () => void }) | undefined;

const repository = new ClientSessionRepository<LayoutEditorSession>({
	maxLifetimeMs: DEFAULT_CLIENT_SESSION_MAX_LIFETIME_MS,
	entries: adoptHotEntries(new Map(), hot)
});

/** ディスクから新しいスロットを作るときに使うプレビュー設定（ブラウザのみ） */
let browserPreview: PreviewConfig | null = null;

/**
 * HMR 後にアクティブな session を Map から戻す
 */
function readRestoredActive(): LayoutEditorSession | null {
	const saved = hot?.data.activeKey as ClientSessionKey | undefined;
	if (!saved) {
		return null;
	}
	return repository.peek(saved) ?? null;
}

let activeSession = $state<LayoutEditorSession | null>(readRestoredActive());

if (hot) {
	hot.accept();
}

/**
 * いま画面に出している session を返す
 */
export function activeLayoutEditorSession(): LayoutEditorSession | null {
	return activeSession;
}

/**
 * アクティブ session を差し替え、HMR 用にキーを残す
 */
function setActive(session: LayoutEditorSession): void {
	activeSession = session;
	if (hot) {
		hot.data.activeKey = session.key;
	}
}

/**
 * アクティブ session が無ければ失敗する
 */
function requireActive(): LayoutEditorSession {
	if (!activeSession) {
		throw new Error('layout editor session is not active');
	}
	return activeSession;
}

/**
 * 空の logicalId は draft キーにする
 */
function sessionLogicalIdForSeed(logicalId: string): string {
	const trimmed = logicalId.trim();
	if (isValidLogicalId(trimmed)) {
		return trimmed;
	}
	return `${DRAFT_LOGICAL_ID_PREFIX}${nanoid()}`;
}

/**
 * draft キーなら画面上の logicalId は空にする
 */
function displayLogicalId(logicalId: string): string {
	return logicalId.startsWith(DRAFT_LOGICAL_ID_PREFIX) ? '' : logicalId;
}

/**
 * 種から編集束を作る。snapshot と schema ブロックはここで一度だけ適用する
 */
function buildSession(seed: LayoutEditorSessionSeed, key: ClientSessionKey): LayoutEditorSession {
	const uiDefinition = createReactiveUIDefinition(
		displayLogicalId(key.logicalId),
		seed.name,
		seed.description,
		seed.version || key.version
	);
	const snapshotComments = createSnapshotComments();
	if (seed.initialSnapshot) {
		uiDefinition.loadSnapshot(seed.initialSnapshot, seed.initialUiDefinition ?? undefined);
		snapshotComments.loadFromYamlMap(
			seed.initialComments ?? {},
			uiDefinition.components.map((component) => component.id)
		);
	}

	if (seed.schemaBlock && isValidLogicalId(seed.logicalId)) {
		blockSchemaMigrationSave(seed.logicalId);
		if (seed.schemaBlock.code === 'schema-consent') {
			requestSchemaConsent({
				logicalId: seed.logicalId,
				rationales: seed.schemaBlock.rationales,
				schemaVersion: seed.schemaBlock.schemaVersion,
				latest: seed.schemaBlock.latest
			});
		}
	}

	return {
		key: { ...key },
		uiDefinition,
		snapshotComments,
		previewTheme: createPreviewTheme(seed.preview.theme),
		transformTarget: createTransformTarget(seed.preview.transformTarget),
		checkpoint: captureAutoSaveCheckpoint(uiDefinition, snapshotComments),
		schemaAnnounced: false,
		layoutColumns: createLayoutColumns(uiDefinition.components)
	};
}

/**
 * ディスク読込用の空スロットを作る
 */
function buildShell(key: ClientSessionKey): LayoutEditorSession {
	if (!browserPreview) {
		throw new Error('layout editor preview config is not set');
	}
	return buildSession(
		{
			maxLifetimeMs: repository.maxLifetimeMs,
			logicalId: displayLogicalId(key.logicalId),
			name: '',
			description: '',
			version: key.version || DEFAULT_UI_DEFINITION_VERSION,
			preview: browserPreview,
			initialSnapshot: null,
			initialUiDefinition: null,
			initialComments: {},
			schemaBlock: null
		},
		key
	);
}

/**
 * meta に合わせてキーを移す。sessionId は変えない。移動先が埋まっていればキーは据え置く
 */
function alignSessionKey(session: LayoutEditorSession): void {
	const logicalId = session.uiDefinition.meta.logicalId.trim();
	const version = session.uiDefinition.meta.version.trim() || session.key.version;
	const next: ClientSessionKey = {
		sessionId: session.key.sessionId,
		logicalId: isValidLogicalId(logicalId) ? logicalId : session.key.logicalId,
		version
	};
	if (clientSessionKeysEqual(session.key, next)) {
		return;
	}

	try {
		repository.rekey(session.key, next);
		session.key = next;
		if (hot && activeSession && clientSessionKeysEqual(activeSession.key, session.key)) {
			hot.data.activeKey = session.key;
		}
	} catch (error) {
		console.warn('[layout-editor-session] rekey skipped', error);
	}
}

/**
 * アクティブ session を返す。HMR では種を当て直さない。サーバ描画では Map に残さない
 */
export function ensureActiveLayoutEditorSession(seed: LayoutEditorSessionSeed): LayoutEditorSession {
	if (typeof window === 'undefined') {
		return buildSession(seed, {
			sessionId: 'ssr',
			logicalId: sessionLogicalIdForSeed(seed.logicalId),
			version: seed.version || DEFAULT_UI_DEFINITION_VERSION
		});
	}

	repository.configure(seed.maxLifetimeMs);
	browserPreview = seed.preview;
	// WARN: activeSession は $state proxy。Map の実体と === では一致しない。
	if (activeSession && repository.peek(activeSession.key)) {
		return activeSession;
	}

	const sessionId = readOrCreateClientSessionId(sessionStorage);
	const key: ClientSessionKey = {
		sessionId,
		logicalId: sessionLogicalIdForSeed(seed.logicalId),
		version: seed.version || DEFAULT_UI_DEFINITION_VERSION
	};
	const { record } = repository.acquire(key, () => buildSession(seed, key));
	alignSessionKey(record.value);
	setActive(record.value);
	return record.value;
}

/**
 * 未使用の画面 ID へ、いまの編集内容を付け替える
 */
export function rekeyActiveSessionLogicalId(logicalId: string): void {
	const session = requireActive();
	const next: ClientSessionKey = { ...session.key, logicalId };
	repository.rekey(session.key, next);
	session.key = next;
	session.uiDefinition.meta.logicalId = logicalId;
	if (hot) {
		hot.data.activeKey = session.key;
	}
}

/**
 * ディスクの snapshot をその logicalId + version のスロットへ書き、アクティブにする
 */
export function activateLayoutEditorDiskSnapshot(snapshot: LayoutEditorDiskSnapshot): void {
	const current = requireActive();
	const meta = snapshot.uiDefinition
		? parseEditorMetaFromRecord(snapshot.uiDefinition as Record<string, unknown>)
		: undefined;
	const logicalId =
		meta && isValidLogicalId(meta.logicalId.trim()) ? meta.logicalId.trim() : current.key.logicalId;
	const version = meta?.version.trim() || current.key.version;
	const key: ClientSessionKey = {
		sessionId: current.key.sessionId,
		logicalId,
		version
	};
	const { record } = repository.acquire(key, () => buildShell(key));
	const target = record.value;
	target.uiDefinition.loadSnapshot(snapshot.components ?? [], meta);
	target.snapshotComments.loadFromYamlMap(
		snapshot.comments ?? {},
		target.uiDefinition.components.map((component) => component.id)
	);
	const checkpoint = captureAutoSaveCheckpoint(target.uiDefinition, target.snapshotComments);
	target.checkpoint.irHash = checkpoint.irHash;
	target.checkpoint.commentsHash = checkpoint.commentsHash;
	alignSessionKey(target);
	setActive(target);
}

/**
 * 取り込みなどで meta が変わったあと、キーを meta に合わせる
 */
export function rekeyActiveSessionFromMeta(): void {
	alignSessionKey(requireActive());
}
