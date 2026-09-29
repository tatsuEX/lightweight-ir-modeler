/**
 * IR snapshot の schema migration
 *
 * WARN: step は Domain 型を一切 import しない plain record 関数。これが「Domain Model へ
 * 過去 schema の知識を持ち込まない」を構造的に保証する。`<schemaVersion>/` 配下に Domain の
 * コピーを置かないこと。
 *
 * WARN: component `id` は書き込み時に strip され読み込み時に再生成されるため、`id` を参照
 * する step は書けない。step は位置・構造ベースで書く。
 */

import {
	BASELINE_IR_SCHEMA_VERSION,
	classifyIrSchemaVersion,
	CURRENT_IR_SCHEMA_VERSION,
	parseIrSchemaVersion,
	type IrSchemaVersionClassification
} from '$lib/ir/snapshot-schema-version';

/**
 * schema version を 1 段上げる migration
 */
export type IrSnapshotMigrationStep = {
	/** 変換元 schema version（`<main>.<sub>`） */
	from: string;
	/** 変換先 schema version（`<main>.<sub>`） */
	to: string;
	/** 採番の判断根拠（なぜ main を上げたか / なぜ sub に留めたか）。同意ダイアログの文面にも使う */
	rationale: string;
	migrate: (record: Record<string, unknown>) => Record<string, unknown>;
};

/**
 * 登録済み migration step（`from` 昇順）
 *
 * WARN: 現行 schema は `1.0` のみなので空。schema を変えるときにここへ 1 本足す。
 * main をまたぐ step は `consent-required` として扱われる（同意可否は main 差分から導出）。
 */
export const IR_SNAPSHOT_MIGRATION_STEPS: readonly IrSnapshotMigrationStep[] = [];

/**
 * snapshot の schema version が現行ビルドで扱えないときのエラー
 */
export class IrSnapshotSchemaVersionError extends Error {
	readonly schemaVersion: string;
	readonly latest: string;
	readonly kind: 'unreadable' | 'future' | 'no-path';

	/**
	 * 扱えない schema version のエラーを作る
	 */
	constructor(kind: 'unreadable' | 'future' | 'no-path', schemaVersion: string, latest: string) {
		super(IrSnapshotSchemaVersionError.buildMessage(kind, schemaVersion, latest));
		this.name = 'IrSnapshotSchemaVersionError';
		this.kind = kind;
		this.schemaVersion = schemaVersion;
		this.latest = latest;
	}

	/**
	 * 種別ごとのメッセージを組み立てる
	 */
	private static buildMessage(kind: string, schemaVersion: string, latest: string): string {
		if (kind === 'future') {
			return `IR snapshot schemaVersion ${schemaVersion} is newer than this build (${latest})`;
		}
		if (kind === 'no-path') {
			return `no migration path from IR snapshot schemaVersion ${schemaVersion} to ${latest}`;
		}

		return `invalid IR snapshot schemaVersion: ${schemaVersion}`;
	}
}

/**
 * main をまたぐ migration にユーザー同意が無いときのエラー
 */
export class IrSnapshotMigrationConsentError extends Error {
	readonly schemaVersion: string;
	readonly latest: string;
	/** 同意確認で提示する step ごとの判断根拠 */
	readonly rationales: readonly string[];

	/**
	 * 同意が必要な migration のエラーを作る
	 */
	constructor(schemaVersion: string, latest: string, rationales: readonly string[]) {
		super(
			`IR snapshot migration ${schemaVersion} → ${latest} changes structure destructively and requires explicit consent`
		);
		this.name = 'IrSnapshotMigrationConsentError';
		this.schemaVersion = schemaVersion;
		this.latest = latest;
		this.rationales = rationales;
	}
}

/**
 * migration の呼び出しオプション
 */
export type IrSnapshotMigrationOptions = {
	/** main をまたぐ migration をユーザーが承認済みか */
	confirmMigration?: boolean;
	/** 変換先 schema version（既定は現行ビルド） */
	latest?: string;
	/**
	 * step 列の差し替え（テスト・検証用の escape hatch）
	 *
	 * WARN: 通常経路では指定しない。既定の `IR_SNAPSHOT_MIGRATION_STEPS` が唯一の登録先。
	 */
	steps?: readonly IrSnapshotMigrationStep[];
};

