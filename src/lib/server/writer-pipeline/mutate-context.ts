import { deepCopy } from '$lib/utils/object-utils';
import type { RawDefinition } from '$lib/raw/raw-definition';
import {
	escapeJsonPointerToken,
	parseJsonPointer,
	setJsonPointer
} from '$lib/server/writer-pipeline/json-pointer';
import type {
	WriterPipelineDiagnostic,
	WriterPipelineMutation
} from '$lib/server/writer-pipeline/types';

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * ログ用に値を複製する。undefined はそのまま
 */
function copyLoggedValue(value: unknown): unknown {
	if (value === undefined) {
		return undefined;
	}
	return deepCopy(value);
}

/**
 * writer pipeline の作業 context
 *
 * WARN: sourceRaw は複製して保持する。呼び出し元の Raw と snapshot には書かない。
 * WARN: `/itemsByLogicalId/...` は data ではなく索引を指す。serialize 対象に含めない。
 */
export class MutateContext {
	readonly sourceRaw: RawDefinition;
	data: Record<string, unknown>;
	readonly itemsByLogicalId: Record<string, Record<string, unknown>> = Object.create(null);
	readonly mutations: WriterPipelineMutation[] = [];
	readonly diagnostics: WriterPipelineDiagnostic[] = [];
	readonly passedSteps: string[] = [];
	private readonly mutationByPointer = new Map<string, WriterPipelineMutation>();
	private currentStepId = '';

	/**
	 * 入力 Raw の複製と、空の作業文書で context を作る
	 */
	constructor(sourceRaw: RawDefinition, initialData: Record<string, unknown> = {}) {
		this.sourceRaw = deepCopy(sourceRaw);
		this.data = deepCopy(initialData);
	}

	/**
	 * 実行中 step の id を固定する
	 */
	enterStep(stepId: string): void {
		this.currentStepId = stepId;
	}

	/**
	 * 実行中 step の id を外す
	 */
	leaveStep(): void {
		this.currentStepId = '';
	}

	/**
	 * warn diagnostic を足す。pipeline は止めない
	 */
	warn(message: string, pointer?: string): void {
		this.diagnostics.push({
			stepId: this.currentStepId,
			severity: 'warn',
			message,
			...(pointer === undefined ? {} : { pointer })
		});
	}

	/**
	 * error diagnostic を足す。中断は step の run が行う
	 */
	error(message: string, pointer?: string): void {
		this.diagnostics.push({
			stepId: this.currentStepId,
			severity: 'error',
			message,
			...(pointer === undefined ? {} : { pointer })
		});
	}

	/**
	 * pointer の値を置き換え、同一 pointer の mutation を 1 件に畳む
	 *
	 * 空 pointer は作業文書全体の差し替え。索引キーの新規作成は `/itemsByLogicalId/{key}`。
	 */
	mutate(pointer: string, value: unknown, reason: string): void {
		const tokens = parseJsonPointer(pointer);
		if (tokens.length === 0) {
			if (!isPlainObject(value)) {
				throw new Error('writer pipeline document root must be a plain object');
			}
			const before = this.data;
			this.data = value;
			this.upsertMutation(pointer, before, value, reason);
			return;
		}

		if (tokens[0] === 'itemsByLogicalId') {
			this.mutateItemIndex(tokens.slice(1), value, pointer, reason);
			return;
		}

		const before = setJsonPointer(this.data, pointer, value);
		this.upsertMutation(pointer, before, value, reason);
	}

	/**
	 * logicalId 索引を更新する
	 */
	private mutateItemIndex(
		tokens: readonly string[],
		value: unknown,
		pointer: string,
		reason: string
	): void {
		if (tokens.length === 0) {
			throw new Error('itemsByLogicalId root cannot be replaced');
		}

		const key = tokens[0];
		if (tokens.length === 1) {
			if (!isPlainObject(value)) {
				throw new Error('itemsByLogicalId entry must be a plain object');
			}
			const before = this.itemsByLogicalId[key];
			this.itemsByLogicalId[key] = value;
			this.upsertMutation(pointer, before, value, reason);
			return;
		}

		const item = this.itemsByLogicalId[key];
		if (!isPlainObject(item)) {
			throw new Error(
				`itemsByLogicalId entry missing: ${escapeJsonPointerToken(key)}`
			);
		}
		const nested = `/${tokens
			.slice(1)
			.map((token) => escapeJsonPointerToken(token))
			.join('/')}`;
		const before = setJsonPointer(item, nested, value);
		this.upsertMutation(pointer, before, value, reason);
	}

	/**
	 * 同一 pointer なら after と reason だけを最終値へ更新する
	 */
	private upsertMutation(pointer: string, before: unknown, after: unknown, reason: string): void {
		const loggedAfter = copyLoggedValue(after);
		const existing = this.mutationByPointer.get(pointer);
		if (existing) {
			existing.after = loggedAfter;
			existing.reason = reason;
			return;
		}

		const mutation: WriterPipelineMutation = {
			pointer,
			before: copyLoggedValue(before),
			after: loggedAfter,
			reason
		};
		this.mutations.push(mutation);
		this.mutationByPointer.set(pointer, mutation);
	}
}
