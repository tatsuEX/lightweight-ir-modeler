/**
 * IR snapshot YAML コメント用のキーパス
 *
 * - ident: `uiDefinition` / `importBase`
 * - 非 ident キー: `['im-forma']`（`'` は `''`）
 * - 配列: `components[0]`
 */

/** YAML パスの 1 セグメント */
export type YamlPathSegment = { type: 'key'; key: string } | { type: 'index'; index: number };

/** ident としてドット連結できるキー */
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * キーを YAML パス用にクォートする
 */
function quoteYamlPathKey(key: string): string {
	return `'${key.replaceAll("'", "''")}'`;
}

/**
 * パスセグメント列を YAML キーパス文字列にする
 */
export function stringifyYamlKeyPath(segments: readonly YamlPathSegment[]): string {
	let result = '';

	for (const segment of segments) {
		if (segment.type === 'index') {
			result += `[${segment.index}]`;
			continue;
		}

		const key = segment.key;
		const bracket = `[${quoteYamlPathKey(key)}]`;

		if (result === '') {
			result = IDENT_RE.test(key) ? key : bracket;
			continue;
		}

		result += IDENT_RE.test(key) ? `.${key}` : bracket;
	}

	return result;
}

/**
 * ident キーを読む
 */
function readIdent(path: string, start: number): { key: string; next: number } | null {
	const match = path.slice(start).match(/^[A-Za-z_][A-Za-z0-9_]*/);
	if (!match) {
		return null;
	}

	return { key: match[0], next: start + match[0].length };
}

/**
 * `[n]` または `['key']` を読む
 */
function readBracket(path: string, start: number): { segment: YamlPathSegment; next: number } {
	if (path[start] !== '[') {
		throw new Error(`invalid YAML key path at ${start}: expected '['`);
	}

	if (path[start + 1] === "'") {
		let index = start + 2;
		let key = '';
		while (index < path.length) {
			const char = path[index];
			if (char === "'") {
				if (path[index + 1] === "'") {
					key += "'";
					index += 2;
					continue;
				}
				if (path[index + 1] !== ']') {
					throw new Error(`invalid YAML key path at ${index}: expected ']' after quoted key`);
				}
				return { segment: { type: 'key', key }, next: index + 2 };
			}
			key += char;
			index += 1;
		}
		throw new Error('invalid YAML key path: unterminated quoted key');
	}

	const match = path.slice(start + 1).match(/^(\d+)\]/);
	if (!match) {
		throw new Error(`invalid YAML key path at ${start}: expected index or quoted key`);
	}

	return {
		segment: { type: 'index', index: Number(match[1]) },
		next: start + 1 + match[0].length
	};
}

/**
 * YAML キーパス文字列をセグメント列にする
 */
export function parseYamlKeyPath(path: string): YamlPathSegment[] {
	if (path === '') {
		throw new Error('YAML key path must not be empty');
	}

	const segments: YamlPathSegment[] = [];
	let cursor = 0;

	while (cursor < path.length) {
		if (segments.length > 0) {
			if (path[cursor] === '.') {
				cursor += 1;
				const ident = readIdent(path, cursor);
				if (!ident) {
					if (path[cursor] === '[') {
						const bracket = readBracket(path, cursor);
						segments.push(bracket.segment);
						cursor = bracket.next;
						continue;
					}
					throw new Error(`invalid YAML key path at ${cursor}: expected ident or '['`);
				}
				segments.push({ type: 'key', key: ident.key });
				cursor = ident.next;
				continue;
			}

			if (path[cursor] === '[') {
				const bracket = readBracket(path, cursor);
				segments.push(bracket.segment);
				cursor = bracket.next;
				continue;
			}

			throw new Error(`invalid YAML key path at ${cursor}: expected '.' or '['`);
		}

		const ident = readIdent(path, cursor);
		if (ident) {
			segments.push({ type: 'key', key: ident.key });
			cursor = ident.next;
			continue;
		}

		if (path[cursor] === '[') {
			const bracket = readBracket(path, cursor);
			segments.push(bracket.segment);
			cursor = bracket.next;
			continue;
		}

		throw new Error(`invalid YAML key path at ${cursor}: expected ident or '['`);
	}

	if (segments.length === 0) {
		throw new Error('YAML key path must not be empty');
	}

	return segments;
}

/**
 * 親パスに相対パスを連結する
 *
 * WARN: rel が `[` で始まるときはドットを挟まない（`external['im-forma']`）。
 */
export function joinYamlKeyPath(base: string, rel: string): string {
	if (rel === '') {
		return base;
	}
	if (rel.startsWith('[')) {
		return `${base}${rel}`;
	}
	if (rel.startsWith('.')) {
		return `${base}${rel}`;
	}
	return `${base}.${rel}`;
}

/**
 * パスが prefix セグメントで始まるか判定する
 */
export function yamlKeyPathStartsWith(
	path: readonly YamlPathSegment[],
	prefix: readonly YamlPathSegment[]
): boolean {
	if (path.length < prefix.length) {
		return false;
	}

	return prefix.every((segment, index) => {
		const other = path[index];
		if (segment.type !== other.type) {
			return false;
		}
		if (segment.type === 'index' && other.type === 'index') {
			return segment.index === other.index;
		}
		if (segment.type === 'key' && other.type === 'key') {
			return segment.key === other.key;
		}
		return false;
	});
}
