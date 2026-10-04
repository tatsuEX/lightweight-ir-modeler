import { MutateContext } from '$lib/server/writer-pipeline/mutate-context';
import { WriterPipelineError } from '$lib/server/writer-pipeline/writer-pipeline-error';

/**
 * writer pipeline の 1 step
 *
 * 正常終了時だけ passed steps へ自分の id を足す。projection とは継承関係を持たない。
 */
export abstract class WriterPipelineStep {
	/**
	 * namespace 付きの step id
	 */
	abstract get id(): string;

	/**
	 * 先に成功している必要がある step id
	 */
	get requires(): readonly string[] {
		return [];
	}

	/**
	 * step 本体。文書の変更は context.mutate だけが行う
	 */
	protected abstract apply(ctx: MutateContext): void;

	/**
	 * 前提を確認し、apply のあと id を passed steps へ足す
	 *
	 * WARN: apply が例外を出したら id は足さない。error diagnostic が残ったときも足さない。
	 */
	run(ctx: MutateContext): void {
		for (const requiredId of this.requires) {
			if (!ctx.passedSteps.includes(requiredId)) {
				ctx.enterStep(this.id);
				ctx.error(`前提 step が未完了です: ${requiredId}`);
				ctx.leaveStep();
				throw new WriterPipelineError(ctx.diagnostics);
			}
		}

		ctx.enterStep(this.id);
		try {
			this.apply(ctx);
		} catch (error) {
			if (error instanceof WriterPipelineError) {
				throw error;
			}
			ctx.error(error instanceof Error ? error.message : String(error));
			throw new WriterPipelineError(ctx.diagnostics);
		} finally {
			ctx.leaveStep();
		}

		if (ctx.diagnostics.some((diagnostic) => diagnostic.stepId === this.id && diagnostic.severity === 'error')) {
			throw new WriterPipelineError(ctx.diagnostics);
		}

		ctx.passedSteps.push(this.id);
	}
}
