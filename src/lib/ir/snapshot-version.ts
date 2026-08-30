/** 画面定義 version（`<main>.<sub>`） */
export type SnapshotVersion = {
	main: number;
	sub: number;
};

/** 確定の系統 */
export type PublishKind = 'revision' | 'patch' | 'new-head';

const VERSION_PATTERN = /^(\d+)\.(\d+)$/;

/**
 * version 文字列を main.sub に分解する（不正なら null）
 */
export function parseSnapshotVersion(value: string): SnapshotVersion | null {
	const matched = VERSION_PATTERN.exec(value.trim());
	if (!matched) {
		return null;
	}

	return { main: Number(matched[1]), sub: Number(matched[2]) };
}

/**
 * main.sub を version 文字列にする
 */
export function formatSnapshotVersion(version: SnapshotVersion): string {
	return `${version.main}.${version.sub}`;
}

/**
 * version として妥当か判定する
 */
export function isValidSnapshotVersion(value: string): boolean {
	return parseSnapshotVersion(value) !== null;
}

/**
 * version をディレクトリ名として安全か検証して返す
 */
export function assertSafeVersionPathSegment(value: string): string {
	const trimmed = value.trim();
	if (!isValidSnapshotVersion(trimmed)) {
		throw new Error(`invalid snapshot version for path: ${value}`);
	}

	return trimmed;
}

/**
 * version を比較する（main 優先、同 main なら sub）
 */
export function compareSnapshotVersions(left: SnapshotVersion, right: SnapshotVersion): number {
	if (left.main !== right.main) {
		return left.main - right.main;
	}

	return left.sub - right.sub;
}

/**
 * 文字列 version を比較する（不正な値は末尾）
 */
export function compareSnapshotVersionStrings(left: string, right: string): number {
	const parsedLeft = parseSnapshotVersion(left);
	const parsedRight = parseSnapshotVersion(right);
	if (!parsedLeft && !parsedRight) {
		return left.localeCompare(right);
	}
	if (!parsedLeft) {
		return 1;
	}
	if (!parsedRight) {
		return -1;
	}

	return compareSnapshotVersions(parsedLeft, parsedRight);
}

/**
 * 有効な version 文字列だけを昇順で返す
 */
export function sortSnapshotVersionStrings(versions: readonly string[]): string[] {
	return versions
		.filter((value) => isValidSnapshotVersion(value))
		.sort(compareSnapshotVersionStrings);
}

/**
 * HEAD（main 最大、同 main なら sub 最大）を返す
 */
export function findHeadVersion(versions: readonly string[]): string | null {
	const sorted = sortSnapshotVersionStrings(versions);

	return sorted.at(-1) ?? null;
}

/**
 * 各 main の最新 sub だけを返す（UI の選択候補）
 */
export function selectablePublishedVersions(versions: readonly string[]): string[] {
	const latestByMain = new Map<number, SnapshotVersion>();

	for (const value of versions) {
		const parsed = parseSnapshotVersion(value);
		if (!parsed) {
			continue;
		}

		const current = latestByMain.get(parsed.main);
		if (!current || compareSnapshotVersions(parsed, current) > 0) {
			latestByMain.set(parsed.main, parsed);
		}
	}

	return [...latestByMain.values()]
		.sort(compareSnapshotVersions)
		.map(formatSnapshotVersion);
}

/** 確定時の系統選択コンテキスト */
export type PublishContext = 'first' | 'head' | 'past';

/**
 * 確定の系統コンテキストを返す
 *
 * - `first`: まだ確定版が無い（→ `1.0` のみ）
 * - `past`: basedOn が HEAD より古い（→ パッチ or 新たな正本）
 * - `head`: HEAD の作業コピー（→ パッチ or 改版）
 */
export function getPublishContext(versions: readonly string[], basedOn: string | undefined): PublishContext {
	const head = findHeadVersion(versions);
	if (!head) {
		return 'first';
	}

	const parsedBasedOn = basedOn ? parseSnapshotVersion(basedOn) : null;
	const parsedHead = parseSnapshotVersion(head);
	if (parsedBasedOn && parsedHead && compareSnapshotVersions(parsedBasedOn, parsedHead) < 0) {
		return 'past';
	}

	return 'head';
}

/**
 * 過去版（HEAD より古い basedOn）を編集中か判定する
 */
export function isEditingPastPublishedVersion(
	versions: readonly string[],
	basedOn: string | undefined
): boolean {
	return getPublishContext(versions, basedOn) === 'past';
}

/**
 * 次に確定する version を決める
 */
export function resolveNextPublishedVersion(
	existing: readonly string[],
	basedOn: string | undefined,
	kind: PublishKind
): string {
	const context = getPublishContext(existing, basedOn);
	const head = findHeadVersion(existing);

	if (context === 'first') {
		if (kind !== 'revision') {
			throw new Error('first publish must use revision');
		}

		return formatSnapshotVersion({ main: 1, sub: 0 });
	}

	if (context === 'past' && kind === 'revision') {
		throw new Error('publish from a past version requires patch or new-head');
	}

	if (context === 'head' && kind === 'new-head') {
		throw new Error('new-head is only allowed when basedOn is older than HEAD');
	}

	if (kind === 'patch') {
		const parsedBase =
			parseSnapshotVersion(basedOn ?? '') ?? (head ? parseSnapshotVersion(head) : null);
		if (!parsedBase) {
			throw new Error('patch publish requires basedOn or HEAD');
		}

		let maxSub = parsedBase.sub;
		for (const value of existing) {
			const parsed = parseSnapshotVersion(value);
			if (parsed && parsed.main === parsedBase.main && parsed.sub > maxSub) {
				maxSub = parsed.sub;
			}
		}

		return formatSnapshotVersion({ main: parsedBase.main, sub: maxSub + 1 });
	}

	if (!head) {
		throw new Error('HEAD version is required');
	}

	const parsedHead = parseSnapshotVersion(head);
	if (!parsedHead) {
		throw new Error(`invalid HEAD version: ${head}`);
	}

	return formatSnapshotVersion({ main: parsedHead.main + 1, sub: 0 });
}

/**
 * 確定版 1 件の一覧用要約（ディレクトリ名以外のユーザ向け識別）
 *
 * WARN: いまは各 `versions/<v>/snapshot.yml` から埋める。将来 versions 直下の cache で
 * 同じ形を返してもよい（検索容易性）。API の `summaries` 形は変えない。
 */
export type PublishedVersionSummary = {
	version: string;
	changeReason?: string;
};

/**
 * 確定版一覧の API 応答
 */
export type PublishedVersionsListing = {
	versions: string[];
	head: string | null;
	selectable: string[];
	summaries: PublishedVersionSummary[];
};

/** 確定版が無いときの一覧 */
export const EMPTY_PUBLISHED_VERSIONS_LISTING: PublishedVersionsListing = {
	versions: [],
	head: null,
	selectable: [],
	summaries: []
};

/**
 * ユーザ向けの版識別ラベルを作る（changeReason を主、version を括弧で併記）
 */
export function formatPublishedVersionLabel(
	version: string,
	changeReason?: string,
	options?: { head?: boolean }
): string {
	const trimmedReason = changeReason?.trim() ?? '';
	const identity = trimmedReason.length > 0 ? `${trimmedReason} (${version})` : version;

	return options?.head ? `${identity} (HEAD)` : identity;
}

/**
 * 一覧 summaries から指定 version の changeReason を取る
 */
export function findPublishedChangeReason(
	summaries: readonly PublishedVersionSummary[] | undefined,
	version: string
): string | undefined {
	return summaries?.find((entry) => entry.version === version)?.changeReason;
}
