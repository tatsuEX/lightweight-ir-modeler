/**
 * snapshot の schemaVersion を読めないときの共有ペイロード
 *
 * HTTP ステータスはサーバが付ける。ここは GUI と route が同じ形を読むための本体。
 */

/** 失敗の種別 */
export type SnapshotSchemaBlockCode =
	| 'schema-future'
	| 'schema-unreadable'
	| 'schema-no-path'
	| 'schema-consent';

/** schemaVersion を進められない理由 */
export type SnapshotSchemaBlock = {
	error: string;
	code: SnapshotSchemaBlockCode;
	schemaVersion: string;
	latest: string;
	rationales: string[];
};
