/**
 * yyyy-MM-dd 文字列を Date に変換する（不正・空は undefined）
 */
export function parseDateString(value: unknown): Date | undefined {
	if (typeof value !== 'string' || value === '') {
		return undefined;
	}
	const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!matched) {
		return undefined;
	}
	return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
}

/**
 * Date を yyyy-MM-dd 文字列へ変換する（未設定は undefined）
 */
export function formatDateString(value: Date | undefined): string | undefined {
	if (!value || Number.isNaN(value.getTime())) {
		return undefined;
	}
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * HH:mm 文字列を正規化する（空は undefined）
 */
export function normalizeTimeString(value: unknown): string | undefined {
	if (typeof value !== 'string' || value === '') {
		return undefined;
	}
	const matched = /^(\d{2}):(\d{2})/.exec(value);
	return matched ? `${matched[1]}:${matched[2]}` : undefined;
}

/**
 * IR の yyyy-MM-dd HH:mm を日付 / 時刻に分解する
 */
export function parseDateTimeParts(value: unknown): { date?: Date; time?: string } {
	if (typeof value !== 'string' || value === '') {
		return {};
	}
	const matched = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(value);
	if (matched) {
		return {
			date: parseDateString(matched[1]),
			time: matched[2]
		};
	}
	return { date: parseDateString(value.slice(0, 10)) };
}

/**
 * Flowbite Datepicker のカレンダーを閉じる
 *
 * WARN: コンポーネントは input focus で開き、外側 click で閉じるが blur では閉じない。
 * isOpen を外から触れないため、フォーカス先（または body）への click を合成して
 * 公式の outside-click 経路を使う。他の Datepicker 上へ移った場合はその入力を
 * click 対象にし、移り先のカレンダーは閉じない。
 */
export function closeDatepickerOnFocusOut(event: FocusEvent): void {
	const current = event.currentTarget as HTMLElement;
	const next = event.relatedTarget as Node | null;
	if (next && current.contains(next)) {
		return;
	}

	queueMicrotask(() => {
		const active = current.ownerDocument.activeElement;
		if (active && current.contains(active)) {
			return;
		}
		const clickTarget =
			active instanceof HTMLElement ? active : current.ownerDocument.body;
		clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});
}

/**
 * 空・不正な入力を undefined に戻す（number フィールド用）
 */
export function parseOptionalNumber(
	value: number | string | null | undefined
): number | undefined {
	if (value === '' || value === null || value === undefined) {
		return undefined;
	}
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}