/**
 * migration の適用結果
 */
export type IrSnapshotMigrationResult = {
	record: Record<string, unknown>;
	/** 適用前の schema version（キー不在時は baseline） */
	from: string;
	/** 適用後の schema version */
	to: string;
	/** 適用した step の `from → to` 表現 */
	applied: readonly string[];
};

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * record の `schemaVersion` を読む（キー不在・非文字列は baseline）
 *
 * WARN: envelope `version: 1` 時代のファイルは `schemaVersion` を持たない。
 */
export function readRecordSchemaVersion(record: Record<string, unknown>): string {
	const value = record.schemaVersion;
	if (typeof value !== 'string' || value.trim() === '') {
		return BASELINE_IR_SCHEMA_VERSION;
	}

	return value.trim();
}

/**
 * 未使用の root `version` を落とし、`schemaVersion` を明示する
 *
 * WARN: root の `version` のみ対象。`uiDefinition.version`（画面定義の製品版）は触らない。
 */
function normalizeEnvelopeKeys(
	record: Record<string, unknown>,
	schemaVersion: string
): Record<string, unknown> {
	const normalized: Record<string, unknown> = { ...record, schemaVersion };
	delete normalized.version;

	return normalized;
}

/**
 * `from` から `latest` までの step 列を解決する
 */
function resolveStepChain(
	from: string,
	latest: string,
	steps: readonly IrSnapshotMigrationStep[]
): IrSnapshotMigrationStep[] {
	const chain: IrSnapshotMigrationStep[] = [];
	let cursor = from;

	while (cursor !== latest) {
		const next = steps.find((step) => step.from === cursor);
		if (!next) {
			throw new IrSnapshotSchemaVersionError('no-path', from, latest);
		}

		chain.push(next);
		cursor = next.to;
	}

	return chain;
}

/**
 * main をまたぐ step の判断根拠を集める
 */
function collectConsentRationales(chain: readonly IrSnapshotMigrationStep[]): string[] {
	const rationales: string[] = [];

	for (const step of chain) {
		const from = parseIrSchemaVersion(step.from);
		const to = parseIrSchemaVersion(step.to);
		if (from && to && from.main !== to.main) {
			rationales.push(step.rationale);
		}
	}

	return rationales;
}

/**
 * snapshot record を現行 schema へ migration する
 *
 * 呼び出し側は分類・step 解決・適用順を知らない。`schemaVersion` キー不在は baseline として扱う。
 *
 * WARN: `future`（現行ビルドより新しい）は migration ではなく明確な失敗。書き込んではいけない。
 */
export function migrateIrSnapshotRecord(
	value: unknown,
	options: IrSnapshotMigrationOptions = {}
): IrSnapshotMigrationResult {
	const latest = options.latest ?? CURRENT_IR_SCHEMA_VERSION;

	if (!isPlainObject(value)) {
		// WARN: envelope 形状のエラーは parseIrSnapshot に任せる（メッセージを一箇所に保つ）。
		return { record: value as Record<string, unknown>, from: latest, to: latest, applied: [] };
	}

	const from = readRecordSchemaVersion(value);
	const classification: IrSchemaVersionClassification = classifyIrSchemaVersion(from, latest);

	if (classification.kind === 'unreadable' || classification.kind === 'future') {
		throw new IrSnapshotSchemaVersionError(classification.kind, from, latest);
	}

	if (classification.kind === 'current') {
		return { record: normalizeEnvelopeKeys(value, latest), from, to: latest, applied: [] };
	}

	// WARN: 先に経路を解決する。実行できない migration の同意をユーザーに求めない。
	const chain = resolveStepChain(from, latest, options.steps ?? IR_SNAPSHOT_MIGRATION_STEPS);

	if (classification.kind === 'consent-required' && !options.confirmMigration) {
		throw new IrSnapshotMigrationConsentError(from, latest, collectConsentRationales(chain));
	}

	let record: Record<string, unknown> = { ...value };
	const applied: string[] = [];

	for (const step of chain) {
		record = step.migrate(record);
		applied.push(`${step.from} → ${step.to}`);
	}

	return { record: normalizeEnvelopeKeys(record, latest), from, to: latest, applied };
}
