import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TOAST_DELAY_MS, ToastMessages } from './toast.svelte';

describe('ToastMessages', () => {
	let toast: ToastMessages;

	beforeEach(() => {
		vi.useFakeTimers();
		toast = new ToastMessages();
	});

	afterEach(() => {
		toast.clear();
		vi.useRealTimers();
	});

	it('appends a message with generated id', () => {
		toast.info('保存しました', 'snapshot を更新しました');

		expect(toast.messages).toHaveLength(1);
		expect(toast.messages[0]).toMatchObject({
			severity: 'info',
			summary: '保存しました',
			detail: 'snapshot を更新しました',
			sticky: false
		});
		expect(toast.messages[0]?.id).toBeTruthy();
	});

	it('maps warn and error shortcuts', () => {
		toast.warn('未保存です');
		toast.error('Export に失敗しました', 'permission denied');

		expect(toast.messages.map((message) => message.severity)).toEqual(['warn', 'error']);
		expect(toast.messages[1]?.detail).toBe('permission denied');
	});

	it('removes a non-sticky message after the default delay', () => {
		toast.info('一時メッセージ');
		expect(toast.messages).toHaveLength(1);

		vi.advanceTimersByTime(DEFAULT_TOAST_DELAY_MS - 1);
		expect(toast.messages).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(toast.messages).toHaveLength(0);
	});

	it('keeps a sticky message until dismiss', () => {
		toast.add({ severity: 'info', summary: '固定', sticky: true });

		vi.advanceTimersByTime(DEFAULT_TOAST_DELAY_MS * 2);
		expect(toast.messages).toHaveLength(1);

		const id = toast.messages[0]?.id;
		expect(id).toBeDefined();
		toast.dismiss(id as string);
		expect(toast.messages).toHaveLength(0);
	});

	it('cancels the pending timer when dismissed early', () => {
		toast.info('すぐ閉じる');
		const id = toast.messages[0]?.id as string;

		toast.dismiss(id);
		expect(toast.messages).toHaveLength(0);

		vi.advanceTimersByTime(DEFAULT_TOAST_DELAY_MS);
		expect(toast.messages).toHaveLength(0);
	});

	it('dismisses each message on its own timer', () => {
		toast.info('first');
		vi.advanceTimersByTime(1000);
		toast.info('second');

		vi.advanceTimersByTime(DEFAULT_TOAST_DELAY_MS - 1000);
		expect(toast.messages.map((message) => message.summary)).toEqual(['second']);

		vi.advanceTimersByTime(1000);
		expect(toast.messages).toHaveLength(0);
	});

	it('clear removes all messages and pending timers', () => {
		toast.info('a');
		toast.add({ severity: 'error', summary: 'b', sticky: true });
		toast.clear();

		expect(toast.messages).toHaveLength(0);
		vi.advanceTimersByTime(DEFAULT_TOAST_DELAY_MS);
		expect(toast.messages).toHaveLength(0);
	});
});
