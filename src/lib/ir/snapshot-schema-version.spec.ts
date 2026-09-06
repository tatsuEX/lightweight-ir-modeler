import { describe, expect, it } from 'vitest';
import {
	classifyIrSchemaVersion,
	compareIrSchemaVersions,
	CURRENT_IR_SCHEMA_VERSION,
	formatIrSchemaVersion,
	isValidIrSchemaVersion,
	parseIrSchemaVersion
} from '$lib/ir/snapshot-schema-version';

describe('ir snapshot schema version', () => {
	it('parses <main>.<sub>', () => {
		expect(parseIrSchemaVersion('1.0')).toEqual({ main: 1, sub: 0 });
		expect(parseIrSchemaVersion(' 2.13 ')).toEqual({ main: 2, sub: 13 });
	});

	it('rejects non <main>.<sub> notations', () => {
		expect(parseIrSchemaVersion('1')).toBeNull();
		expect(parseIrSchemaVersion('1.0.0')).toBeNull();
		expect(parseIrSchemaVersion('v1.0')).toBeNull();
		expect(parseIrSchemaVersion('')).toBeNull();
		expect(isValidIrSchemaVersion('1.0.0')).toBe(false);
	});

	it('formats back to the parsed notation', () => {
		expect(formatIrSchemaVersion({ main: 3, sub: 7 })).toBe('3.7');
	});

	it('compares main before sub', () => {
		expect(compareIrSchemaVersions({ main: 1, sub: 9 }, { main: 2, sub: 0 })).toBeLessThan(0);
		expect(compareIrSchemaVersions({ main: 1, sub: 2 }, { main: 1, sub: 1 })).toBeGreaterThan(0);
		expect(compareIrSchemaVersions({ main: 1, sub: 0 }, { main: 1, sub: 0 })).toBe(0);
	});

	it('classifies a snapshot newer than this build as future', () => {
		expect(classifyIrSchemaVersion('2.0', '1.3').kind).toBe('future');
		expect(classifyIrSchemaVersion('1.4', '1.3').kind).toBe('future');
	});

	it('classifies an equal schema version as current', () => {
		expect(classifyIrSchemaVersion('1.3', '1.3').kind).toBe('current');
	});

	it('classifies an older sub within the same main as auto-migratable', () => {
		expect(classifyIrSchemaVersion('1.0', '1.3').kind).toBe('auto-migratable');
	});

	it('classifies an older main as consent-required', () => {
		expect(classifyIrSchemaVersion('1.9', '2.0').kind).toBe('consent-required');
	});

	it('classifies a malformed schema version as unreadable', () => {
		expect(classifyIrSchemaVersion('nope', '1.0').kind).toBe('unreadable');
	});

	it('treats the current build version as current by default', () => {
		expect(classifyIrSchemaVersion(CURRENT_IR_SCHEMA_VERSION).kind).toBe('current');
	});
});
