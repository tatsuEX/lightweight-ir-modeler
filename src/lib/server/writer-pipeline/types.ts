import type { RawDefinition } from '$lib/raw/raw-definition';

/**
 * writer pipeline が記録する 1 件の変更
 *
 * 同一 pointer は 1 件に畳む。before は最初の値、after と reason は最終更新。
 */
export type WriterPipelineMutation = {
	pointer: string;
	before: unknown;
	after: unknown;
	reason: string;
};

/**
 * writer pipeline の診断
 */
export type WriterPipelineDiagnostic = {
	stepId: string;
	severity: 'warn' | 'error';
	message: string;
	pointer?: string;
};

/**
 * step から見える作業状態
 *
 * sourceRaw は読み取り専用の入力。data は target の作業文書。
 * itemsByLogicalId は作業文書へ載せない索引で、値は item_list と同一参照にできる。
 */
export type WriterPipelineState = {
	readonly sourceRaw: RawDefinition;
	data: Record<string, unknown>;
	readonly itemsByLogicalId: Record<string, Record<string, unknown>>;
	readonly mutations: readonly WriterPipelineMutation[];
	readonly diagnostics: readonly WriterPipelineDiagnostic[];
	readonly passedSteps: readonly string[];
};
