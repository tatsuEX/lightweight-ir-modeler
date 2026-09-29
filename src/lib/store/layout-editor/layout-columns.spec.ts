import { describe, expect, it } from 'vitest';
import { SHADOW_ITEM_MARKER_PROPERTY_NAME, SHADOW_PLACEHOLDER_ITEM_ID } from 'svelte-dnd-action';
import {
	gatherSelectedBlock,
	isLayoutDndShadow,
	moveSelectedBlock,
	reconcileLayoutColumns,
	syncLayoutColumns
} from './layout-columns';

/**
 * テスト用の行を作る
 */
function row(id: string): { id: string } {
	return { id };
}

/**
 * id の列にする
 */
function rows(...ids: string[]): { id: string }[] {
	return ids.map((id) => row(id));
}

describe('reconcileLayoutColumns', () => {
	it('seeds the main column from the committed list when both columns are empty', () => {
		const committed = rows('a', 'b');
		expect(reconcileLayoutColumns(committed, [], [])).toEqual({
			main: committed,
			parked: []
		});
	});

	it('keeps a parked id and appends a new committed id to the main column', () => {
		const a = row('a');
		const b = row('b');
		const c = row('c');
		expect(reconcileLayoutColumns([a, b, c], [a], [b])).toEqual({
			main: [a, c],
			parked: [b]
		});
	});

	it('drops a parked id that left the committed list', () => {
		const a = row('a');
		const b = row('b');
		expect(reconcileLayoutColumns([a], [a], [b])).toEqual({
			main: [a],
			parked: []
		});
	});

	it('clears the parked column when no id overlaps, as on snapshot load', () => {
		const next = rows('x', 'y');
		expect(reconcileLayoutColumns(next, rows('a'), rows('b'))).toEqual({
			main: next,
			parked: []
		});
	});

	it('refreshes column references from the committed objects', () => {
		const previous = row('a');
		const current = row('a');
		expect(reconcileLayoutColumns([current], [previous], [])).toEqual({
			main: [current],
			parked: []
		});
	});
});

describe('syncLayoutColumns', () => {
	it('asks to commit when the parked column is empty and the main order differs', () => {
		const a = row('a');
		const b = row('b');
		expect(syncLayoutColumns([a, b], [b, a], [])).toEqual({
			main: [b, a],
			parked: [],
			commitMain: true
		});
	});

	it('does not commit while an item is parked', () => {
		const a = row('a');
		const b = row('b');
		expect(syncLayoutColumns([a, b], [b], [a]).commitMain).toBe(false);
	});
});

describe('moveSelectedBlock', () => {
	it('closes gaps and moves the block up one step', () => {
		expect(moveSelectedBlock(rows('a', 'b', 'c', 'd', 'e'), new Set(['b', 'd']), 'up').map((item) => item.id)).toEqual([
			'b',
			'd',
			'a',
			'c',
			'e'
		]);
	});

	it('moves a contiguous block to the end', () => {
		expect(moveSelectedBlock(rows('a', 'b', 'c'), new Set(['a', 'b']), 'end').map((item) => item.id)).toEqual([
			'c',
			'a',
			'b'
		]);
	});

	it('leaves the list unchanged when the selection is empty', () => {
		const items = rows('a', 'b');
		expect(moveSelectedBlock(items, new Set(), 'start')).toEqual(items);
	});
});

describe('gatherSelectedBlock', () => {
	it('places the selected block around the shadow and removes those ids from the other column', () => {
		const b = row('b');
		const d = row('d');
		const shadow = {
			id: SHADOW_PLACEHOLDER_ITEM_ID,
			[SHADOW_ITEM_MARKER_PROPERTY_NAME]: true
		};
		const gathered = gatherSelectedBlock([row('a'), shadow, row('c')], [row('a'), b, row('c'), d], 'd', [b, d]);
		expect(gathered.zone.map((item) => item.id)).toEqual(['a', 'b', SHADOW_PLACEHOLDER_ITEM_ID, 'c']);
		expect(gathered.other.map((item) => item.id)).toEqual(['a', 'c']);
		expect(isLayoutDndShadow(shadow)).toBe(true);
	});

	it('replaces the dragged id with the original block on drop', () => {
		const b = row('b');
		const d = row('d');
		const gathered = gatherSelectedBlock([d], rows('a', 'b', 'c', 'd', 'e'), 'd', [b, d]);
		expect(gathered.zone.map((item) => item.id)).toEqual(['b', 'd']);
		expect(gathered.other.map((item) => item.id)).toEqual(['a', 'c', 'e']);
	});
});
