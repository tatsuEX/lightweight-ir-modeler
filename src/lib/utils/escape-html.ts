/**
 * HTML / XML 向けに特殊文字をエスケープする
 * 文字列以外は空文字を返す
 */
export function escapeHtml(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}

	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
