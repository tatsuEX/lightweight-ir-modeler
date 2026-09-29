/**
 * Layout の並べ替え列と退避列（presentation。IR には書かない）
 */

import { createContext } from 'svelte';
import type { EditorComponent } from '$lib/ir/elements/component-schema';
import type { LayoutParkedSide } from '$lib/store/layout-editor/layout-columns';

export const [getLayoutColumnsContext, setLayoutColumnsContext] = createContext<LayoutColumns>();

/**
 * 並べ替え列と退避列、および退避列を左右どちらに置くか
 */
export class LayoutColumns {
	main = $state<EditorComponent[]>([]);
	parked = $state<EditorComponent[]>([]);
	/** 既定は右。並べ替え列が左に残る */
	parkedSide = $state<LayoutParkedSide>('right');
	/**
	 * ドラッグ中は確定順への同期を止める
	 *
	 * WARN: 影アイテムの id は components に無い。同期するとドラッグ中の行が落ちる。
	 */
	dragging = $state(false);

	/**
	 * 退避列の左右を入れ替える。中の項目は動かさない
	 */
	toggleParkedSide(): void {
		this.parkedSide = this.parkedSide === 'right' ? 'left' : 'right';
	}
}

/**
 * 空の列状態を作る。初期の並べ替え列は呼び出し側が入れる
 */
export function createLayoutColumns(initialMain: readonly EditorComponent[] = []): LayoutColumns {
	const columns = new LayoutColumns();
	columns.main = initialMain.slice();
	return columns;
}
