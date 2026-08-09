/**
 * CSS 向けに特殊文字をエスケープする
 * 文字列以外は空文字を返す
 */
export function escapeCss(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}

	return value
		.replace(/&/g, '&amp;')
		.replace(/:/g, '\\:')
		.replace(/,/g, '\\,')
		.replace(/\s/g, '\\ ')
		.replace(/#/g, '\\#')
		.replace(/\./g, '\\.')
		.replace(/!/g, '\\!');
}