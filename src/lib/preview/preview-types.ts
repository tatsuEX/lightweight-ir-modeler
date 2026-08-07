/** 現時点でプレビュー対応している IR component type */
export type PreviewComponentType = 'textbox' | 'textarea' | 'number';

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
};

/** 型別プレビューレンダラ共通 props */
export type PreviewRendererProps = {
	component: PreviewComponentData;
};
