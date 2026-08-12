/**
 * 未使用画面 ID（新規 snapshot ディレクトリ）確認ダイアログ用のクライアント補助
 *
 * WARN: 「次回以降確認しない」はブラウザ localStorage に保存する（application.yml は書き換えない）。
 */

/** localStorage キー（値が '1' のとき確認を出さない） */
export const SKIP_CONFIRM_SNAPSHOT_DIR_STORAGE_KEY =
	'layout-editor.skipConfirmSnapshotDirCreation';

/**
 * ユーザが「次回以降確認しない」を選済みか判定する
 */
export function isSnapshotDirConfirmSkippedByUser(): boolean {
	if (typeof localStorage === 'undefined') {
		return false;
	}
	return localStorage.getItem(SKIP_CONFIRM_SNAPSHOT_DIR_STORAGE_KEY) === '1';
}

/**
 * 「次回以降確認しない」をブラウザに保存する
 */
export function setSnapshotDirConfirmSkippedByUser(skip: boolean): void {
	if (typeof localStorage === 'undefined') {
		return;
	}
	if (skip) {
		localStorage.setItem(SKIP_CONFIRM_SNAPSHOT_DIR_STORAGE_KEY, '1');
		return;
	}
	localStorage.removeItem(SKIP_CONFIRM_SNAPSHOT_DIR_STORAGE_KEY);
}

/**
 * 設定とユーザ選択から、確認ダイアログを出すべきか判定する
 */
export function shouldPromptNewSnapshotDir(confirmSnapshotDirCreation: boolean): boolean {
	return confirmSnapshotDirCreation && !isSnapshotDirConfirmSkippedByUser();
}

/**
 * 指定画面 ID の snapshot ディレクトリ（最新世代）が既にあるか問い合わせる
 */
export async function snapshotDirectoryExists(logicalId: string): Promise<boolean> {
	const response = await fetch(`/api/ir/snapshot?logicalId=${encodeURIComponent(logicalId)}`);
	if (response.status === 404) {
		return false;
	}
	if (!response.ok) {
		throw new Error(`snapshot existence check failed: ${response.status}`);
	}
	return true;
}
