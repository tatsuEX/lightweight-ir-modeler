import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '$lib/utils/debounce';

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('delays function invocation', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 500);

		debounced();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(499);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('resets delay on repeated calls', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 500);

		debounced();
		vi.advanceTimersByTime(400);
		debounced();
		vi.advanceTimersByTime(400);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('cancel prevents pending invocation', () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 500);

		debounced();
		debounced.cancel();
		vi.advanceTimersByTime(500);
		expect(fn).not.toHaveBeenCalled();
	});
});
