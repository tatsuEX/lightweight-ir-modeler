import { describe, expect, it } from 'vitest';
import { selectAutoSaveTiming, type AutoSaveCheckpoint } from './ir-auto-save.svelte';

/**
 * 比較値を作る
 */
function checkpoint(irHash: string, commentsHash: string): AutoSaveCheckpoint {
	return { irHash, commentsHash };
}

describe('selectAutoSaveTiming', () => {
	it('saves IR on the short delay when the IR hash differs', () => {
		expect(selectAutoSaveTiming(checkpoint('a', 'c'), checkpoint('b', 'c'))).toBe('ir');
	});

	it('saves comments on the longer delay when only comments differ', () => {
		expect(selectAutoSaveTiming(checkpoint('a', 'c'), checkpoint('a', 'd'))).toBe('comments');
	});

	it('does not save when the checkpoint already matches', () => {
		expect(selectAutoSaveTiming(checkpoint('a', 'c'), checkpoint('a', 'c'))).toBe('none');
	});

	it('still sees a dirty IR hash after the checkpoint object is kept', () => {
		const saved = checkpoint('seed', 'comments');
		const edited = checkpoint('edited', 'comments');

		expect(selectAutoSaveTiming(saved, edited)).toBe('ir');
		saved.irHash = edited.irHash;
		saved.commentsHash = edited.commentsHash;
		expect(selectAutoSaveTiming(saved, edited)).toBe('none');
	});
});
