/**
 * タブ単位の client session id
 *
 * sessionStorage に ID だけを置く。編集中の UI IR は保存しない。
 */

import { nanoid } from 'nanoid';

/** sessionStorage 上のキー */
export const CLIENT_SESSION_ID_STORAGE_KEY = 'layout-editor.clientSessionId';

/**
 * ID の読み書きに使う最小ストレージ
 */
export type ClientSessionIdStorage = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
};

/**
 * 保存済みの sessionId を返す。無ければ createId で発行して保存する
 */
export function readOrCreateClientSessionId(
	storage: ClientSessionIdStorage,
	createId: () => string = () => nanoid()
): string {
	const existing = storage.getItem(CLIENT_SESSION_ID_STORAGE_KEY);
	if (existing !== null && existing.trim() !== '') {
		return existing;
	}

	const created = createId();
	storage.setItem(CLIENT_SESSION_ID_STORAGE_KEY, created);
	return created;
}
