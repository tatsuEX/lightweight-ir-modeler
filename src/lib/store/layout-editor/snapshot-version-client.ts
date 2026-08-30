import type { IrSnapshot } from '$lib/ir/snapshot';
import type { PublishKind, PublishedVersionsListing } from '$lib/ir/snapshot-version';
import type { YamlCommentMap } from '$lib/utils/yaml-comments';

export type { PublishedVersionsListing };

/** クライアントが受け取る snapshot（コメント付き） */
export type LoadedWorkingSnapshot = IrSnapshot & {
	comments: YamlCommentMap;
};

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
		body: JSON.stringify({ logicalId, mode })
	});
	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(payload?.error ?? `publish failed: ${response.status}`);
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
		body: JSON.stringify({ logicalId, version })
	});
	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(payload?.error ?? `load version failed: ${response.status}`);
	}

	return (await response.json()) as LoadedWorkingSnapshot;
}
