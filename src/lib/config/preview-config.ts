/**
 * プレビュー画面の Select 1 件分
 */
export type PreviewSelectOption = {
	name: string;
	value: string;
};

/**
 * プレビュー画面の Select 設定（テーマ / 出力先共通）
 */
export type PreviewSelectConfig = {
	default: string;
	options: PreviewSelectOption[];
};

/**
 * プレビュー画面向け application 設定
 */
export type PreviewConfig = {
	theme: PreviewSelectConfig;
	transformTarget: PreviewSelectConfig;
};

/**
 * Select 設定から options と初期選択を導出する
 */
export function resolvePreviewSelect(config: PreviewSelectConfig): {
	options: PreviewSelectOption[];
	selected: PreviewSelectOption;
} {
	if (config.options.length === 0) {
		throw new Error('preview select options must not be empty');
	}

	const selected = config.options.find((option) => option.value === config.default);
	if (!selected) {
		throw new Error('preview select default must match one of options[].value');
	}

	return {
		options: config.options,
		selected
	};
}
