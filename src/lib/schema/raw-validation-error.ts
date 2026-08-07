/**
 * Raw 検証の個別 issue
 */
export type RawValidationIssue = {
	path: string;
	message: string;
};

/**
 * RawDefinition の Zod 検証失敗
 */
export class RawValidationError extends Error {
	readonly targetId: string;
	readonly issues: RawValidationIssue[];

	/**
	 * Raw 検証エラーを生成する
	 */
	constructor(targetId: string, issues: RawValidationIssue[]) {
		const summary = issues[0]?.message ?? 'RawDefinition validation failed';
		super(issues.length > 1 ? `${summary}（他 ${issues.length - 1} 件）` : summary);
		this.name = 'RawValidationError';
		this.targetId = targetId;
		this.issues = issues;
	}
}

/**
 * Zod issue path をドット区切り文字列へ変換する
 */
export function formatZodIssuePath(path: PropertyKey[]): string {
	if (path.length === 0) {
		return '(root)';
	}

	return path
		.map((segment) => (typeof segment === 'symbol' ? segment.toString() : String(segment)))
		.join('.');
}
