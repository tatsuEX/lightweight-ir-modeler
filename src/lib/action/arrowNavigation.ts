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

/** 同一入力欄の端での連続左右キー押下を追跡する */
type EdgeArrowState = {
	key: 'ArrowLeft' | 'ArrowRight';
	element: HTMLElement;
};

let edgeArrowState: EdgeArrowState | null = null;

/**
 * テキスト入力としてキャレット位置を扱う要素か判定する
 */
function isTextEntryInput(
	element: HTMLElement
): element is HTMLInputElement | HTMLTextAreaElement {
	if (element instanceof HTMLTextAreaElement) {
		return true;
	}
	if (!(element instanceof HTMLInputElement)) {
		return false;
	}
	const textTypes = new Set(['', 'text', 'search', 'url', 'tel', 'email', 'password', 'number']);
	return textTypes.has(element.type);
}

/**
 * キャレットが文字列先頭にあるか判定する
 */
function isCaretAtStart(input: HTMLInputElement | HTMLTextAreaElement): boolean {
	return input.selectionStart === 0 && input.selectionEnd === 0;
}

/**
 * キャレットが文字列末尾にあるか判定する
 */
function isCaretAtEnd(input: HTMLInputElement | HTMLTextAreaElement): boolean {
	const length = input.value.length;
	return input.selectionStart === length && input.selectionEnd === length;
}

/**
 * 端での連続左右キー押下状態をリセットする
 */
function resetEdgeArrowState(): void {
	edgeArrowState = null;
}

/**
 * 左右キーでフォーカス遷移すべきか判定する
 */
function shouldNavigateHorizontal(
	event: KeyboardEvent,
	focusable: HTMLElement
): boolean {
	if (event.ctrlKey) {
		resetEdgeArrowState();
		return true;
	}

	if (!isTextEntryInput(focusable)) {
		resetEdgeArrowState();
		return true;
	}

	if (event.key === 'ArrowLeft') {
		if (!isCaretAtStart(focusable)) {
			resetEdgeArrowState();
			return false;
		}
		if (
			edgeArrowState?.key === 'ArrowLeft' &&
			edgeArrowState.element === focusable
		) {
			resetEdgeArrowState();
			return true;
		}
		edgeArrowState = { key: 'ArrowLeft', element: focusable };
		return false;
	}

	if (event.key === 'ArrowRight') {
		if (!isCaretAtEnd(focusable)) {
			resetEdgeArrowState();
			return false;
		}
		if (
			edgeArrowState?.key === 'ArrowRight' &&
			edgeArrowState.element === focusable
		) {
			resetEdgeArrowState();
			return true;
		}
		edgeArrowState = { key: 'ArrowRight', element: focusable };
		return false;
	}

	return false;
}

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
 * 矢印キーで同一ルート内のフォーカスを移動する
 */
function handleArrowNavigation(event: KeyboardEvent, focusable: HTMLElement): void {
	if (!ARROW_KEYS.has(event.key)) {
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
			resetEdgeArrowState();
			target = root.querySelector<HTMLElement>(
				`[data-focusable][data-field="${CSS.escape(field)}"][data-row="${Number(row) - 1}"]`
			);
			break;
		case 'ArrowDown':
			resetEdgeArrowState();
			target = root.querySelector<HTMLElement>(
				`[data-focusable][data-field="${CSS.escape(field)}"][data-row="${Number(row) + 1}"]`
			);
			break;
		case 'ArrowLeft':
		case 'ArrowRight': {
			if (!shouldNavigateHorizontal(event, focusable)) {
				return;
			}
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
 * テーブル等の編集セル間を矢印キーで移動する Svelte action
 */
export function arrowNavigation(node: HTMLElement, params: ArrowNavigationParams) {
	let focusable = resolveFocusable(node);
	const onKeydown = (event: KeyboardEvent) => {
		if (!focusable) {
			return;
		}
		handleArrowNavigation(event, focusable);
	};
	const onBlur = () => {
		if (edgeArrowState?.element === focusable) {
			resetEdgeArrowState();
		}
	};

	if (focusable) {
		applyNavigationAttributes(focusable, params);
		focusable.addEventListener('keydown', onKeydown);
		focusable.addEventListener('blur', onBlur);
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
					focusable.removeEventListener('blur', onBlur);
					clearNavigationAttributes(focusable);
					if (edgeArrowState?.element === focusable) {
						resetEdgeArrowState();
					}
				}
				focusable = nextFocusable;
				if (focusable) {
					focusable.addEventListener('keydown', onKeydown);
					focusable.addEventListener('blur', onBlur);
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
				focusable.removeEventListener('blur', onBlur);
				clearNavigationAttributes(focusable);
				if (edgeArrowState?.element === focusable) {
					resetEdgeArrowState();
				}
			}
		}
	};
}
