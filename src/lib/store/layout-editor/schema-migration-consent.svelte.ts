import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';

/** 同意ダイアログに出す内容 */
export type PendingSchemaConsent = {
	logicalId: string;
	rationales: readonly string[];
	schemaVersion: string;
	latest: string;
};

let consentedLogicalId = '';
let blockedLogicalId = '';
let epoch = $state(0);
let pending = $state<PendingSchemaConsent | null>(null);
let acceptRetry: (() => void) | null = null;

/**
 * この logicalId の破壊的 migration に同意済みか
 */
export function hasSchemaMigrationConsent(logicalId: string): boolean {
	const trimmed = logicalId.trim();
	return trimmed !== '' && consentedLogicalId === trimmed;
}

/**
 * 同意が取れるまで自動保存を止める対象か
 */
export function isSchemaMigrationSaveBlocked(logicalId: string): boolean {
	const trimmed = logicalId.trim();
	return trimmed !== '' && blockedLogicalId === trimmed;
}

/**
 * 同意または拒否が変わるたびに増える。auto-save の effect がこれを読む
 */
export function schemaMigrationEpoch(): number {
	return epoch;
}

/**
 * 表示中の同意要求
 */
export function pendingSchemaConsent(): PendingSchemaConsent | null {
	return pending;
}

/**
 * 指定 logicalId の自動保存を止める
 */
export function blockSchemaMigrationSave(logicalId: string): void {
	blockedLogicalId = logicalId.trim();
	epoch += 1;
}

/**
 * 破壊的 migration への同意を記録し、同じ logicalId の保存停止を解く
 */
export function markSchemaMigrationConsent(logicalId: string): void {
	const trimmed = logicalId.trim();
	consentedLogicalId = trimmed;
	if (blockedLogicalId === trimmed) {
		blockedLogicalId = '';
	}
	epoch += 1;
}

/**
 * 同意ダイアログを開く
 *
 * `onAccept` は current の再読込以外（確定版の読込など）をやり直すときだけ渡す。
 */
export function requestSchemaConsent(next: PendingSchemaConsent, onAccept?: () => void): void {
	pending = next;
	acceptRetry = onAccept ?? null;
	epoch += 1;
}

/**
 * 同意ダイアログを閉じ、登録されたやり直し関数を返す
 */
export function dismissSchemaConsent(): (() => void) | null {
	const retry = acceptRetry;
	pending = null;
	acceptRetry = null;
	epoch += 1;
	return retry;
}
