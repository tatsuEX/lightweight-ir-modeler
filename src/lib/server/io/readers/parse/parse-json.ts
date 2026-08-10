/**
 * JSON 文字列を値へパースする（serialize-json の対）
 */
export function parseJson(text: string): unknown {
	return JSON.parse(text);
}
