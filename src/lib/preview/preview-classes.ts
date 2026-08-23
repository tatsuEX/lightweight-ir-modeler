/** プレビュー DOM ルートの識別クラス */
export const PREVIEW_ROOT = 'preview-root';

/** プレビューテーマ scope クラスの接頭辞 */
export const PREVIEW_THEME_PREFIX = 'preview-theme';

/** プレビュー 行 */
export const PREVIEW_ROW = 'preview-row';

/** プレビュー 行ヘッダ */
export const PREVIEW_ROW_HEADER = 'preview-row__header';

/** プレビュー 行入力欄 */
export const PREVIEW_ROW_INPUT = 'preview-row__input';

/** プレビューフィールドの識別クラス接頭辞 */
export const PREVIEW_FIELD = 'preview-field';

/** コントロール（input / textarea）の識別クラス */
export const PREVIEW_CONTROL = 'preview-field__control';

/** ラベルの識別クラス */
export const PREVIEW_DISP_ONLY = 'preview-field__disp-only';

/** ヒントテキストの識別クラス */
export const PREVIEW_HINT = 'preview-field__hint';

/** 未対応 type 表示の識別クラス */
export const PREVIEW_UNKNOWN = 'preview-field__unknown';

/**
 * 選択テーマ value から scope 用 class を生成する
 */
export function previewThemeClass(themeValue: string): string {
	return `${PREVIEW_THEME_PREFIX}--${themeValue}`;
}

/**
 * コンポーネント type からフィールド識別 class を生成する
 */
export function previewFieldClass(type: string): string {
	return `${PREVIEW_FIELD} ${PREVIEW_FIELD}--${type}`;
}
