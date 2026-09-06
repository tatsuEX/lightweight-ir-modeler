/**
 * UI IR 定義の構造 schema version（`<main>.<sub>`）
 *
 * WARN: 画面定義の製品版（`uiDefinition.version` / `versions/<v>/`）とは別概念。
 * `snapshot-version.ts` の parse / compare / path 検証を流用しない。製品版の関数を借りると
 * 「ユーザ意図の版」と「構造の版」が code 上で融合する。
 */

/** schema version の内部表現 */
export type IrSchemaVersion = {
	main: number;
	sub: number;
};

/** 現行ビルドが読み書きする schema version */
export const CURRENT_IR_SCHEMA_VERSION = '1.0';

/**
 * `schemaVersion` キーを持たない snapshot に適用する既定値
 *
 * WARN: envelope `version: 1` 時代の既存資産はこの値として読む。migration step ではなく
 * parse の既定値で処理するため、既存資産向けの step は不要。
 */
export const BASELINE_IR_SCHEMA_VERSION = '1.0';

const IR_SCHEMA_VERSION_PATTERN = /^(\d+)\.(\d+)$/;

/**
 * schema version 文字列を main / sub へ分解する（不正なら null）
 */
export function parseIrSchemaVersion(value: string): IrSchemaVersion | null {
	const matched = IR_SCHEMA_VERSION_PATTERN.exec(value.trim());
	if (!matched) {
		return null;
	}

	return { main: Number(matched[1]), sub: Number(matched[2]) };
}

/**
 * main / sub を schema version 文字列にする
 */
export function formatIrSchemaVersion(version: IrSchemaVersion): string {
	return `${version.main}.${version.sub}`;
}

/**
 * schema version として妥当か判定する
 */
export function isValidIrSchemaVersion(value: string): boolean {
	return parseIrSchemaVersion(value) !== null;
}

/**
 * schema version を比較する（main 優先、同 main なら sub）
 */
export function compareIrSchemaVersions(left: IrSchemaVersion, right: IrSchemaVersion): number {
	if (left.main !== right.main) {
		return left.main - right.main;
	}

	return left.sub - right.sub;
}

/**
 * 読み込んだ snapshot の schema version 分類
 *
 * - `unreadable`: `schemaVersion` が `<main>.<sub>` として解釈できない
 * - `future`: snapshot が現行ビルドより新しい（読まない / 書かない）
 * - `current`: 一致（schemaVersion に関する処理は不要）
 * - `auto-migratable`: main 同一で sub が古い（自動 migration 可）
 * - `consent-required`: main が古い（破壊的。ユーザー同意が必要）
 */
export type IrSchemaVersionClassification =
	| { kind: 'unreadable'; schemaVersion: string; latest: string }
	| { kind: 'future'; schemaVersion: string; latest: string }
	| { kind: 'current'; schemaVersion: string; latest: string }
	| { kind: 'auto-migratable'; schemaVersion: string; latest: string }
	| { kind: 'consent-required'; schemaVersion: string; latest: string };

/**
 * snapshot の schema version を現行ビルドと比較して分類する
 */
export function classifyIrSchemaVersion(
	schemaVersion: string,
	latest: string = CURRENT_IR_SCHEMA_VERSION
): IrSchemaVersionClassification {
	const parsed = parseIrSchemaVersion(schemaVersion);
	const parsedLatest = parseIrSchemaVersion(latest);

	if (!parsed || !parsedLatest) {
		return { kind: 'unreadable', schemaVersion, latest };
	}

	const order = compareIrSchemaVersions(parsed, parsedLatest);

	if (order > 0) {
		return { kind: 'future', schemaVersion, latest };
	}
	if (order === 0) {
		return { kind: 'current', schemaVersion, latest };
	}
	if (parsed.main === parsedLatest.main) {
		return { kind: 'auto-migratable', schemaVersion, latest };
	}

	return { kind: 'consent-required', schemaVersion, latest };
}
