import type { IrSnapshot } from '$lib/ir/snapshot';
import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';
import type { PublishKind, PublishedVersionsListing } from '$lib/ir/snapshot-version';
import type { YamlCommentMap } from '$lib/utils/yaml-comments';
import { hasSchemaMigrationConsent } from './schema-migration-consent.svelte';

export type { PublishedVersionsListing };

/** クライアントが受け取る snapshot（コメント付き） */
export type LoadedWorkingSnapshot = IrSnapshot & {
	comments: YamlCommentMap;
};

/**
 * 失敗応答が schemaVersion ブロックか判定する
 */
function readSchemaBlock(value: unknown): SnapshotSchemaBlock | null {
	if (value === null || typeof value !== 'object') {
		return null;
	}
	const code = (value as { code?: unknown }).code;
	if (
		code !== 'schema-future' &&
		code !== 'schema-unreadable' &&
		code !== 'schema-no-path' &&
		code !== 'schema-consent'
	) {
		return null;
	}
	return value as SnapshotSchemaBlock;
}

/**
 * 失敗応答から表示用の文を作る
 */
export function snapshotFailureMessage(block: SnapshotSchemaBlock | null, fallback: string): string {
	if (!block) {
		return fallback;
	}
	const lines = [block.error, ...block.rationales.filter((line) => line.trim() !== '')];
	return lines.join('\n');
}

/**
 * schemaVersion の失敗を、同意のやり直しに使える形で持つ
 */
export class SnapshotSchemaRequestError extends Error {
	readonly block: SnapshotSchemaBlock;

	/**
	 * schemaVersion 失敗のエラーを作る
	 */
	constructor(block: SnapshotSchemaBlock) {
		super(snapshotFailureMessage(block, block.error));
		this.name = 'SnapshotSchemaRequestError';
		this.block = block;
	}
}

/**
 * 失敗 JSON をエラーにする
 */
async function throwSnapshotResponse(response: Response, fallback: string): Promise<never> {
	const payload = await response.json().catch(() => null);
	const block = readSchemaBlock(payload);
	if (block) {
		throw new SnapshotSchemaRequestError(block);
	}
	const errorText =
		payload !== null && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
			? (payload as { error: string }).error
			: fallback;
	throw new Error(errorText);
}

/**
 * 確定版一覧を取得する
 */
export async function fetchPublishedVersions(logicalId: string): Promise<PublishedVersionsListing> {
	const response = await fetch(`/api/ir/snapshot/versions?logicalId=${encodeURIComponent(logicalId)}`);
	if (!response.ok) {
		throw new Error(`published versions list failed: ${response.status}`);
	}

	return (await response.json()) as PublishedVersionsListing;
}

/**
 * 編集中 snapshot を確定する
 */
export async function publishWorkingSnapshot(
	logicalId: string,
	mode: PublishKind = 'revision'
): Promise<{ version: string; snapshot: LoadedWorkingSnapshot }> {
	const response = await fetch('/api/ir/snapshot/publish', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			logicalId,
			mode,
			...(hasSchemaMigrationConsent(logicalId) ? { confirmMigration: true } : {})
		})
	});
	if (!response.ok) {
		await throwSnapshotResponse(response, `publish failed: ${response.status}`);
	}

	return (await response.json()) as { version: string; snapshot: LoadedWorkingSnapshot };
}

/**
 * 確定版を編集中コピーへ載せる
 */
export async function loadWorkingSnapshotFromVersion(
	logicalId: string,
	version: string
): Promise<LoadedWorkingSnapshot> {
	const response = await fetch('/api/ir/snapshot/load-version', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			logicalId,
			version,
			...(hasSchemaMigrationConsent(logicalId) ? { confirmMigration: true } : {})
		})
	});
	if (!response.ok) {
		await throwSnapshotResponse(response, `load version failed: ${response.status}`);
	}

	return (await response.json()) as LoadedWorkingSnapshot;
}
