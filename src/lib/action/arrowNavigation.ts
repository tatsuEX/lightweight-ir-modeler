/** 矢印キー遷移 action のパラメータ */
export type ArrowNavigationParams = {
	/** 列または入力項目の識別名 */
	field: string;
	/** 行 index（0 始まり） */
	row: number;
};

const FOCUSABLE_SELECTOR =
	'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * ラッパーまたは自身からフォーカス可能な子孫要素を解決する
 */
function resolveFocusable(node: HTMLElement): HTMLElement | null {
	if (node.matches(FOCUSABLE_SELECTOR)) {
		return node;
	}
	return node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
}

/**
 * 遷移探索のルート要素を取得する
 */
function findNavigationRoot(node: HTMLElement): HTMLElement | null {
	return node.closest('[data-arrow-nav-root]') ?? node.closest('table');
}

/**
 * フォーカス要素に data 属性を付与する
 */
function applyNavigationAttributes(
	focusable: HTMLElement,
	params: ArrowNavigationParams
): void {
	focusable.dataset.field = params.field;
	focusable.dataset.row = String(params.row);
	focusable.dataset.focusable = 'true';
}

/**
 * フォーカス要素から data 属性を除去する
 */
function clearNavigationAttributes(focusable: HTMLElement): void {
	delete focusable.dataset.field;
	delete focusable.dataset.row;
	delete focusable.dataset.focusable;
}

/**
 * Ctrl + 矢印キーで同一ルート内のフォーカスを移動する
 */
function handleArrowNavigation(event: KeyboardEvent, focusable: HTMLElement): void {
	if (!event.ctrlKey || !ARROW_KEYS.has(event.key)) {
		return;
	}

	const root = findNavigationRoot(focusable);
	const field = focusable.dataset.field;
	const row = focusable.dataset.row;
	if (!root || field === undefined || row === undefined) {
		return;
	}

	let target: HTMLElement | null = null;

	switch (event.key) {
		case 'ArrowUp':
			target = root.querySelector<HTMLElement>(
				`[data-focusable][data-field="${CSS.escape(field)}"][data-row="${Number(row) - 1}"]`
			);
			break;
		case 'ArrowDown':
			target = root.querySelector<HTMLElement>(
				`[data-focusable][data-field="${CSS.escape(field)}"][data-row="${Number(row) + 1}"]`
			);
			break;
		case 'ArrowLeft':
		case 'ArrowRight': {
			const rowFocusables = [
				...root.querySelectorAll<HTMLElement>(`[data-focusable][data-row="${row}"]`)
			];
			const currentIndex = rowFocusables.indexOf(focusable);
			if (currentIndex === -1) {
				return;
			}
			const nextIndex = event.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
			target = rowFocusables[nextIndex] ?? null;
			break;
		}
	}

	if (!target) {
		return;
	}

	event.preventDefault();
	target.focus();
}

/**
 * テーブル等の編集セル間を Ctrl + 矢印キーで移動する Svelte action
 */
export function arrowNavigation(node: HTMLElement, params: ArrowNavigationParams) {
	let focusable = resolveFocusable(node);
	const onKeydown = (event: KeyboardEvent) => {
		if (!focusable) {
			return;
		}
		handleArrowNavigation(event, focusable);
	};

	if (focusable) {
		applyNavigationAttributes(focusable, params);
		focusable.addEventListener('keydown', onKeydown);
	}

	return {
		/**
		 * field / row の変更時に data 属性を更新する
		 */
		update(nextParams: ArrowNavigationParams) {
			const nextFocusable = resolveFocusable(node);
			if (nextFocusable !== focusable) {
				if (focusable) {
					focusable.removeEventListener('keydown', onKeydown);
					clearNavigationAttributes(focusable);
				}
				focusable = nextFocusable;
				if (focusable) {
					focusable.addEventListener('keydown', onKeydown);
				}
			}
			if (focusable) {
				applyNavigationAttributes(focusable, nextParams);
			}
		},
		/**
		 * listener と data 属性を解除する
		 */
		destroy() {
			if (focusable) {
				focusable.removeEventListener('keydown', onKeydown);
				clearNavigationAttributes(focusable);
			}
		}
	};
}
