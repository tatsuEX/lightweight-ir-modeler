/**
 * Layout の並べ替え列と退避列を、確定済み components から切り離して揃える
 *
 * 退避は IR に書かない。ここは id と配列順だけの純粋関数。
 */

import {
	SHADOW_ITEM_MARKER_PROPERTY_NAME,
	SHADOW_PLACEHOLDER_ITEM_ID
} from 'svelte-dnd-action';

/** 二つの DnD 列が共有する type */
export const LAYOUT_DND_TYPE = 'layout-component';

/** 退避が残っているあいだ、自動保存を止めるときの Toast */
export const LAYOUT_PARKED_SAVE_BLOCK_MESSAGE =
	'退避エリアに項目があります。並べ替え列へ戻すまで自動保存しません';

/** 退避列を画面のどちらに置くか */
export type LayoutParkedSide = 'left' | 'right';

/** 並べ替え列か退避列か */
export type LayoutColumnId = 'main' | 'parked';

/** 一塊の移動先 */
export type LayoutBlockMove = 'up' | 'down' | 'start' | 'end';

/**
 * id を持つ行
 */
type Row = {
	id: string;
};

/**
 * svelte-dnd-action がドラッグ中に差し込む影かどうか
 */
export function isLayoutDndShadow(item: Row): boolean {
	const record = item as Row & Record<string, unknown>;
	return record[SHADOW_ITEM_MARKER_PROPERTY_NAME] === true || item.id === SHADOW_PLACEHOLDER_ITEM_ID;
}

/**
 * 二つの列が同じ要素参照の並びか
 */
export function sameLayoutColumnItems<T extends Row>(left: readonly T[], right: readonly T[]): boolean {
	return left.length === right.length && left.every((item, index) => item === right[index]);
}

/**
 * id の並びが同じか
 */
export function sameComponentIdOrder(left: readonly Row[], right: readonly Row[]): boolean {
	return left.length === right.length && left.every((item, index) => item.id === right[index]?.id);
}

/**
 * 確定済みの配列に、二つの列の id を合わせる
 *
 * 既知の id が確定側と一つも重ならないときは、読込で id が替わったものとして並べ替え列を確定順にし、退避を空にする。
 * 確定側にだけある id は並べ替え列の末尾へ足す。
 */
export function reconcileLayoutColumns<T extends Row>(
	committed: readonly T[],
	main: readonly T[],
	parked: readonly T[]
): { main: T[]; parked: T[] } {
	if (main.length === 0 && parked.length === 0) {
		return { main: committed.slice(), parked: [] };
	}

	const committedById = new Map(committed.map((item) => [item.id, item]));
	const knownIds = new Set([...main, ...parked].map((item) => item.id));
	const overlaps = committed.some((item) => knownIds.has(item.id));
	if (!overlaps) {
		return { main: committed.slice(), parked: [] };
	}

	const nextParked = parked.flatMap((item) => {
		const current = committedById.get(item.id);
		return current ? [current] : [];
	});
	const parkedIds = new Set(nextParked.map((item) => item.id));
	const nextMain = main.flatMap((item) => {
		if (parkedIds.has(item.id)) {
			return [];
		}
		const current = committedById.get(item.id);
		return current ? [current] : [];
	});
	const placed = new Set([...nextMain, ...nextParked].map((item) => item.id));
	for (const item of committed) {
		if (!placed.has(item.id)) {
			nextMain.push(item);
		}
	}

	return { main: nextMain, parked: nextParked };
}

/**
 * 退避が空で、並べ替え列の id 順が確定順と違うときだけ commitMain を true にする
 */
export function syncLayoutColumns<T extends Row>(
	committed: readonly T[],
	main: readonly T[],
	parked: readonly T[]
): { main: T[]; parked: T[]; commitMain: boolean } {
	const next = reconcileLayoutColumns(committed, main, parked);
	return {
		main: next.main,
		parked: next.parked,
		commitMain: next.parked.length === 0 && !sameComponentIdOrder(next.main, committed)
	};
}

/**
 * 選択した行を、相対順のまま一段または端へ動かす
 *
 * WARN: 離れて選んでいても、先に隙間を閉じてから一塊で動かす。
 */
export function moveSelectedBlock<T extends Row>(
	items: readonly T[],
	selectedIds: ReadonlySet<string>,
	where: LayoutBlockMove
): T[] {
	const selected = items.filter((item) => selectedIds.has(item.id));
	if (selected.length === 0) {
		return items.slice();
	}

	const rest = items.filter((item) => !selectedIds.has(item.id));
	const firstIndex = items.findIndex((item) => selectedIds.has(item.id));
	let insertAt = items.slice(0, firstIndex).filter((item) => !selectedIds.has(item.id)).length;
	if (where === 'up') {
		insertAt = Math.max(0, insertAt - 1);
	} else if (where === 'down') {
		insertAt = Math.min(rest.length, insertAt + 1);
	} else if (where === 'start') {
		insertAt = 0;
	} else {
		insertAt = rest.length;
	}

	const next = rest.slice();
	next.splice(insertAt, 0, ...selected);
	return next;
}

/**
 * ドラッグ中の行の位置へ、選択ブロックを相対順のまま寄せる
 *
 * 影があるときはドラッグ対象の代わりに影を残す。選択は destination 側の列から来たものだけを渡す。
 */
export function gatherSelectedBlock<T extends Row>(
	zoneItems: readonly T[],
	otherItems: readonly T[],
	draggedId: string,
	selectedInOrder: readonly T[]
): { zone: T[]; other: T[] } {
	const moving = new Set(selectedInOrder.map((item) => item.id));
	const shadow = zoneItems.find((item) => isLayoutDndShadow(item));
	const zoneRest = zoneItems.filter((item) => !isLayoutDndShadow(item) && !moving.has(item.id));
	const otherRest = otherItems.filter((item) => !isLayoutDndShadow(item) && !moving.has(item.id));
	const anchorIndex = zoneItems.findIndex((item) => isLayoutDndShadow(item) || item.id === draggedId);
	const insertAt = zoneItems
		.slice(0, Math.max(anchorIndex, 0))
		.filter((item) => !isLayoutDndShadow(item) && !moving.has(item.id)).length;
	const block = selectedInOrder.map((item) => (item.id === draggedId && shadow ? shadow : item));
	const zone = zoneRest.slice();
	zone.splice(insertAt, 0, ...block);
	return { zone, other: otherRest };
}
