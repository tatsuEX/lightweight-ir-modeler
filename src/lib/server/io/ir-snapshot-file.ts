import { existsSync, readFileSync } from 'node:fs';
import { restoreIrSnapshotFromYaml, type RestoredIrSnapshot } from '$lib/ir/snapshot';

export type { RestoredIrSnapshot };

/**
 * 任意パスの YAML ファイルから IR snapshot を復元する
 *
 * WARN: autoSave 世代管理（`ir-snapshot-io.ts`）とは別経路。`$env` は使わない。
 */
export function loadRestoredIrSnapshotFile(filePath: string): RestoredIrSnapshot {
	if (!existsSync(filePath)) {
		throw new Error(`IR snapshot not found: ${filePath}`);
	}

	return restoreIrSnapshotFromYaml(readFileSync(filePath, 'utf8'));
}
