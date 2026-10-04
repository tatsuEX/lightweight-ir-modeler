import type { MutateContext } from '$lib/server/writer-pipeline/mutate-context';
import type { WriterPipelineStep } from '$lib/server/writer-pipeline/writer-pipeline-step';

/**
 * step を配列の順に実行する
 *
 * 空配列は何もしない。error を出した step は WriterPipelineError で止まる。
 */
export function runWriterPipeline(steps: readonly WriterPipelineStep[], ctx: MutateContext): void {
	for (const step of steps) {
		step.run(ctx);
	}
}
