import {
	joinYamlKeyPath,
	parseYamlKeyPath,
	stringifyYamlKeyPath,
	type YamlPathSegment
} from '$lib/ir/snapshot-comment-path';
import { normalizeCommentText, type YamlCommentMap } from '$lib/utils/yaml-comments';

/** エディタ内部のコメントマップ（component は内部 id） */
export type OwnerCommentMap = Record<string, string>;

const COMPONENT_PREFIX = 'component:';
const COMPONENT_REL_PREFIX = 'component-rel:';
/** 旧プレフィックス。読込互換のみ */
const COMPONENT_EXTERNAL_PREFIX = 'component-external:';
const EXTRA_PREFIX = 'extra:';

/**
 * uiDefinition ブロック用のオーナキー
 */
export const UI_DEFINITION_COMMENT_KEY = 'uiDefinition';

/**
 * コンポーネント要素コメントのオーナキーを作る
 */
export function componentCommentKey(componentId: string): string {
	return `${COMPONENT_PREFIX}${componentId}`;
}

/**
 * コンポーネント配下（ドメインキー / external）コメントのオーナキーを作る
 */
export function componentRelCommentKey(componentId: string, relativeYamlPath: string): string {
	return `${COMPONENT_REL_PREFIX}${componentId}:${relativeYamlPath}`;
}

/**
 * コンポーネント external 配下コメントのオーナキーを作る
 */
export function componentExternalCommentKey(componentId: string, relativeYamlPath: string): string {
	return componentRelCommentKey(componentId, relativeYamlPath);
}

/**
 * 手編集など UI 対象外パスを保持するオーナキーを作る
 */
export function extraCommentKey(yamlPath: string): string {
	return `${EXTRA_PREFIX}${yamlPath}`;
}

/**
 * パスが `components[n]` ちょうどか判定する
 */
function isComponentElementPath(segments: readonly YamlPathSegment[]): boolean {
	return (
		segments.length === 2 &&
		segments[0].type === 'key' &&
		segments[0].key === 'components' &&
		segments[1].type === 'index'
	);
}

/**
 * パスが `uiDefinition` 配下か判定する
 */
function isUiDefinitionDescendantPath(segments: readonly YamlPathSegment[]): boolean {
	return segments.length >= 2 && segments[0].type === 'key' && segments[0].key === 'uiDefinition';
}

/**
 * パスが `components[n]` 配下か判定する
 */
function isComponentDescendantPath(segments: readonly YamlPathSegment[]): boolean {
	return (
		segments.length >= 3 &&
		segments[0].type === 'key' &&
		segments[0].key === 'components' &&
		segments[1].type === 'index'
	);
}

/**
 * component-rel / 旧 component-external オーナキーから id と相対パスを取る
 */
function parseComponentRelOwnerKey(ownerKey: string): { id: string; relative: string } | null {
	const prefix = ownerKey.startsWith(COMPONENT_REL_PREFIX)
		? COMPONENT_REL_PREFIX
		: ownerKey.startsWith(COMPONENT_EXTERNAL_PREFIX)
			? COMPONENT_EXTERNAL_PREFIX
			: null;
	if (prefix == null) {
		return null;
	}
	const rest = ownerKey.slice(prefix.length);
	const sep = rest.indexOf(':');
	if (sep <= 0) {
		return null;
	}
	return { id: rest.slice(0, sep), relative: rest.slice(sep + 1) };
}

/**
 * オーナキーが uiDefinition 配下か判定する
 */
export function isUiDefinitionOwnerKey(ownerKey: string): boolean {
	return (
		ownerKey === UI_DEFINITION_COMMENT_KEY ||
		ownerKey.startsWith(`${UI_DEFINITION_COMMENT_KEY}.`) ||
		ownerKey.startsWith(`${UI_DEFINITION_COMMENT_KEY}[`)
	);
}

/**
 * オーナキーからコンポーネント内部 id を取る
 */
export function parseComponentIdFromOwnerKey(ownerKey: string): string | null {
	const rel = parseComponentRelOwnerKey(ownerKey);
	if (rel) {
		return rel.id;
	}
	if (ownerKey.startsWith(COMPONENT_PREFIX)) {
		return ownerKey.slice(COMPONENT_PREFIX.length);
	}
	return null;
}

