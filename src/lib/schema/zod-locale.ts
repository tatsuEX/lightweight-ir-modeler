import * as z from 'zod';
import ja from 'zod/v4/locales/ja.js';

let configured = false;

/**
 * Zod の日本語エラーメッセージを process 内で一度だけ有効化する
 */
export function ensureZodLocaleJa(): void {
	if (configured) {
		return;
	}

	z.config(ja());
	configured = true;
}

/**
 * テスト用: locale 初期化フラグをリセットする
 */
export function resetZodLocaleForTests(): void {
	configured = false;
}
