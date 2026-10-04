/**
 * RFC 6901 の JSON Pointer を読む・書く
 *
 * WARN: 空文字は文書全体。トークンの unescape は `~1` を先に、`~0` を後に行う。
 */

/**
 * JSON Pointer の 1 トークンをエスケープする
 */
export function escapeJsonPointerToken(token: string): string {
	return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * JSON Pointer をトークン配列にする
 */
export function parseJsonPointer(pointer: string): string[] {
	if (pointer === '') {
		return [];
	}
	if (!pointer.startsWith('/')) {
		throw new Error(`JSON Pointer must be empty or start with /: ${pointer}`);
	}

	return pointer
		.slice(1)
		.split('/')
		.map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * トークン配列から JSON Pointer を組む
 */
export function joinJsonPointer(tokens: readonly string[]): string {
	if (tokens.length === 0) {
		return '';
	}
	return `/${tokens.map((token) => escapeJsonPointerToken(token)).join('/')}`;
}

/**
 * 親オブジェクトまたは配列から子を読む。無いときは undefined
 */
function readChild(parent: unknown, token: string): unknown {
	if (Array.isArray(parent)) {
		if (!/^(0|[1-9][0-9]*)$/.test(token)) {
			return undefined;
		}
		return parent[Number(token)];
	}
	if (parent !== null && typeof parent === 'object') {
		return (parent as Record<string, unknown>)[token];
	}
	return undefined;
}

/**
 * 親オブジェクトまたは配列へ子を書く
 */
function writeChild(parent: unknown, token: string, value: unknown): void {
	if (Array.isArray(parent)) {
		if (!/^(0|[1-9][0-9]*)$/.test(token)) {
			throw new Error(`array index is not a JSON Pointer token: ${token}`);
		}
		const index = Number(token);
		if (index > parent.length) {
			throw new Error(`array index out of range: ${token}`);
		}
		parent[index] = value;
		return;
	}
	if (parent !== null && typeof parent === 'object') {
		(parent as Record<string, unknown>)[token] = value;
		return;
	}
	throw new Error('JSON Pointer parent is not an object or array');
}

/**
 * pointer の現在値を読む。途中が無いときは undefined
 */
export function getJsonPointer(root: unknown, pointer: string): unknown {
	const tokens = parseJsonPointer(pointer);
	let current = root;
	for (const token of tokens) {
		if (current === null || typeof current !== 'object') {
			return undefined;
		}
		current = readChild(current, token);
	}
	return current;
}

/**
 * pointer へ値を書く。書く前の値を返す
 *
 * WARN: 空 pointer はここでは扱わない。文書全体の差し替えは呼び出し側が行う。
 */
export function setJsonPointer(root: unknown, pointer: string, value: unknown): unknown {
	const tokens = parseJsonPointer(pointer);
	if (tokens.length === 0) {
		throw new Error('empty JSON Pointer is not a nested set');
	}

	let parent: unknown = root;
	for (let index = 0; index < tokens.length - 1; index += 1) {
		const token = tokens[index];
		if (parent === null || typeof parent !== 'object') {
			throw new Error(`JSON Pointer parent missing at /${tokens.slice(0, index).join('/')}`);
		}
		const next = readChild(parent, token);
		if (next === null || next === undefined || typeof next !== 'object') {
			throw new Error(`JSON Pointer parent missing at ${joinJsonPointer(tokens.slice(0, index + 1))}`);
		}
		parent = next;
	}

	const leaf = tokens[tokens.length - 1];
	const before = readChild(parent, leaf);
	writeChild(parent, leaf, value);
	return before;
}
