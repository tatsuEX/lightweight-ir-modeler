import { createContext } from 'svelte';
import { nanoid } from 'nanoid';

/** Toast 自動消去までの待ち時間（ミリ秒） */
export const DEFAULT_TOAST_DELAY_MS = 5000;

/** FacesMessage.Severity 相当 */
export type ToastSeverity = 'info' | 'warn' | 'error';

/**
 * 表示中の Toast メッセージ（FacesMessage 相当）
 */
export type ToastMessage = {
	id: string;
	severity: ToastSeverity;
	summary: string;
	detail?: string;
	sticky: boolean;
};

/**
 * Toast 追加時の入力（id / sticky 既定は store が決める）
 */
export type ToastMessageInput = {
	severity: ToastSeverity;
	summary: string;
	detail?: string;
	sticky?: boolean;
};

export const [getToastContext, setToastContext] = createContext<ToastMessages>();

/**
 * アプリ全体の Toast メッセージを保持する（FacesContext の messages 相当）
 */
export class ToastMessages {
	#messages = $state<ToastMessage[]>([]);
	#timers = new Map<string, ReturnType<typeof setTimeout>>();

	/**
	 * 表示中メッセージを取得する
	 */
	get messages(): readonly ToastMessage[] {
		return this.#messages;
	}

	/**
	 * メッセージを追加し、sticky でなければ delay 後に自動削除する
	 *
	 * WARN: timer は Host の $effect ではなくここで張る。$effect だと再実行で二重になる。
	 */
	add(input: ToastMessageInput): void {
		const id = nanoid();
		const sticky = input.sticky ?? false;
		const message: ToastMessage = {
			id,
			severity: input.severity,
			summary: input.summary,
			sticky
		};
		if (input.detail) {
			message.detail = input.detail;
		}
		this.#messages = [...this.#messages, message];

		if (!sticky) {
			const timer = setTimeout(() => {
				this.dismiss(id);
			}, DEFAULT_TOAST_DELAY_MS);
			this.#timers.set(id, timer);
		}
	}

	/**
	 * Info メッセージを追加する
	 */
	info(summary: string, detail?: string): void {
		this.add({ severity: 'info', summary, detail });
	}

	/**
	 * Warn メッセージを追加する
	 */
	warn(summary: string, detail?: string): void {
		this.add({ severity: 'warn', summary, detail });
	}

	/**
	 * Error メッセージを追加する
	 */
	error(summary: string, detail?: string): void {
		this.add({ severity: 'error', summary, detail });
	}

	/**
	 * 指定 id のメッセージを削除し、未発火の timer を取り消す
	 */
	dismiss(id: string): void {
		this.#clearTimer(id);
		this.#messages = this.#messages.filter((message) => message.id !== id);
	}

	/**
	 * 全メッセージを削除し、未発火の timer をすべて取り消す
	 */
	clear(): void {
		for (const id of this.#timers.keys()) {
			this.#clearTimer(id);
		}
		this.#messages = [];
	}

	/**
	 * 指定 id の timer を取り消す
	 */
	#clearTimer(id: string): void {
		const timer = this.#timers.get(id);
		if (timer === undefined) {
			return;
		}
		clearTimeout(timer);
		this.#timers.delete(id);
	}
}

/**
 * Toast メッセージ store を作成する
 */
export function createToastMessages(): ToastMessages {
	return new ToastMessages();
}
