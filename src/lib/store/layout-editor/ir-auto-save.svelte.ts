import { debounce } from '$lib/utils/debounce';
import { isUiDefinitionMetaReady, type UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';
import type { UIDefinition } from './layout-editor.svelte';
import type { SnapshotComments } from './snapshot-comments.svelte';

/**
 * IR 自動保存のクライアント側オプション
 */
export type IrAutoSaveOptions = {
	enabled: boolean;
	delay: number;
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
 * 保存ペイロードの比較用ハッシュを生成する
 */
function buildSaveHash(uiDefinition: UIDefinition, comments: SnapshotComments): string {
	return JSON.stringify({
		uiDefinition: buildSaveMeta(uiDefinition),
		components: uiDefinition.components,
		comments: comments.toYamlMap(uiDefinition.components.map((component) => component.id))
	});
}

/**
 * 編集途絶え後に snapshot API へ POST する debounce を UIDefinition とコメント store に接続する
 */
export function attachIrAutoSave(
	uiDefinition: UIDefinition,
	comments: SnapshotComments,
	options: IrAutoSaveOptions
): void {
	if (!options.enabled) {
		return;
	}

	let lastSavedHash = buildSaveHash(uiDefinition, comments);

	const saveSnapshot = debounce(
		(
			payload: {
				uiDefinition: UiDefinitionEditorMeta;
				components: readonly unknown[];
				comments: Record<string, string>;
			},
			snapshot: string
		) => {
			void (async () => {
				if (snapshot === lastSavedHash) {
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
						lastSavedHash = snapshot;
						return;
					}

					console.warn('[ir-auto-save] save failed:', response.status);
				} catch (error) {
					console.warn('[ir-auto-save] save error:', error);
				}
			})();
		},
		options.delay
	);

	$effect(() => {
		const componentIds = uiDefinition.components.map((component) => component.id);
		comments.retainComponentIds(componentIds);
		const payload = {
			uiDefinition: buildSaveMeta(uiDefinition),
			components: uiDefinition.components,
			comments: comments.toYamlMap(componentIds)
		};
		const snapshot = buildSaveHash(uiDefinition, comments);
		saveSnapshot(payload, snapshot);

		return () => {
			saveSnapshot.cancel();
		};
	});
}
