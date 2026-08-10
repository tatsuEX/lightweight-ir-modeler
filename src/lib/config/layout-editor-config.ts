/**
 * layout-editor（クライアント共有）向けの型と既定値
 *
 * WARN: server の application-config から再エクスポートせず、ここを直接参照する。
 */

/** layoutEditor.property.itemDelimiter の既定値（`${value}${delimiter}${label}`） */
export const DEFAULT_ITEM_DELIMITER = ':';

/**
 * Property 属性エディタ設定
 */
export type LayoutEditorPropertyConfig = {
	/** items タグの value / label 区切り（`${value}${itemDelimiter}${label}`） */
	itemDelimiter: string;
};

/**
 * layout-editor 画面向け設定
 */
export type LayoutEditorConfig = {
	property: LayoutEditorPropertyConfig;
};
