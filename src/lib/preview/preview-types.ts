/** 現時点でプレビュー対応している IR component type */
export type PreviewComponentType =
	'textbox' |
	'textarea' |
	'number' |
	'checkbox' |
	'radio' |
	'dropdown' |
	'dropdown-multi' |
	// 'datepicker' |
	// 'date-span' |
	// 'datetimepicker' |
	// 'timepicker' |
	'label' |
	'unknown'
	;

/**
 * プレビューレンダラが参照するコンポーネントデータ
 * WARN: IR 型確定までは store の any[] をこの型で受ける
 */
export type PreviewComponentData = Record<string, unknown> & {
	id: string;
	type: string;
	label?: string;
	hint?: string;
	disabled?: boolean;
	readonly?: boolean;
	rows?: number;
	validation?: {
		required?: boolean;
		maxlength?: number;
		pattern?: string;
		min?: number;
		max?: number;
		step?: number;
	};
	items?: { label: string; value: string }[];
	defaultValue?: string | string[];
	multiple?: boolean;
};

/** 型別プレビューレンダラ共通 props */
export type PreviewRendererProps = {
	component: PreviewComponentData;
};
