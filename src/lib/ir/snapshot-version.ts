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

/**
 * 過去版（HEAD より古い basedOn）からの確定で系統選択が必要か判定する
 */
export function needsPublishKindChoice(versions: readonly string[], basedOn: string | undefined): boolean {
	const head = findHeadVersion(versions);
	const parsedBasedOn = basedOn ? parseSnapshotVersion(basedOn) : null;
	const parsedHead = head ? parseSnapshotVersion(head) : null;
	if (!parsedBasedOn || !parsedHead) {
		return false;
	}

	return compareSnapshotVersions(parsedBasedOn, parsedHead) < 0;
}

/**
 * 次に確定する version を決める
 */
export function resolveNextPublishedVersion(
	existing: readonly string[],
	basedOn: string | undefined,
	kind: PublishKind
): string {
	const head = findHeadVersion(existing);
	if (!head) {
		if (kind !== 'revision') {
			throw new Error('first publish must use revision');
		}

		return formatSnapshotVersion({ main: 1, sub: 0 });
	}

	const choiceNeeded = needsPublishKindChoice(existing, basedOn);
	if (choiceNeeded && kind === 'revision') {
		throw new Error('publish from a past version requires patch or new-head');
	}
	if (!choiceNeeded && kind !== 'revision') {
		throw new Error('patch and new-head are only allowed when basedOn is older than HEAD');
	}

	if (kind === 'patch') {
		const parsedBasedOn = parseSnapshotVersion(basedOn ?? '');
		if (!parsedBasedOn) {
			throw new Error('patch publish requires basedOn');
		}

		let maxSub = parsedBasedOn.sub;
		for (const value of existing) {
			const parsed = parseSnapshotVersion(value);
			if (parsed && parsed.main === parsedBasedOn.main && parsed.sub > maxSub) {
				maxSub = parsed.sub;
			}
		}

		return formatSnapshotVersion({ main: parsedBasedOn.main, sub: maxSub + 1 });
	}

	const parsedHead = parseSnapshotVersion(head);
	if (!parsedHead) {
		throw new Error(`invalid HEAD version: ${head}`);
	}

	return formatSnapshotVersion({ main: parsedHead.main + 1, sub: 0 });
}
