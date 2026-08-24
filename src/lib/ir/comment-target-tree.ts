import { SNAPSHOT_YAML_PREFERRED_KEYS } from '$lib/ir/snapshot';
import {
	UI_DEFINITION_COMMENT_KEY,
	componentCommentKey,
	componentRelCommentKey
} from '$lib/ir/snapshot-comment-map';
import { joinYamlKeyPath, stringifyYamlKeyPath, type YamlPathSegment } from '$lib/ir/snapshot-comment-path';

/** コメント対象ツリーの 1 ノード */
export type CommentTreeNode = {
	label: string;
	ownerKey: string;
	title: string;
	children: CommentTreeNode[];
};

/** セグメント列からオーナキーと見出しを決める */
type OwnerResolver = (segments: readonly YamlPathSegment[]) => { ownerKey: string; title: string };

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(candidate: unknown): candidate is Record<string, unknown> {
	return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate);
}

/**
 * snapshot と同じ優先順で object キーを並べる
 */
function sortedObjectKeys(value: Record<string, unknown>, skipKeys: ReadonlySet<string>): string[] {
	const preferred = SNAPSHOT_YAML_PREFERRED_KEYS.filter((key) => key in value && !skipKeys.has(key));
	const rest = Object.keys(value)
		.filter((key) => !skipKeys.has(key) && !preferred.includes(key))
		.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
	return [...preferred, ...rest];
}

/**
 * 値をコメント対象ツリーの子にする
 */
function buildChildren(
	candidate: unknown,
	segments: readonly YamlPathSegment[],
	resolve: OwnerResolver,
	skipKeys: ReadonlySet<string>
): CommentTreeNode[] {
	if (Array.isArray(candidate)) {
		return candidate.map((item, index) => {
			const next = [...segments, { type: 'index' as const, index }];
			const keys = resolve(next);
			return {
				label: `[${index}]`,
				...keys,
				children: buildChildren(item, next, resolve, new Set())
			};
		});
	}

	if (!isPlainObject(candidate)) {
		return [];
	}

	return sortedObjectKeys(candidate, skipKeys).map((key) => {
		const next = [...segments, { type: 'key' as const, key }];
		const keys = resolve(next);
		return {
			label: key,
			...keys,
			children: buildChildren(candidate[key], next, resolve, new Set())
		};
	});
}

/**
 * uiDefinition メタからコメント対象ツリーを作る
 */
export function buildUiDefinitionCommentTree(meta: Record<string, unknown>): CommentTreeNode {
	const rootSegments: YamlPathSegment[] = [{ type: 'key', key: 'uiDefinition' }];
	return {
		label: 'uiDefinition',
		ownerKey: UI_DEFINITION_COMMENT_KEY,
		title: UI_DEFINITION_COMMENT_KEY,
		children: buildChildren(meta, rootSegments, (segments) => {
			const title = stringifyYamlKeyPath(segments);
			return { ownerKey: title, title };
		}, new Set())
	};
}

/**
 * コンポーネントからコメント対象ツリーを作る
 *
 * WARN: snapshot に出ない `id` はツリーに載せない。
 */
export function buildComponentCommentTree(component: Record<string, unknown> & { id: string }): CommentTreeNode {
	const id = component.id;
	const logicalId = typeof component.logicalId === 'string' ? component.logicalId : '';
	const displayRoot = logicalId !== '' ? `components[${logicalId}]` : 'component';

	return {
		label: logicalId !== '' ? logicalId : typeof component.type === 'string' ? component.type : 'component',
		ownerKey: componentCommentKey(id),
		title: displayRoot,
		children: buildChildren(component, [], (segments) => {
			const relative = stringifyYamlKeyPath(segments);
			return {
				ownerKey: componentRelCommentKey(id, relative),
				title: joinYamlKeyPath(displayRoot, relative)
			};
		}, new Set(['id']))
	};
}
