import { describe, expect, it } from 'vitest';
import {
	assertSafeVersionPathSegment,
	findHeadVersion,
	formatSnapshotVersion,
	isValidSnapshotVersion,
	getPublishContext,
	isEditingPastPublishedVersion,
	parseSnapshotVersion,
	resolveNextPublishedVersion,
	selectablePublishedVersions,
	formatPublishedVersionLabel,
	findPublishedChangeReason
} from '$lib/ir/snapshot-version';

describe('snapshot-version', () => {
	it('parses and formats main.sub', () => {
		expect(parseSnapshotVersion('1.0')).toEqual({ main: 1, sub: 0 });
		expect(parseSnapshotVersion('2.3')).toEqual({ main: 2, sub: 3 });
		expect(formatSnapshotVersion({ main: 1, sub: 0 })).toBe('1.0');
		expect(isValidSnapshotVersion('1.0.0')).toBe(false);
		expect(isValidSnapshotVersion('../1.0')).toBe(false);
		expect(assertSafeVersionPathSegment('1.0')).toBe('1.0');
		expect(() => assertSafeVersionPathSegment('1.0.0')).toThrow(/invalid snapshot version/);
	});

	it('finds HEAD and selectable latest sub per main', () => {
		const versions = ['1.0', '1.1', '2.0', '2.3'];
		expect(findHeadVersion(versions)).toBe('2.3');
		expect(selectablePublishedVersions(versions)).toEqual(['1.1', '2.3']);
		expect(findHeadVersion([])).toBeNull();
	});

	it('classifies publish context', () => {
		expect(getPublishContext([], undefined)).toBe('first');
		expect(getPublishContext(['1.0'], undefined)).toBe('head');
		expect(getPublishContext(['1.0'], '1.0')).toBe('head');
		expect(getPublishContext(['1.0', '2.0'], '1.0')).toBe('past');
		expect(isEditingPastPublishedVersion(['2.3'], '2.3')).toBe(false);
		expect(isEditingPastPublishedVersion(['1.0', '2.0'], '1.0')).toBe(true);
	});

	it('resolves first publish and normal revision', () => {
		expect(resolveNextPublishedVersion([], undefined, 'revision')).toBe('1.0');
		expect(resolveNextPublishedVersion(['1.0'], undefined, 'revision')).toBe('2.0');
		expect(resolveNextPublishedVersion(['2.3'], '2.3', 'revision')).toBe('3.0');
	});

	it('resolves patch from HEAD as same-main sub increment', () => {
		expect(resolveNextPublishedVersion(['1.0'], undefined, 'patch')).toBe('1.1');
		expect(resolveNextPublishedVersion(['2.3'], '2.3', 'patch')).toBe('2.4');
		expect(resolveNextPublishedVersion(['1.0', '2.0'], undefined, 'patch')).toBe('2.1');
	});

	it('resolves patch and new-head from a past version', () => {
		expect(resolveNextPublishedVersion(['1.0', '2.0'], '1.0', 'patch')).toBe('1.1');
		expect(resolveNextPublishedVersion(['1.0', '2.3'], '2.3', 'revision')).toBe('3.0');
		expect(resolveNextPublishedVersion(['1.0', '2.0'], '1.0', 'new-head')).toBe('3.0');
		expect(resolveNextPublishedVersion(['2.3', '5.1'], '2.3', 'new-head')).toBe('6.0');
		expect(resolveNextPublishedVersion(['2.3', '5.1'], '2.3', 'patch')).toBe('2.4');
	});

	it('rejects mismatched kind', () => {
		expect(() => resolveNextPublishedVersion(['1.0', '2.0'], '1.0', 'revision')).toThrow(
			/patch or new-head/
		);
		expect(() => resolveNextPublishedVersion(['1.0'], undefined, 'new-head')).toThrow(
			/only allowed when basedOn/
		);
		expect(() => resolveNextPublishedVersion([], undefined, 'patch')).toThrow(/first publish/);
		expect(() => resolveNextPublishedVersion([], undefined, 'new-head')).toThrow(/first publish/);
	});

	it('formats user-facing version labels from changeReason', () => {
		expect(formatPublishedVersionLabel('1.0')).toBe('1.0');
		expect(formatPublishedVersionLabel('1.0', '初回リリース')).toBe('初回リリース (1.0)');
		expect(formatPublishedVersionLabel('2.0', '正本切替', { head: true })).toBe('正本切替 (2.0) (最新版)');
		expect(findPublishedChangeReason([{ version: '1.0', changeReason: '初回' }], '1.0')).toBe('初回');
		expect(findPublishedChangeReason(undefined, '1.0')).toBeUndefined();
	});
});
