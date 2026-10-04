import type { WriterPipelineDiagnostic } from '$lib/server/writer-pipeline/types';

/**
 * ユーザへ返す path と message
 */
export type WriterPipelineIssue = {
	path: string;
	message: string;
};

/**
 * writer pipeline を中断したときのエラー
 *
 * diagnostics は warn 以上を、発生順のまま持つ。
 */
export class WriterPipelineError extends Error {
	readonly diagnostics: readonly WriterPipelineDiagnostic[];

	/**
	 * 蓄積済み diagnostic からエラーを作る
	 */
	constructor(diagnostics: readonly WriterPipelineDiagnostic[]) {
		const visible = diagnostics.filter(
			(diagnostic) => diagnostic.severity === 'error' || diagnostic.severity === 'warn'
		);
		const errorCount = visible.filter((diagnostic) => diagnostic.severity === 'error').length;
		const summary =
			errorCount === 0
				? 'writer pipeline failed'
				: `writer pipeline error が ${errorCount} 件あります`;
		super(summary);
		this.name = 'WriterPipelineError';
		this.diagnostics = visible;
	}

	/**
	 * HTTP / GUI 向けの issue 配列にする
	 */
	toIssues(): WriterPipelineIssue[] {
		return this.diagnostics.map((diagnostic) => ({
			path: diagnostic.pointer ?? diagnostic.stepId,
			message: `[${diagnostic.severity}] ${diagnostic.stepId}: ${diagnostic.message}`
		}));
	}
}
