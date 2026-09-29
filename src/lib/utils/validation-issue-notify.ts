/**
 * 検証 issue をユーザ通知用に整形する
 */

/** path + message を持つ issue */
export type NotifyIssue = {
	path: string;
	message: string;
};

/**
 * 複数 issue を detail 文言にする（改行区切り）
 */
export function formatIssuesDetail(
	issues: readonly NotifyIssue[],
	maxLines = 20
): string {
	if (issues.length === 0) {
		return '';
	}

	const lines = issues
		.slice(0, maxLines)
		.map((issue) => `・${issue.path}: ${issue.message}`);
	if (issues.length > maxLines) {
		lines.push(`…他 ${issues.length - maxLines} 件`);
	}
	return lines.join('\n');
}

/**
 * 複数の検証 issue をまとめて運ぶエラー
 *
 * WARN: 先頭 1 件だけを message にしない。呼び出し側は `issues` をすべて出す。
 */
export class IssuesError extends Error {
	readonly issues: readonly NotifyIssue[];

	/**
	 * 全 issue 付きのエラーを作る
	 */
	constructor(summary: string, issues: readonly NotifyIssue[]) {
		super(
			issues.length === 0
				? summary
				: `${summary}\n${formatIssuesDetail(issues)}`
		);
		this.name = 'IssuesError';
		this.issues = issues;
	}
}

/**
 * unknown から IssuesError の issues を取り出す
 */
export function issuesFromUnknown(error: unknown): readonly NotifyIssue[] {
	if (error instanceof IssuesError) {
		return error.issues;
	}
	return [];
}
