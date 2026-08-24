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
 * コンポーネント external 配下コメントのオーナキーを作る
 */
export function componentExternalCommentKey(componentId: string, relativeYamlPath: string): string {
	return `${COMPONENT_EXTERNAL_PREFIX}${componentId}:${relativeYamlPath}`;
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
 * パスが `components[n].external` 以下か判定する
 */
function isComponentExternalPath(segments: readonly YamlPathSegment[]): boolean {
	return (
		segments.length >= 3 &&
		segments[0].type === 'key' &&
		segments[0].key === 'components' &&
		segments[1].type === 'index' &&
		segments[2].type === 'key' &&
		segments[2].key === 'external'
	);
}

/**
 * パスが `uiDefinition.external` 以下か判定する
 */
function isUiDefinitionExternalPath(segments: readonly YamlPathSegment[]): boolean {
	return (
		segments.length >= 2 &&
		segments[0].type === 'key' &&
		segments[0].key === 'uiDefinition' &&
		segments[1].type === 'key' &&
		segments[1].key === 'external'
	);
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

		if (isComponentExternalPath(segments) && segments[1].type === 'index') {
			const id = componentIds[segments[1].index];
			if (id) {
				const relative = stringifyYamlKeyPath(segments.slice(2));
				result[componentExternalCommentKey(id, relative)] = normalized;
			}
			continue;
		}

		if (isUiDefinitionExternalPath(segments)) {
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

		if (ownerKey.startsWith(COMPONENT_EXTERNAL_PREFIX)) {
			const rest = ownerKey.slice(COMPONENT_EXTERNAL_PREFIX.length);
			const sep = rest.indexOf(':');
			if (sep <= 0) {
				continue;
			}
			const id = rest.slice(0, sep);
			const relative = rest.slice(sep + 1);
			const index = idToIndex.get(id);
			if (index === undefined) {
				continue;
			}
			result[joinYamlKeyPath(`components[${index}]`, relative)] = normalized;
			continue;
		}

		if (ownerKey.startsWith(COMPONENT_PREFIX) && !ownerKey.startsWith(COMPONENT_EXTERNAL_PREFIX)) {
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
 * 残っている component id 以外のコンポーネントコメントを落とす
 */
export function retainOwnerCommentsForComponentIds(
	ownerComments: OwnerCommentMap,
	componentIds: ReadonlySet<string>
): OwnerCommentMap {
	const result: OwnerCommentMap = {};

	for (const [key, value] of Object.entries(ownerComments)) {
		if (key.startsWith(COMPONENT_EXTERNAL_PREFIX)) {
			const rest = key.slice(COMPONENT_EXTERNAL_PREFIX.length);
			const sep = rest.indexOf(':');
			const id = sep > 0 ? rest.slice(0, sep) : '';
			if (!componentIds.has(id)) {
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
