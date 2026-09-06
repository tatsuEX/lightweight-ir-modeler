import { describe, expect, it } from 'vitest';
import {
	IR_SNAPSHOT_MIGRATION_STEPS,
	IrSnapshotMigrationConsentError,
	IrSnapshotSchemaVersionError,
	migrateIrSnapshotRecord,
	readRecordSchemaVersion,
	type IrSnapshotMigrationStep
} from '$lib/ir/snapshot-migration';

const legacyRecord = () => ({
	version: 1,
	savedAt: '2026-08-25T00:00:00.000Z',
	uiDefinition: { logicalId: 'userRegistration', version: '1.2' },
	components: [{ type: 'textbox' }]
});

/** sub のみ進む step 列（自動 migration 用の検証データ） */
const subOnlySteps: readonly IrSnapshotMigrationStep[] = [
	{
		from: '1.0',
		to: '1.1',
		rationale: 'キー追加のみ',
		migrate: (record) => ({ ...record, addedAt11: true })
	},
	{
		from: '1.1',
		to: '1.2',
		rationale: '既定値の補完のみ',
		migrate: (record) => ({ ...record, addedAt12: true })
	}
];

/** main をまたぐ step 列（同意確認の検証データ） */
const mainCrossSteps: readonly IrSnapshotMigrationStep[] = [
	{
		from: '1.0',
		to: '2.0',
		rationale: 'components の構造を作り替える',
		migrate: (record) => ({ ...record, rebuilt: true })
	}
];

describe('ir snapshot migration', () => {
	it('registers no step while the current schema is the only one', () => {
		expect(IR_SNAPSHOT_MIGRATION_STEPS).toEqual([]);
	});

	it('reads an absent schemaVersion as the baseline', () => {
		expect(readRecordSchemaVersion(legacyRecord())).toBe('1.0');
		expect(readRecordSchemaVersion({ schemaVersion: '  2.4 ' })).toBe('2.4');
		expect(readRecordSchemaVersion({ schemaVersion: '' })).toBe('1.0');
	});

	it('drops the retired envelope version and stamps schemaVersion', () => {
		const result = migrateIrSnapshotRecord(legacyRecord());

		expect(result.record.version).toBeUndefined();
		expect(result.record.schemaVersion).toBe('1.0');
		expect(result.from).toBe('1.0');
		expect(result.to).toBe('1.0');
		expect(result.applied).toEqual([]);
	});

	it('keeps uiDefinition.version untouched', () => {
		const result = migrateIrSnapshotRecord(legacyRecord());

		expect(result.record.uiDefinition).toEqual({
			logicalId: 'userRegistration',
			version: '1.2'
		});
	});

	it('rejects a snapshot newer than this build', () => {
		expect(() => migrateIrSnapshotRecord({ schemaVersion: '9.0' })).toThrow(
			IrSnapshotSchemaVersionError
		);
	});

	it('rejects a malformed schemaVersion', () => {
		expect(() => migrateIrSnapshotRecord({ schemaVersion: 'nope' })).toThrow(
			IrSnapshotSchemaVersionError
		);
	});

	it('reports no migration path when a sub generation has no step', () => {
		expect(() => migrateIrSnapshotRecord({ schemaVersion: '1.0' }, { latest: '1.5' })).toThrow(
			IrSnapshotSchemaVersionError
		);
	});

	it('auto-migrates across sub versions without consent', () => {
		const result = migrateIrSnapshotRecord(
			{ schemaVersion: '1.0', savedAt: 'x', components: [] },
			{ latest: '1.2', steps: subOnlySteps }
		);

		expect(result.record.addedAt11).toBe(true);
		expect(result.record.addedAt12).toBe(true);
		expect(result.record.schemaVersion).toBe('1.2');
		expect(result.applied).toEqual(['1.0 → 1.1', '1.1 → 1.2']);
	});

	it('requires consent when main differs', () => {
		expect(() =>
			migrateIrSnapshotRecord({ schemaVersion: '1.0' }, { latest: '2.0', steps: mainCrossSteps })
		).toThrow(IrSnapshotMigrationConsentError);
	});

	it('surfaces the main-crossing rationale for the consent prompt', () => {
		try {
			migrateIrSnapshotRecord({ schemaVersion: '1.0' }, { latest: '2.0', steps: mainCrossSteps });
			expect.unreachable('consent error expected');
		} catch (error) {
			expect(error).toBeInstanceOf(IrSnapshotMigrationConsentError);
			expect((error as IrSnapshotMigrationConsentError).rationales).toEqual([
				'components の構造を作り替える'
			]);
		}
	});

	it('applies a main-crossing migration once consent is given', () => {
		const result = migrateIrSnapshotRecord(
			{ schemaVersion: '1.0' },
			{ latest: '2.0', steps: mainCrossSteps, confirmMigration: true }
		);

		expect(result.record.rebuilt).toBe(true);
		expect(result.record.schemaVersion).toBe('2.0');
		expect(result.applied).toEqual(['1.0 → 2.0']);
	});
});
