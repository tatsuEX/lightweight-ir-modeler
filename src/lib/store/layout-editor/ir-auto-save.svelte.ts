import type { IrAutoSaveConfig } from '$lib/config/application-types';
import { untrack } from 'svelte';
import { debounce } from '$lib/utils/debounce';
import { isUiDefinitionMetaReady, toEditorMetaFromLive, type UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';
import type { UIDefinition } from '$lib/ir/ui-definition';
import { getToastContext } from '$lib/store/toast/toast.svelte';
import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';
import {
	hasSchemaMigrationConsent,
	isSchemaMigrationSaveBlocked,
	requestSchemaConsent,
	schemaMigrationEpoch,
	blockSchemaMigrationSave
} from './schema-migration-consent.svelte';
import type { SnapshotComments } from './snapshot-comments.svelte';

// WARN: logger は ブラウザから利用できない。

/**
 * IR 自動保存のクライアント側オプション（dir / maxGenerations はサーバのみ）
 */
export type IrAutoSaveOptions = Pick<IrAutoSaveConfig, 'enabled' | 'delay' | 'commentDelayExtra'>;

/**
 * snapshot API へ POST するペイロード
 */
type SnapshotSavePayload = {
	uiDefinition: UiDefinitionEditorMeta;
	components: readonly unknown[];
	comments: Record<string, string>;
	confirmMigration?: boolean;
};

/**
 * 保存対象のメタデータを取り出す
 *
 * WARN: external を落とすと import 由来のベンダー固有キーが snapshot 経由で失われる。
 */
function buildSaveMeta(uiDefinition: UIDefinition): UiDefinitionEditorMeta {
	return toEditorMetaFromLive(uiDefinition.meta);
}

/**
 * IR（meta + components）の比較用ハッシュを生成する
 */
function buildIrHash(uiDefinition: UIDefinition): string {
	return JSON.stringify({
		uiDefinition: buildSaveMeta(uiDefinition),
		components: uiDefinition.components
	});
}

/**
 * 運用コメント map の比較用ハッシュを生成する
 */
function buildCommentsHash(comments: SnapshotComments, componentIds: readonly string[]): string {
	return JSON.stringify(comments.toYamlMap(componentIds));
}

/**
 * 自動保存が最後に成功したとみなす比較値
 *
 * WARN: 再マウントのたびに現在値で初期化すると、未送信の差分が次の編集まで保存されない。
 */
export type AutoSaveCheckpoint = {
	irHash: string;
	commentsHash: string;
};

/**
 * いまの IR とコメントから比較値を取る
 */
export function captureAutoSaveCheckpoint(
	uiDefinition: UIDefinition,
	comments: SnapshotComments
): AutoSaveCheckpoint {
	const componentIds = uiDefinition.components.map((component) => component.id);
	return {
		irHash: buildIrHash(uiDefinition),
		commentsHash: buildCommentsHash(comments, componentIds)
	};
}

/**
 * 前回の比較値から、今回の保存タイミングを決める
 */
export function selectAutoSaveTiming(
	checkpoint: AutoSaveCheckpoint,
	next: AutoSaveCheckpoint
): 'ir' | 'comments' | 'none' {
	if (next.irHash !== checkpoint.irHash) {
		return 'ir';
	}
	if (next.commentsHash !== checkpoint.commentsHash) {
		return 'comments';
	}
	return 'none';
}

/**
 * schemaVersion 失敗の code か判定する
 */
function isSnapshotSchemaBlock(value: unknown): value is SnapshotSchemaBlock {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const code = (value as { code?: unknown }).code;
	return (
		code === 'schema-future' ||
		code === 'schema-unreadable' ||
		code === 'schema-no-path' ||
		code === 'schema-consent'
	);
}

/**
 * 編集途絶え後に snapshot API へ POST する debounce を UIDefinition とコメント store に接続する
 *
 * IR 変化は `delay`、コメント map のみは `delay + commentDelayExtra`。両方変わるときは短い方に合流する。
 */
export function attachIrAutoSave(
	uiDefinition: UIDefinition,
	comments: SnapshotComments,
	options: IrAutoSaveOptions,
	checkpoint: AutoSaveCheckpoint
): void {
	if (!options.enabled) {
		return;
	}

	// WARN: getToastContext は debounce コールバック内ではなく、コンポーネント初期化中に取る。
	const toast = getToastContext();
	let lastSavedIrHash = checkpoint.irHash;
	let lastSavedCommentsHash = checkpoint.commentsHash;

	/**
	 * snapshot API へ POST し、成功時に保存済み hash を更新する
	 */
	function postSnapshot(payload: SnapshotSavePayload, irHash: string, commentsHash: string): void {
		void (async () => {
			// 保存済み hash が変化していない場合は保存しない
			if (irHash === lastSavedIrHash && commentsHash === lastSavedCommentsHash) {
				return;
			}

			// UI 定義メタデータが準備されていない場合は保存しない
			if (!isUiDefinitionMetaReady(payload.uiDefinition)) {
				return;
			}

			try {
				// snapshot API へ POST する
				const response = await fetch('/api/ir/snapshot', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});

				// 保存成功時は保存済み hash を更新する
				if (response.ok) {
					lastSavedIrHash = irHash;
					lastSavedCommentsHash = commentsHash;
					checkpoint.irHash = irHash;
					checkpoint.commentsHash = commentsHash;
					return;
				}

				const body = await response.json().catch(() => null);
				if (isSnapshotSchemaBlock(body)) {
					blockSchemaMigrationSave(payload.uiDefinition.logicalId);
					if (body.code === 'schema-consent') {
						requestSchemaConsent({
							logicalId: payload.uiDefinition.logicalId,
							rationales: body.rationales,
							schemaVersion: body.schemaVersion,
							latest: body.latest
						});
						return;
					}
					toast.error('自動保存を止めました', body.error);
					return;
				}

				console.warn(`[ir-auto-save] save failed: ${response.status}`);
				toast.error('自動保存に失敗しました', `HTTP ${response.status}`);
			} catch (error) {
				const detail = error instanceof Error ? error.message : String(error);
				console.warn(`[ir-auto-save] save error: ${detail}`);
				toast.error('自動保存に失敗しました', detail);
			}
		})();
	}

	/**
	 * IR 変化時に snapshot API へ POST する debounce
	 */
	const saveSoon = debounce(postSnapshot, options.delay);
	/**
	 * コメント map 変化時に snapshot API へ POST する debounce
	 */
	const saveLater = debounce(postSnapshot, options.delay + options.commentDelayExtra);

	// WARN: retain を save と同じ $effect で #map に書くと effect_update_depth_exceeded になる。
	$effect(() => {
		const componentIds = uiDefinition.components.map((component) => component.id);
		untrack(() => {
			comments.retainComponentIds(componentIds);
		});
	});

	/**
	 * IR 変化時に snapshot API へ POST する
	 */
	$effect(() => {
		schemaMigrationEpoch();
		const logicalId = uiDefinition.meta.logicalId;
		if (isSchemaMigrationSaveBlocked(logicalId)) {
			return;
		}

		const componentIds = uiDefinition.components.map((component) => component.id);
		const payload: SnapshotSavePayload = {
			uiDefinition: buildSaveMeta(uiDefinition),
			components: uiDefinition.components,
			comments: comments.toYamlMap(componentIds),
			...(hasSchemaMigrationConsent(logicalId) ? { confirmMigration: true } : {})
		};
		const irHash = buildIrHash(uiDefinition);
		const commentsHash = buildCommentsHash(comments, componentIds);
		const timing = selectAutoSaveTiming(
			{ irHash: lastSavedIrHash, commentsHash: lastSavedCommentsHash },
			{ irHash, commentsHash }
		);

		if (timing === 'ir') {
			// IR 変化時は遅延保存をキャンセルし、即時保存を実行する
			saveLater.cancel();
			saveSoon(payload, irHash, commentsHash);
		} else if (timing === 'comments') {
			// コメント map 変化時は即時保存をキャンセルし、遅延保存を実行する
			saveSoon.cancel();
			saveLater(payload, irHash, commentsHash);
		}

		return () => {
			saveSoon.cancel();
			saveLater.cancel();
		};
	});
}