/**
 * ディスク上の YAML パスマップをエディタ用オーナマップへ変換する
 */
export function ownerCommentsFromYamlMap(
	yamlComments: YamlCommentMap,
	componentIds: readonly string[]
): OwnerCommentMap {
	const result: OwnerCommentMap = {};

	for (const [path, text] of Object.entries(yamlComments)) {
		const normalized = normalizeCommentText(text);
		if (normalized == null) {
			continue;
		}

		let segments: YamlPathSegment[];
		try {
			segments = parseYamlKeyPath(path);
		} catch {
			result[extraCommentKey(path)] = normalized;
			continue;
		}

		if (path === UI_DEFINITION_COMMENT_KEY) {
			result[UI_DEFINITION_COMMENT_KEY] = normalized;
			continue;
		}

		if (isComponentElementPath(segments) && segments[1].type === 'index') {
			const id = componentIds[segments[1].index];
			if (id) {
				result[componentCommentKey(id)] = normalized;
			}
			continue;
		}

		if (isComponentDescendantPath(segments) && segments[1].type === 'index') {
			const id = componentIds[segments[1].index];
			if (id) {
				const relative = stringifyYamlKeyPath(segments.slice(2));
				result[componentRelCommentKey(id, relative)] = normalized;
			}
			continue;
		}

		if (isUiDefinitionDescendantPath(segments)) {
			result[path] = normalized;
			continue;
		}

		result[extraCommentKey(path)] = normalized;
	}

	return result;
}

/**
 * エディタ用オーナマップをディスク用 YAML パスマップへ変換する
 */
export function yamlCommentsFromOwnerMap(
	ownerComments: OwnerCommentMap,
	componentIds: readonly string[]
): YamlCommentMap {
	const result: YamlCommentMap = {};
	const idToIndex = new Map(componentIds.map((id, index) => [id, index]));

	for (const [ownerKey, text] of Object.entries(ownerComments)) {
		const normalized = normalizeCommentText(text);
		if (normalized == null) {
			continue;
		}

		if (ownerKey === UI_DEFINITION_COMMENT_KEY) {
			result[UI_DEFINITION_COMMENT_KEY] = normalized;
			continue;
		}

		const rel = parseComponentRelOwnerKey(ownerKey);
		if (rel) {
			const index = idToIndex.get(rel.id);
			if (index === undefined) {
				continue;
			}
			result[joinYamlKeyPath(`components[${index}]`, rel.relative)] = normalized;
			continue;
		}

		if (ownerKey.startsWith(COMPONENT_PREFIX)) {
			const id = ownerKey.slice(COMPONENT_PREFIX.length);
			const index = idToIndex.get(id);
			if (index === undefined) {
				continue;
			}
			result[`components[${index}]`] = normalized;
			continue;
		}

		if (ownerKey.startsWith(EXTRA_PREFIX)) {
			result[ownerKey.slice(EXTRA_PREFIX.length)] = normalized;
			continue;
		}

		result[ownerKey] = normalized;
	}

	return result;
}

/**
 * オーナマップが同じキー・本文か判定する
 */
export function ownerCommentMapsEqual(left: OwnerCommentMap, right: OwnerCommentMap): boolean {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}
	return leftKeys.every((key) => left[key] === right[key]);
}

/**
 * 残っている component id 以外のコンポーネントコメントを落とす
 */
export function retainOwnerCommentsForComponentIds(
	ownerComments: OwnerCommentMap,
	componentIds: ReadonlySet<string>
): OwnerCommentMap {
	const result: OwnerCommentMap = {};

	for (const [key, value] of Object.entries(ownerComments)) {
		const rel = parseComponentRelOwnerKey(key);
		if (rel) {
			if (!componentIds.has(rel.id)) {
				continue;
			}
		} else if (key.startsWith(COMPONENT_PREFIX)) {
			const id = key.slice(COMPONENT_PREFIX.length);
			if (!componentIds.has(id)) {
				continue;
			}
		}

		result[key] = value;
	}

	return result;
}
