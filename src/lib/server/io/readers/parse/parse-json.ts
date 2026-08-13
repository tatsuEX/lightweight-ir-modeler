/**
 * UTF-8 BOM があれば除去する（意味不変）
 */
export function stripUtf8Bom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * JSON 文字列を値へパースする（serialize-json の対）
 *
 * WARN: BOM 除去のみ行う。undefined / 末尾カンマ等の寛容パースはしない。
 */
export function parseJson(text: string): unknown {
	return JSON.parse(stripUtf8Bom(text));
}
