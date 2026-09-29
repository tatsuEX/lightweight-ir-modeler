<script lang="ts">
	import { tick } from 'svelte';
	import { Button } from 'flowbite-svelte';
	import {
		dndzone,
		SOURCES,
		TRIGGERS,
		type DndEvent,
		type TransformDraggedElementFunction
	} from 'svelte-dnd-action';
	import type { EditorComponent } from '$lib/ir/elements/component-schema';
	import { getLayoutColumnsContext } from '$lib/store/layout-editor/layout-columns.svelte';
	import {
		LAYOUT_DND_TYPE,
		gatherSelectedBlock,
		isLayoutDndShadow,
		moveSelectedBlock,
		type LayoutBlockMove,
		type LayoutColumnId
	} from '$lib/store/layout-editor/layout-columns';

	const columns = getLayoutColumnsContext();

	/** 横にこの距離を超えたら並べ替え。縦は行の高さの 4 分の 1 */
	const POINTER_DRAG_THRESHOLD_X_PX = 50;
	const POINTER_DRAG_THRESHOLD_Y_RATIO = 0.25;

	/** 閾値を超えるまでライブラリのドラッグは止める。button の mousedown は value があり開始されない */
	let dragArmed = $state(false);

	let selectedMain = $state<Set<string>>(new Set());
	let selectedParked = $state<Set<string>>(new Set());
	let anchorMain = $state('');
	let anchorParked = $state('');
	let dragBlock: EditorComponent[] | null = null;
	let finishQueued = false;

	const mainSelectedCount = $derived(
		columns.main.filter((item) => selectedMain.has(item.id) && !isLayoutDndShadow(item)).length
	);
	const parkedSelectedCount = $derived(
		columns.parked.filter((item) => selectedParked.has(item.id) && !isLayoutDndShadow(item)).length
	);
	const selectedCount = $derived(mainSelectedCount + parkedSelectedCount);
	const parkedCount = $derived(columns.parked.filter((item) => !isLayoutDndShadow(item)).length);

	/**
	 * 影を除いた行だけを返す
	 */
	function realItems(items: readonly EditorComponent[]): EditorComponent[] {
		return items.filter((item) => !isLayoutDndShadow(item));
	}

	/**
	 * 指定列の選択集合を返す
	 */
	function selectedSet(column: LayoutColumnId): Set<string> {
		return column === 'main' ? selectedMain : selectedParked;
	}

	/**
	 * 指定列の現在の行を返す
	 */
	function columnItems(column: LayoutColumnId): EditorComponent[] {
		return column === 'main' ? columns.main : columns.parked;
	}

	/**
	 * 指定列の行を差し替える
	 */
	function setColumnItems(column: LayoutColumnId, items: EditorComponent[]): void {
		if (column === 'main') {
			columns.main = items;
			return;
		}
		columns.parked = items;
	}

	/**
	 * ドラッグ開始時に、その列で選ばれている一塊を覚える
	 */
	function captureDrag(column: LayoutColumnId, draggedId: string): void {
		const selected = selectedSet(column);
		const chosen = realItems(columnItems(column)).filter((item) => selected.has(item.id));
		dragBlock = selected.has(draggedId) && chosen.length > 1 ? chosen : null;
	}

	/**
	 * ライブラリの並びを列へ反映し、複数選択なら一塊に寄せる
	 */
	function applyDnd(column: LayoutColumnId, eventItems: EditorComponent[], draggedId: string): void {
		const block = dragBlock;
		if (!block || block.length < 2 || !block.some((item) => item.id === draggedId)) {
			setColumnItems(column, eventItems);
			return;
		}

		const hasAnchor = eventItems.some((item) => isLayoutDndShadow(item) || item.id === draggedId);
		const moving = new Set(block.map((item) => item.id));
		if (!hasAnchor) {
			setColumnItems(
				column,
				eventItems.filter((item) => !moving.has(item.id))
			);
			return;
		}

		const other: LayoutColumnId = column === 'main' ? 'parked' : 'main';
		const gathered = gatherSelectedBlock(eventItems, columnItems(other), draggedId, block);
		setColumnItems(column, gathered.zone);
		setColumnItems(other, gathered.other);
	}

	/**
	 * ドロップ後に影を外し、一塊の選択を移動先の列へ移す
	 */
	function finishGesture(): void {
		const blockIds = dragBlock?.map((item) => item.id) ?? [];
		dragBlock = null;
		columns.main = realItems(columns.main);
		columns.parked = realItems(columns.parked);
		if (blockIds.length > 1) {
			const inMain = blockIds.every((id) => columns.main.some((item) => item.id === id));
			const inParked = blockIds.every((id) => columns.parked.some((item) => item.id === id));
			if (inMain) {
				selectedMain = new Set(blockIds);
				selectedParked = new Set();
			} else if (inParked) {
				selectedParked = new Set(blockIds);
				selectedMain = new Set();
			}
		}
		columns.dragging = false;
		dragArmed = false;
	}

	/**
	 * 両列の finalize が揃ってからドラッグを終える
	 *
	 * WARN: 先に dragging を下ろすと、移動元の finalize 前に確定順へ同期される。
	 */
	function scheduleFinish(): void {
		if (finishQueued) {
			return;
		}
		finishQueued = true;
		queueMicrotask(() => {
			finishQueued = false;
			finishGesture();
		});
	}

	/**
	 * ドラッグ中の並びを受け取る
	 */
	function onConsider(column: LayoutColumnId, event: CustomEvent<DndEvent<EditorComponent>>): void {
		const info = event.detail.info;
		if (info.trigger === TRIGGERS.DRAG_STARTED) {
			columns.dragging = true;
			captureDrag(column, info.id);
		}
		applyDnd(column, event.detail.items, info.id);
		if (info.trigger === TRIGGERS.DRAG_STOPPED) {
			scheduleFinish();
		}
	}

	/**
	 * ドロップ後の並びを受け取る。キーボードの矢印移動ではドラッグを終えない
	 */
	function onFinalize(column: LayoutColumnId, event: CustomEvent<DndEvent<EditorComponent>>): void {
		const info = event.detail.info;
		applyDnd(column, event.detail.items, info.id);
		const pointerDrop =
			info.source === SOURCES.POINTER &&
			(info.trigger === TRIGGERS.DROPPED_INTO_ZONE ||
				info.trigger === TRIGGERS.DROPPED_INTO_ANOTHER ||
				info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY);
		if (pointerDrop) {
			scheduleFinish();
		}
	}

	/**
	 * 行クリックで選択を付け外しする。Shift は範囲を足す
	 */
	function toggleSelected(column: LayoutColumnId, id: string, shiftKey: boolean): void {
		const items = realItems(columnItems(column));
		const current = new Set(selectedSet(column));
		const anchor = column === 'main' ? anchorMain : anchorParked;
		if (shiftKey && anchor !== '') {
			const from = items.findIndex((item) => item.id === anchor);
			const to = items.findIndex((item) => item.id === id);
			if (from >= 0 && to >= 0) {
				const [start, end] = from < to ? [from, to] : [to, from];
				for (const item of items.slice(start, end + 1)) {
					current.add(item.id);
				}
			}
		} else if (current.has(id)) {
			current.delete(id);
		} else {
			current.add(id);
		}

		if (current.size > 0) {
			if (column === 'main') {
				selectedParked = new Set();
			} else {
				selectedMain = new Set();
			}
		}

		if (column === 'main') {
			anchorMain = id;
			selectedMain = current;
			return;
		}
		anchorParked = id;
		selectedParked = current;
	}

	/**
	 * 短い押下で選択を切り替える
	 */
	function onRowClick(column: LayoutColumnId, id: string, shiftKey: boolean): void {
		if (isLayoutDndShadow({ id })) {
			return;
		}
		toggleSelected(column, id, shiftKey);
	}

	/**
	 * 横 50px または縦が行高の 4 分の 1を超えたらドラッグを開始する。それまでは選択の切り替え
	 *
	 * WARN: 行を button にすると target.value があり、svelte-dnd-action はドラッグを開始しない。
	 */
	function beginRowGesture(event: PointerEvent, column: LayoutColumnId, id: string): void {
		if (dragArmed || event.button !== 0 || isLayoutDndShadow({ id })) {
			return;
		}
		const row = event.currentTarget;
		if (!(row instanceof HTMLElement)) {
			return;
		}
		const rowEl = row;
		const startX = event.clientX;
		const startY = event.clientY;
		const shiftKey = event.shiftKey;
		const yThreshold = rowEl.getBoundingClientRect().height * POINTER_DRAG_THRESHOLD_Y_RATIO;
		let passedThreshold = false;

		/**
		 * 横か縦の閾値を超えたらポインタ監視をやめ、ドラッグを開始する
		 */
		function onMove(move: PointerEvent): void {
			if (passedThreshold) {
				return;
			}
			const dx = Math.abs(move.clientX - startX);
			const dy = Math.abs(move.clientY - startY);
			if (dx <= POINTER_DRAG_THRESHOLD_X_PX && dy <= yThreshold) {
				return;
			}
			passedThreshold = true;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			void armDrag(rowEl, move.clientX, move.clientY);
		}

		/**
		 * 閾値未満で離したら選択を切り替える
		 */
		function onUp(): void {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			if (!passedThreshold) {
				onRowClick(column, id, shiftKey);
			}
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	/**
	 * ドラッグを許可してから、いまの位置で mousedown を送り直す
	 */
	async function armDrag(row: HTMLElement, clientX: number, clientY: number): Promise<void> {
		let released = false;
		/**
		 * tick のあいだにボタンを離したかを記録する
		 */
		function markReleased(): void {
			released = true;
		}
		window.addEventListener('pointerup', markReleased);
		dragArmed = true;
		await tick();
		window.removeEventListener('pointerup', markReleased);
		if (released || !row.isConnected) {
			dragArmed = false;
			return;
		}
		row.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				cancelable: true,
				clientX,
				clientY,
				button: 0,
				buttons: 1
			})
		);
		// WARN: pointerup の中で dragArmed を下ろすと、続く mouseup より先にゾーンが更新される。
		window.addEventListener(
			'pointerup',
			() => {
				setTimeout(() => {
					dragArmed = false;
				}, 0);
			},
			{ once: true }
		);
	}

	/**
	 * Enter / Space で選択を切り替える
	 */
	function onRowKeydown(event: KeyboardEvent, column: LayoutColumnId, id: string): void {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}
		event.preventDefault();
		onRowClick(column, id, event.shiftKey);
	}

	/**
	 * 選択がある列を返す。どちらも未選択なら並べ替え列
	 */
	function selectedColumn(): LayoutColumnId {
		return selectedParked.size > 0 ? 'parked' : 'main';
	}

	/**
	 * 選択がある列の選択をすべて外す
	 */
	function clearActiveSelection(): void {
		if (selectedParked.size > 0) {
			selectedParked = new Set();
			return;
		}
		selectedMain = new Set();
	}

	/**
	 * 選択がある列の中だけで、選択を一塊で動かす
	 */
	function nudge(where: LayoutBlockMove): void {
		const column = selectedColumn();
		setColumnItems(column, moveSelectedBlock(realItems(columnItems(column)), selectedSet(column), where));
	}

	/**
	 * 影を除いた 1 始まりの番号を返す
	 */
	function rowNumber(items: readonly EditorComponent[], index: number): string {
		const item = items[index];
		if (!item || isLayoutDndShadow(item)) {
			return '';
		}
		return String(items.slice(0, index).filter((entry) => !isLayoutDndShadow(entry)).length + 1);
	}

	/**
	 * ドラッグ対象が複数選択に含まれるときの件数を返す
	 */
	function dragCount(id: string): number {
		if (dragBlock?.some((item) => item.id === id)) {
			return dragBlock.length;
		}
		for (const selected of [selectedMain, selectedParked]) {
			if (selected.has(id) && selected.size > 1) {
				return selected.size;
			}
		}
		return 1;
	}

	/**
	 * 複数選択のドラッグ中は、つかんでいる行に件数を出す
	 */
	const transformDraggedElement: TransformDraggedElementFunction = (element, data) => {
		const id = data?.id;
		if (!element || typeof id !== 'string') {
			return;
		}
		const count = dragCount(id);
		if (count < 2) {
			return;
		}
		const badge = element.querySelector('[data-layout-drag-count]');
		if (badge) {
			badge.textContent = `${count} 件`;
		}
	};

	/**
	 * 列から消えた id の選択を外す
	 */
	$effect(() => {
		const mainIds = new Set(columns.main.map((item) => item.id));
		const parkedIds = new Set(columns.parked.map((item) => item.id));
		const nextMain = new Set([...selectedMain].filter((id) => mainIds.has(id)));
		const nextParked = new Set([...selectedParked].filter((id) => parkedIds.has(id)));
		if (nextMain.size !== selectedMain.size) {
			selectedMain = nextMain;
		}
		if (nextParked.size !== selectedParked.size) {
			selectedParked = nextParked;
		}
	});
