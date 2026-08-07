import { debounce } from '$lib/utils/debounce';
import type { UIDefinition } from './layout-editor.svelte';

/**
 * IR 自動保存のクライアント側オプション
 */
export type IrAutoSaveOptions = {
	enabled: boolean;
	delay: number;
};

/**
 * 編集途絶え後に snapshot API へ POST する debounce を UIDefinition に接続する
 */
export function attachIrAutoSave(uiDefinition: UIDefinition, options: IrAutoSaveOptions): void {
	if (!options.enabled) {
		return;
	}

	let lastSavedHash = JSON.stringify(uiDefinition.components);

	const saveSnapshot = debounce(
		(components: readonly unknown[], snapshot: string) => {
			void (async () => {
				if (snapshot === lastSavedHash) {
					return;
				}

				try {
					const response = await fetch('/api/ir/snapshot', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ components })
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
		const components = uiDefinition.components;
		const snapshot = JSON.stringify(components);
		saveSnapshot(components, snapshot);

		return () => {
			saveSnapshot.cancel();
		};
	});
}
