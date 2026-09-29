/**
 * layout-editor（クライアント共有）向けの型と既定値
 *
 * WARN: server の application-config から再エクスポートせず、ここを直接参照する。
 */

/** layoutEditor.property.itemDelimiter の既定値（`${value}${delimiter}${label}`） */
export const DEFAULT_ITEM_DELIMITER = ':';

/**
 * 未使用画面 ID（新規 snapshot ディレクトリ）確定時に確認ダイアログを出すか（既定: 出す）
 */
export const DEFAULT_CONFIRM_SNAPSHOT_DIR_CREATION = true;

/** ブラウザタブ内の編集セッション保持期限の既定（12 時間、ms） */
export const DEFAULT_CLIENT_SESSION_MAX_LIFETIME_MS = 43_200_000;

/**
 * Property 属性エディタ設定
 */
export type LayoutEditorPropertyConfig = {
	/** items タグの value / label 区切り（`${value}${itemDelimiter}${label}`） */
	itemDelimiter: string;
	/**
	 * 未使用の画面 ID で自動保存先（snapshot ディレクトリ）が新規になるときの確認
	 *
	 * WARN: false のときはダイアログを出さない。「次回以降確認しない」はブラウザ側でも抑制できる。
	 */
	confirmSnapshotDirCreation: boolean;
};

/**
 * ブラウザタブ内 client session の保持期限
 *
 * サーバセッションへ移すときも同じ項目を保持期限に使う。二本立てにはしない。
 */
export type LayoutEditorClientSessionConfig = {
	maxLifetimeMs: number;
};

/**
 * layout-editor 画面向け設定
 */
export type LayoutEditorConfig = {
	property: LayoutEditorPropertyConfig;
	clientSession: LayoutEditorClientSessionConfig;
};
