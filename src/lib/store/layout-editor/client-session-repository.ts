/**
 * ブラウザタブの client session をキーで保持する
 *
 * 中身はメモリ Map。呼び出し側は acquire / rekey / evictExpired だけを使う。
 * 将来サーバへ移すときも、この操作とキー型は変えない。
 */

/**
 * 編集セッションの照合キー
 *
 * sessionId はタブ（将来は利用者）の隔離境界。logicalId と version は画面定義。
 */
export type ClientSessionKey = {
	sessionId: string;
	logicalId: string;
	version: string;
};

/**
 * Map に置く 1 件
 */
export type ClientSessionRecord<T> = {
	key: ClientSessionKey;
	value: T;
	createdAt: number;
};

/**
 * Vite HMR がモジュールを再評価しても Map を残すための最小面
 */
export type ClientSessionHot = {
	data: Record<string, unknown>;
};

/**
 * キーを Map の索引にする
 *
 * WARN: 区切り文字の連結は logicalId に同じ文字が含まれると衝突する。JSON 配列でフィールド境界を固定する。
 */
export function clientSessionMapKey(key: ClientSessionKey): string {
	return JSON.stringify([key.sessionId, key.logicalId, key.version]);
}

/**
 * 二つのキーが同じ索引か判定する
 */
export function clientSessionKeysEqual(left: ClientSessionKey, right: ClientSessionKey): boolean {
	return (
		left.sessionId === right.sessionId &&
		left.logicalId === right.logicalId &&
		left.version === right.version
	);
}

/**
 * HMR 用 data に入っている Map を再利用する。無ければ fallback を登録する
 */
export function adoptHotEntries<T>(
	fallback: Map<string, ClientSessionRecord<T>>,
	hot: ClientSessionHot | undefined
): Map<string, ClientSessionRecord<T>> {
	if (!hot) {
		return fallback;
	}
	const saved = hot.data.entries;
	const entries = saved instanceof Map ? (saved as Map<string, ClientSessionRecord<T>>) : fallback;
	hot.data.entries = entries;
	return entries;
}

/**
 * TTL 付きの client session 置き場
 */
export class ClientSessionRepository<T> {
	#entries: Map<string, ClientSessionRecord<T>>;
	#maxLifetimeMs = 0;
	#now: () => number;

	/**
	 * 空の置き場、または既存 Map を包む
	 */
	constructor(options: {
		maxLifetimeMs: number;
		now?: () => number;
		entries?: Map<string, ClientSessionRecord<T>>;
	}) {
		this.#entries = options.entries ?? new Map();
		this.#now = options.now ?? (() => Date.now());
		this.configure(options.maxLifetimeMs);
	}

	/**
	 * 保持期限（ms）を更新する。既存エントリの createdAt は変えない
	 */
	configure(maxLifetimeMs: number): void {
		if (!Number.isFinite(maxLifetimeMs) || maxLifetimeMs < 0) {
			throw new Error('client session maxLifetimeMs must be a non-negative finite number');
		}
		this.#maxLifetimeMs = maxLifetimeMs;
	}

	/**
	 * 現在の保持期限（ms）を返す
	 */
	get maxLifetimeMs(): number {
		return this.#maxLifetimeMs;
	}

	/**
	 * 登録件数を返す（期限切れも含む。テストと破棄前の確認用）
	 */
	size(): number {
		return this.#entries.size;
	}

	/**
	 * createdAt から保持期限を過ぎているか判定する
	 */
	isExpired(record: ClientSessionRecord<T>, now: number = this.#now()): boolean {
		return now >= record.createdAt + this.#maxLifetimeMs;
	}

	/**
	 * キーのエントリを返す。期限切れなら破棄して undefined
	 */
	peek(key: ClientSessionKey): T | undefined {
		this.#evictKey(key);
		return this.#entries.get(clientSessionMapKey(key))?.value;
	}

	/**
	 * キーが無ければ create して登録し、あればそれを返す
	 */
	acquire(key: ClientSessionKey, create: () => T): { record: ClientSessionRecord<T>; created: boolean } {
		this.#evictKey(key);
		const id = clientSessionMapKey(key);
		const existing = this.#entries.get(id);
		if (existing) {
			return { record: existing, created: false };
		}

		const record: ClientSessionRecord<T> = {
			key: { ...key },
			value: create(),
			createdAt: this.#now()
		};
		this.#entries.set(id, record);
		return { record, created: true };
	}

	/**
	 * エントリを別キーへ移す。値と createdAt は維持する
	 *
	 * WARN: sessionId は隔離境界なので付け替えない。移動先が生きていれば失敗する。
	 */
	rekey(from: ClientSessionKey, to: ClientSessionKey): ClientSessionRecord<T> {
		if (from.sessionId !== to.sessionId) {
			throw new Error('client session rekey cannot change sessionId');
		}

		this.#evictKey(from);
		const fromId = clientSessionMapKey(from);
		const record = this.#entries.get(fromId);
		if (!record) {
			throw new Error('client session rekey source is missing');
		}

		if (clientSessionKeysEqual(from, to)) {
			record.key = { ...to };
			return record;
		}

		this.#evictKey(to);
		const toId = clientSessionMapKey(to);
		if (this.#entries.has(toId)) {
			throw new Error('client session rekey destination is occupied');
		}

		this.#entries.delete(fromId);
		record.key = { ...to };
		this.#entries.set(toId, record);
		return record;
	}

	/**
	 * 期限切れをすべて破棄し、破棄件数を返す
	 */
	evictExpired(): number {
		let removed = 0;
		for (const [id, record] of this.#entries) {
			if (this.isExpired(record)) {
				this.#entries.delete(id);
				removed += 1;
			}
		}
		return removed;
	}

	/**
	 * 指定キーが期限切れなら 1 件破棄する
	 */
	#evictKey(key: ClientSessionKey): void {
		const id = clientSessionMapKey(key);
		const record = this.#entries.get(id);
		if (record && this.isExpired(record)) {
			this.#entries.delete(id);
		}
	}
}
