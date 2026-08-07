import { debounce } from '$lib/utils/debounce';
import { isUiDefinitionMetaReady, type UiDefinitionEditorMeta } from '$lib/ir/ui-definition-meta';
import type { UIDefinition } from './layout-editor.svelte';

/**
 * IR 自動保存のクライアント側オプション
 */
export type IrAutoSaveOptions = {
	enabled: boolean;
	delay: number;
};

/**
 * 保存ペイロードの比較用ハッシュを生成する
 */
function buildSaveHash(uiDefinition: UIDefinition): string {
	return JSON.stringify({
		uiDefinition: {
			logicalId: uiDefinition.logicalId,
			name: uiDefinition.name,
			description: uiDefinition.description,
			version: uiDefinition.version
		},
		components: uiDefinition.components
	});
}

/**
 * 編集途絶え後に snapshot API へ POST する debounce を UIDefinition に接続する
 */
export function attachIrAutoSave(uiDefinition: UIDefinition, options: IrAutoSaveOptions): void {
	if (!options.enabled) {
		return;
	}

	let lastSavedHash = buildSaveHash(uiDefinition);

	const saveSnapshot = debounce(
		(payload: { uiDefinition: UiDefinitionEditorMeta; components: readonly unknown[] }, snapshot: string) => {
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
		const payload = {
			uiDefinition: {
				logicalId: uiDefinition.logicalId,
				name: uiDefinition.name,
				description: uiDefinition.description,
				version: uiDefinition.version
			},
			components: uiDefinition.components
		};
		const snapshot = buildSaveHash(uiDefinition);
		saveSnapshot(payload, snapshot);

		return () => {
			saveSnapshot.cancel();
		};
	});
}