</script>

{#snippet column(column: LayoutColumnId, title: string, items: EditorComponent[])}
	<section
		class="flex min-h-0 min-w-[400px] flex-col overflow-hidden rounded border border-gray-200 dark:border-gray-700 {column === 'main'
			? columns.parkedSide === 'left'
				? 'order-2'
				: 'order-1'
			: columns.parkedSide === 'left'
				? 'order-1'
				: 'order-2'}"
		aria-label={title}
	>
		<header class="shrink-0 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
			<h2 class="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
			{#if column === 'parked' && parkedCount > 0}
				<p class="text-xs text-red-600 dark:text-red-400">戻すまで自動保存しません</p>
			{/if}
		</header>
		<div
			class="min-h-0 flex-1 overflow-y-auto"
			use:dndzone={{
				items,
				type: LAYOUT_DND_TYPE,
				flipDurationMs: 0,
				dragDisabled: !dragArmed,
				autoAriaDisabled: true,
				transformDraggedElement,
				dropTargetStyle: { outline: 'rgba(59, 130, 246, 0.45) solid 2px' }
			}}
			onconsider={(event) => onConsider(column, event)}
			onfinalize={(event) => onFinalize(column, event)}
		>
			{#each items as item, index (item.id)}
				<div
					role="button"
					tabindex="0"
					class="flex cursor-grab select-none items-center gap-2 border-b border-gray-100 px-2 py-1 text-sm dark:border-gray-800 {selectedSet(column).has(item.id)
						? 'bg-blue-50 dark:bg-blue-950'
						: 'bg-white dark:bg-gray-900'}"
					aria-pressed={selectedSet(column).has(item.id)}
					onpointerdown={(event) => beginRowGesture(event, column, item.id)}
					onkeydown={(event) => onRowKeydown(event, column, item.id)}
				>
					<span class="w-8 shrink-0 text-gray-500">{rowNumber(items, index)}</span>
					<span class="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{item.label}</span>
					<span class="w-24 shrink-0 truncate text-xs text-gray-600 dark:text-gray-300">{item.type}</span>
					<span class="w-28 shrink-0 truncate text-xs text-gray-500">{item.logicalId}</span>
					<span data-layout-drag-count class="w-10 shrink-0 text-xs text-blue-700"></span>
				</div>
			{/each}
		</div>
	</section>
{/snippet}

<div class="mx-auto flex h-full min-h-0 w-[60%] min-w-[calc(800px+0.75rem)] flex-col gap-2">
	<div class="flex shrink-0 flex-wrap items-center gap-2">
		<Button size="xs" color="alternative" onclick={() => columns.toggleParkedSide()}>左右入れ替え</Button>
		<span class="text-sm text-gray-600 dark:text-gray-300">{selectedCount} 件選択中</span>
		<Button size="xs" color="alternative" disabled={selectedCount === 0} onclick={() => clearActiveSelection()}>
			選択解除
		</Button>
		<Button size="xs" color="alternative" disabled={selectedCount === 0} onclick={() => nudge('up')}>上へ</Button>
		<Button size="xs" color="alternative" disabled={selectedCount === 0} onclick={() => nudge('down')}>下へ</Button>
		<Button size="xs" color="alternative" disabled={selectedCount === 0} onclick={() => nudge('start')}>先頭へ</Button>
		<Button size="xs" color="alternative" disabled={selectedCount === 0} onclick={() => nudge('end')}>末尾へ</Button>
	</div>
	<div class="grid min-h-0 flex-1 grid-cols-2 gap-3">
		{@render column('main', '並べ替え', columns.main)}
		{@render column('parked', '退避', columns.parked)}
	</div>
</div>
