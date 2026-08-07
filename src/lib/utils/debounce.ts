/**
 * 関数呼び出しを delayMs だけ遅延させる debounce を生成する
 */
export function debounce<T extends (...args: never[]) => void>(
	fn: T,
	delayMs: number
): T & { cancel(): void } {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const debounced = ((...args: Parameters<T>) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn(...args);
		}, delayMs);
	}) as T & { cancel(): void };

	/**
	 * 保留中の debounce 呼び出しをキャンセルする
	 */
	debounced.cancel = () => {
		clearTimeout(timer);
		timer = undefined;
	};

	return debounced;
}
