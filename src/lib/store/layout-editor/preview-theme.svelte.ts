import type { SelectOptionType } from 'flowbite-svelte/types';
import { createContext } from 'svelte';
import { resolvePreviewSelect, type PreviewSelectConfig } from '$lib/config/preview-config';

// プレビュー画面のテーマを管理するコンテキスト
export const [getPreviewThemeContext, setPreviewThemeContext] = createContext<PreviewTheme>();

/**
 * プレビュー画面のテーマを管理するクラス
 */
export class PreviewTheme {
	// テーマのリスト
	#theme = $state<SelectOptionType<string>[]>([]);

	// 選択されたテーマ
	#selected = $state<SelectOptionType<string>>({ name: '', value: '' });

	/**
	 * application 設定からプレビューテーマを初期化する
	 */
	constructor(config: PreviewSelectConfig) {
		const resolved = resolvePreviewSelect(config);
		this.#theme = resolved.options;
		this.#selected = resolved.selected;
	}

	/**
	 * テーマのリストを取得する
	 */
	get theme(): SelectOptionType<string>[] {
		return this.#theme;
	}

	/**
	 * テーマのリストを設定する
	 */
	set theme(value: SelectOptionType<string>[]) {
		this.#theme = value;
	}

	/**
	 * 選択されたテーマを取得する
	 */
	get selected(): SelectOptionType<string> {
		return this.#selected;
	}

	/**
	 * 選択されたテーマを設定する
	 */
	set selected(value: SelectOptionType<string>) {
		this.#selected = value;
	}

}

/**
 * プレビュー画面のテーマを管理するクラスを作成する
 */
export function createPreviewTheme(config: PreviewSelectConfig): PreviewTheme {
	return new PreviewTheme(config);
}

