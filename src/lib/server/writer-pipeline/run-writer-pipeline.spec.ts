import { describe, expect, it } from 'vitest';
import { MutateContext } from '$lib/server/writer-pipeline/mutate-context';
import { runWriterPipeline } from '$lib/server/writer-pipeline/run-writer-pipeline';
import { WriterPipelineError } from '$lib/server/writer-pipeline/writer-pipeline-error';
import { WriterPipelineStep } from '$lib/server/writer-pipeline/writer-pipeline-step';
import {
	escapeJsonPointerToken,
	getJsonPointer,
	parseJsonPointer,
	setJsonPointer
} from '$lib/server/writer-pipeline/json-pointer';

/**
 * テスト用の固定 step
 */
class NamedStep extends WriterPipelineStep {
	/**
	 * id と前提と本体を受け取る
	 */
	constructor(
		readonly stepId: string,
		private readonly requiredIds: readonly string[],
		private readonly body: (ctx: MutateContext) => void
	) {
		super();
	}

	/**
	 * テストが指定した id
	 */
	get id(): string {
		return this.stepId;
	}

	/**
	 * テストが指定した前提
	 */
	override get requires(): readonly string[] {
		return this.requiredIds;
	}

	/**
	 * テスト本体を実行する
	 */
	protected apply(ctx: MutateContext): void {
		this.body(ctx);
	}
}

describe('json pointer', () => {
	it('escapes ~ and / and reads them back', () => {
		expect(escapeJsonPointerToken('a/b~c')).toBe('a~1b~0c');
		expect(parseJsonPointer('/a~1b~0c')).toEqual(['a/b~c']);
		expect(parseJsonPointer('/itemsByLogicalId/~00')).toEqual(['itemsByLogicalId', '~0']);
	});

	it('sets a nested value and returns the previous one', () => {
		const root = { items: { name: { label: 'old' } } };
		const before = setJsonPointer(root, '/items/name/label', 'new');
		expect(before).toBe('old');
		expect(getJsonPointer(root, '/items/name/label')).toBe('new');
	});

	it('throws when a parent is missing', () => {
		expect(() => setJsonPointer({}, '/items/name/label', 'x')).toThrow(/parent missing/);
	});
});

describe('MutateContext', () => {
	it('collapses repeated writes to the same pointer and keeps the first before', () => {
		const ctx = new MutateContext({ items: { fieldA: { label: 'a' } } });
		ctx.mutate('', { items: { fieldA: { label: 'a' } } }, 'bootstrap');
		ctx.mutate('/items/fieldA/label', 'b', 'first');
		ctx.mutate('/items/fieldA/label', 'c', 'second');

		expect(ctx.mutations).toHaveLength(2);
		expect(ctx.mutations[1]).toMatchObject({
			pointer: '/items/fieldA/label',
			before: 'a',
			after: 'c',
			reason: 'second'
		});
		expect(ctx.data).toEqual({ items: { fieldA: { label: 'c' } } });
	});

	it('stores logicalId entries outside the serialized document', () => {
		const ctx = new MutateContext({});
		ctx.mutate('', { item_list: [] }, 'bootstrap');
		ctx.mutate('/itemsByLogicalId/fieldA', { item_id: 'aaaa' }, 'resolve');
		ctx.mutate('/item_list', [ctx.itemsByLogicalId.fieldA], 'assemble');

		expect(ctx.data).toEqual({ item_list: [{ item_id: 'aaaa' }] });
		expect(ctx.data).not.toHaveProperty('itemsByLogicalId');
		expect(ctx.data.item_list).toEqual([ctx.itemsByLogicalId.fieldA]);
	});

	it('does not share the source raw with the caller', () => {
		const raw = { name: 'before' };
		const ctx = new MutateContext(raw);
		ctx.sourceRaw.name = 'after';
		expect(raw.name).toBe('before');
	});
});

describe('runWriterPipeline', () => {
	it('records passed steps in order', () => {
		const ctx = new MutateContext({});
		runWriterPipeline(
			[
				new NamedStep('example-target/bootstrap', [], (context) => {
					context.mutate('', { ok: true }, 'bootstrap');
				}),
				new NamedStep('example-target/resolve', ['example-target/bootstrap'], (context) => {
					context.warn('note');
				})
			],
			ctx
		);

		expect(ctx.passedSteps).toEqual(['example-target/bootstrap', 'example-target/resolve']);
		expect(ctx.diagnostics).toEqual([
			{ stepId: 'example-target/resolve', severity: 'warn', message: 'note' }
		]);
	});

	it('stops when a required step has not passed and does not run later steps', () => {
		const ctx = new MutateContext({});
		let later = false;
		expect(() =>
			runWriterPipeline(
				[
					new NamedStep('example-target/resolve', ['example-target/bootstrap'], () => undefined),
					new NamedStep('example-target/later', [], () => {
						later = true;
					})
				],
				ctx
			)
		).toThrow(WriterPipelineError);

		expect(later).toBe(false);
		expect(ctx.passedSteps).toEqual([]);
		expect(ctx.diagnostics[0]).toMatchObject({
			stepId: 'example-target/resolve',
			severity: 'error'
		});
	});

	it('stops on a thrown error and keeps the diagnostic', () => {
		const ctx = new MutateContext({});
		expect(() =>
			runWriterPipeline(
				[
					new NamedStep('example-target/bootstrap', [], () => {
						throw new Error('broken pointer');
					})
				],
				ctx
			)
		).toThrow(WriterPipelineError);

		expect(ctx.passedSteps).toEqual([]);
		expect(ctx.diagnostics).toEqual([
			{ stepId: 'example-target/bootstrap', severity: 'error', message: 'broken pointer' }
		]);
	});

	it('stops when the step records an error diagnostic', () => {
		const ctx = new MutateContext({});
		try {
			runWriterPipeline(
				[
					new NamedStep('example-target/bootstrap', [], (context) => {
						context.error('fatal', '/item_list');
					})
				],
				ctx
			);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(WriterPipelineError);
			expect((error as WriterPipelineError).toIssues()).toEqual([
				{
					path: '/item_list',
					message: '[error] example-target/bootstrap: fatal'
				}
			]);
		}
		expect(ctx.passedSteps).toEqual([]);
	});
});
