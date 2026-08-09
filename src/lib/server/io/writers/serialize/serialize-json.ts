/**
 * オブジェクトを pretty-print JSON 文字列へシリアライズする
 */
export function serializeJson(payload: unknown): string {
	return `${JSON.stringify(payload, null, 2)}\n`;
}
