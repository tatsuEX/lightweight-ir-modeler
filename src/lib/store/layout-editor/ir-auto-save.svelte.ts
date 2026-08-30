import type { IrAutoSaveConfig } from '$lib/config/application-types';
import { untrack } from 'svelte';
import { debounce } from '$lib/utils/debounce';
import { isUiDefinitionMetaReady, type UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';
import { getToastContext } from '$lib/store/toast/toast.svelte';
import type { UIDefinition } from './layout-editor.svelte';
import type { SnapshotComments } from './snapshot-comments.svelte';

/**
 * IR 自動保存のクライアント側オプション（dir / maxGenerations はサーバのみ）
 */
export type IrAutoSaveOptions = Pick<IrAutoSaveConfig, 'enabled' | 'delay' | 'commentDelayExtra'>;

type SnapshotSavePayload = {
	uiDefinition: UiDefinitionEditorMeta;
	components: readonly unknown[];
	comments: Record<string, string>;
};

/**
 * 保存対象のメタデータを取り出す
 *
 * WARN: external を落とすと import 由来のベンダー固有キーが snapshot 経由で失われる。
 */
function buildSaveMeta(uiDefinition: UIDefinition): UiDefinitionEditorMeta {
	return {
		logicalId: uiDefinition.logicalId,
		name: uiDefinition.name,
		description: uiDefinition.description,
		version: uiDefinition.version,
		...(uiDefinition.external ? { external: uiDefinition.external } : {})
	};
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
 * 編集途絶え後に snapshot API へ POST する debounce を UIDefinition とコメント store に接続する
 *
 * IR 変化は `delay`、コメント map のみは `delay + commentDelayExtra`。両方変わるときは短い方に合流する。
 */
export function attachIrAutoSave(
	uiDefinition: UIDefinition,
	comments: SnapshotComments,
	options: IrAutoSaveOptions
): void {
	if (!options.enabled) {
		return;
	}

	// WARN: getToastContext は debounce コールバック内ではなく、コンポーネント初期化中に取る。
	const toast = getToastContext();
	const initialComponentIds = uiDefinition.components.map((component) => component.id);
	let lastSavedIrHash = buildIrHash(uiDefinition);
	let lastSavedCommentsHash = buildCommentsHash(comments, initialComponentIds);

	/**
	 * snapshot API へ POST し、成功時に保存済み hash を更新する
	 */
	function postSnapshot(payload: SnapshotSavePayload, irHash: string, commentsHash: string): void {
		void (async () => {
			if (irHash === lastSavedIrHash && commentsHash === lastSavedCommentsHash) {
				return;
			}

			if (!isUiDefinitionMetaReady(payload.uiDefinition)) {
				return;
			}

			try {
				const response = await fetch('/api/ir/snapshot', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});

				if (response.ok) {
					lastSavedIrHash = irHash;
					lastSavedCommentsHash = commentsHash;
					return;
				}

				console.warn('[ir-auto-save] save failed:', response.status);
				toast.error('自動保存に失敗しました', `HTTP ${response.status}`);
			} catch (error) {
				console.warn('[ir-auto-save] save error:', error);
				const detail = error instanceof Error ? error.message : String(error);
				toast.error('自動保存に失敗しました', detail);
			}
		})();
	}

	const saveSoon = debounce(postSnapshot, options.delay);
	const saveLater = debounce(postSnapshot, options.delay + options.commentDelayExtra);

	// WARN: retain を save と同じ $effect で #map に書くと effect_update_depth_exceeded になる。
	$effect(() => {
		const componentIds = uiDefinition.components.map((component) => component.id);
		untrack(() => {
			comments.retainComponentIds(componentIds);
		});
	});

	$effect(() => {
		const componentIds = uiDefinition.components.map((component) => component.id);
		const payload: SnapshotSavePayload = {
			uiDefinition: buildSaveMeta(uiDefinition),
			components: uiDefinition.components,
			comments: comments.toYamlMap(componentIds)
		};
		const irHash = buildIrHash(uiDefinition);
		const commentsHash = buildCommentsHash(comments, componentIds);
		const irChanged = irHash !== lastSavedIrHash;
		const commentsChanged = commentsHash !== lastSavedCommentsHash;

		if (irChanged) {
			saveLater.cancel();
			saveSoon(payload, irHash, commentsHash);
		} else if (commentsChanged) {
			saveSoon.cancel();
			saveLater(payload, irHash, commentsHash);
		}

		return () => {
			saveSoon.cancel();
			saveLater.cancel();
		};
	});
}
