import { describe, expect, it } from 'vitest';
import {
	assertSafeLogicalIdPathSegment,
	buildSnapshotMetaForWrite,
	createEmptyUiDefinitionMeta,
	DEFAULT_UI_DEFINITION_VERSION,
	isUiDefinitionMetaReady,
	isValidLogicalId,
	toEditorMeta
} from '$lib/ir/ui-definition-meta';

describe('ui-definition-meta', () => {
	it('provides default version', () => {
		expect(DEFAULT_UI_DEFINITION_VERSION).toBe('1.0');
		expect(createEmptyUiDefinitionMeta().version).toBe(DEFAULT_UI_DEFINITION_VERSION);
	});

	it('validates logicalId', () => {
		expect(isValidLogicalId('userRegistration')).toBe(true);
		expect(isValidLogicalId('')).toBe(false);
		expect(isValidLogicalId('1invalid')).toBe(false);
		expect(isValidLogicalId('../escape')).toBe(false);
	});

	it('checks required meta fields', () => {
		expect(isUiDefinitionMetaReady({ logicalId: 'screenA', name: 'Screen A' })).toBe(true);
		expect(isUiDefinitionMetaReady({ logicalId: '', name: 'Screen A' })).toBe(false);
		expect(isUiDefinitionMetaReady({ logicalId: 'screenA', name: '  ' })).toBe(false);
	});

	it('assertSafeLogicalIdPathSegment rejects unsafe values', () => {
		expect(assertSafeLogicalIdPathSegment('screenA')).toBe('screenA');
		expect(() => assertSafeLogicalIdPathSegment('../bad')).toThrow(/invalid logicalId/);
	});

	it('buildSnapshotMetaForWrite sets createdAt and modifiedAt on first write', () => {
		const editorMeta = {
			...createEmptyUiDefinitionMeta(),
			logicalId: 'screenA',
			name: 'Screen A'
		};
		const now = new Date('2026-08-07T10:00:00.000Z');
		const written = buildSnapshotMetaForWrite(editorMeta, null, now);

		expect(written.createdAt).toBe('2026-08-07T10:00:00.000Z');
		expect(written.modifiedAt).toBe('2026-08-07T10:00:00.000Z');
		expect(toEditorMeta(written)).toEqual(editorMeta);
	});

	it('keeps basedOn and drops releasedAt in toEditorMeta', () => {
		const editor = toEditorMeta({
			...createEmptyUiDefinitionMeta(),
			logicalId: 'screenA',
			name: 'Screen A',
			basedOn: '1.0',
			createdAt: '2026-08-07T10:00:00.000Z',
			modifiedAt: '2026-08-07T11:00:00.000Z',
			releasedAt: '2026-08-07T12:00:00.000Z'
		});

		expect(editor.basedOn).toBe('1.0');
		expect(editor).not.toHaveProperty('releasedAt');
		expect(editor).not.toHaveProperty('createdAt');
	});

	it('buildSnapshotMetaForWrite preserves createdAt and updates modifiedAt', () => {
		const editorMeta = {
			...createEmptyUiDefinitionMeta(),
			logicalId: 'screenA',
			name: 'Screen A Updated'
		};
		const previous = buildSnapshotMetaForWrite(
			{ ...editorMeta, name: 'Screen A' },
			null,
			new Date('2026-08-07T10:00:00.000Z')
		);
		const written = buildSnapshotMetaForWrite(editorMeta, previous, new Date('2026-08-07T11:00:00.000Z'));

		expect(written.createdAt).toBe('2026-08-07T10:00:00.000Z');
		expect(written.modifiedAt).toBe('2026-08-07T11:00:00.000Z');
	});
});
