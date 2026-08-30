import { describe, expect, it } from 'vitest';
import {
	assertSafeVersionPathSegment,
	findHeadVersion,
	formatSnapshotVersion,
	isValidSnapshotVersion,
	needsPublishKindChoice,
	parseSnapshotVersion,
	resolveNextPublishedVersion,
	selectablePublishedVersions
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

	it('requires a kind choice only when basedOn is older than HEAD', () => {
		expect(needsPublishKindChoice(['1.0'], undefined)).toBe(false);
		expect(needsPublishKindChoice(['1.0'], '1.0')).toBe(false);
		expect(needsPublishKindChoice(['1.0', '2.0'], '1.0')).toBe(true);
		expect(needsPublishKindChoice(['2.3'], '2.3')).toBe(false);
	});

	it('resolves first publish and normal revision', () => {
		expect(resolveNextPublishedVersion([], undefined, 'revision')).toBe('1.0');
		expect(resolveNextPublishedVersion(['1.0'], undefined, 'revision')).toBe('2.0');
		expect(resolveNextPublishedVersion(['2.3'], '2.3', 'revision')).toBe('3.0');
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
		expect(() => resolveNextPublishedVersion(['1.0'], undefined, 'patch')).toThrow(
			/only allowed when basedOn/
		);
		expect(() => resolveNextPublishedVersion([], undefined, 'new-head')).toThrow(/first publish/);
	});
});
