/** テキスト列フィルタの一致モード */
export type TextMatchMode = 'startsWith' | 'contains' | 'endsWith';

/**
 * 大小無視で query が value に一致するか判定する
 *
 * WARN: 空または空白のみの query は常に一致（フィルタ未入力 = 全件）
 */
export function matchesText(value: unknown, query: string, mode: TextMatchMode): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (normalizedQuery === '') {
		return true;
	}

	const normalizedValue = String(value ?? '').toLowerCase();

	switch (mode) {
		case 'startsWith':
			return normalizedValue.startsWith(normalizedQuery);
		case 'endsWith':
			return normalizedValue.endsWith(normalizedQuery);
		case 'contains':
			return normalizedValue.includes(normalizedQuery);
	}
}
