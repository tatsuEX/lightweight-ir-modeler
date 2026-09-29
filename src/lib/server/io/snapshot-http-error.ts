import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';
import {
	IrSnapshotMigrationConsentError,
	IrSnapshotSchemaVersionError
} from '$lib/ir/snapshot-migration';

/**
 * schemaVersion エラーを HTTP ステータスとペイロードにする（該当しなければ null）
 */
export function toSnapshotSchemaBlock(
	error: unknown
): { status: number; block: SnapshotSchemaBlock } | null {
	if (error instanceof IrSnapshotSchemaVersionError) {
		const code =
			error.kind === 'future'
				? 'schema-future'
				: error.kind === 'no-path'
					? 'schema-no-path'
					: 'schema-unreadable';
		return {
			status: error.kind === 'future' ? 409 : 400,
			block: {
				error: error.message,
				code,
				schemaVersion: error.schemaVersion,
				latest: error.latest,
				rationales: []
			}
		};
	}

	if (error instanceof IrSnapshotMigrationConsentError) {
		return {
			status: 409,
			block: {
				error: error.message,
				code: 'schema-consent',
				schemaVersion: error.schemaVersion,
				latest: error.latest,
				rationales: [...error.rationales]
			}
		};
	}

	return null;
}
