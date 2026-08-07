import { createContext } from 'svelte';
import type { SelectOptionType } from 'flowbite-svelte/types';
import { resolvePreviewSelect, type PreviewSelectConfig } from '$lib/config/preview-config';

// 変換対象を管理するコンテキスト
export const [getTransformTargetContext, setTransformTargetContext] = createContext<TransformTarget>();

/**
 * 変換対象を管理するクラス
 */
export class TransformTarget {

    // 変換対象のリスト
	#target = $state<SelectOptionType<string>[]>([]);

    // 選択された変換対象
	#selected = $state<SelectOptionType<string>>({ name: '', value: '' });

	/**
	 * application 設定から変換対象を初期化する
	 */
	constructor(config: PreviewSelectConfig) {
		const resolved = resolvePreviewSelect(config);
		this.#target = resolved.options;
		this.#selected = resolved.selected;
	}

	/**
	 * 変換対象のリストを取得する
	 */
	get target(): SelectOptionType<string>[] {
		return this.#target;
	}

	/**
	 * 変換対象のリストを設定する
	 */
	set target(value: SelectOptionType<string>[]) {
		this.#target = value;
	}

	/**
	 * 選択された変換対象を取得する
	 */
	get selected(): SelectOptionType<string> {
		return this.#selected;
	}

	/**
	 * 選択された変換対象を設定する
	 */
	set selected(value: SelectOptionType<string>) {
		this.#selected = value;
	}

}

/**
 * 変換対象を管理するクラスを作成する
 */
export function createTransformTarget(config: PreviewSelectConfig): TransformTarget {
	return new TransformTarget(config);
}

