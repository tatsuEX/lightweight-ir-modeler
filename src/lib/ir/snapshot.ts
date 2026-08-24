import { parseYamlDocument, stringifyYamlDocument, createYamlDocument } from '$lib/utils/yaml-document';
import { attachYamlComments, extractYamlComments, type YamlCommentMap } from '$lib/utils/yaml-comments';
import { nanoid } from 'nanoid';
import {
	toEditorMeta,
	type UiDefinitionEditorMeta,
	type UiDefinitionSnapshotMeta
} from '$lib/ir/ui-definition-meta';

/**
 * IR snapshot YAML でシステムメタの次に置くドメインキー
 */
export const SNAPSHOT_YAML_PREFERRED_KEYS: readonly string[] = [
	'uiDefinition',
	'components',
	'logicalId',
	'name',
	'description',
	'type',
	'label',
	'hint',
	'defaultValue',
	'defaultValueFrom',
	'defaultValueTo',
	'disabled',
	'readonly',
	'hidden',
	'tooltip',
	'validation',
	'required',
	'requiredFrom',
	'requiredTo',
	'pattern',
	'minlength',
	'maxlength',
	'min',
	'max',
	'step',
	'minDate',
	'maxDate',
	'minDateTime',
	'maxDateTime',
	'minTime',
	'maxTime',
	'customErrorMessages',
	'items',
	'format',
	'clearable',
	'rows',
	'cols',
	'multiple',
	'autosize',
	'external'
];

/**
 * IR snapshot 向け YAML 文字列を作る
 */
function stringifySnapshotYaml(value: unknown, comments: YamlCommentMap = {}): string {
	const doc = createYamlDocument(value, SNAPSHOT_YAML_PREFERRED_KEYS);
	attachYamlComments(doc, comments);
	return stringifyYamlDocument(doc);
}


/** snapshot ファイル形式のバージョン */
export const IR_SNAPSHOT_VERSION = 1;

/**
 * 永続化除外キーの tree 指定
 * - `true`: このキーを除外
 * - オブジェクト: 子階層の除外指定（components[] の各要素をルートとする）
 */
export type SnapshotExcludeTree = {
	[key: string]: true | SnapshotExcludeTree;
};

/**
 * components 各要素から snapshot 永続化時に除外するキー tree
 */
export const SNAPSHOT_COMPONENT_EXCLUDE_TREE: SnapshotExcludeTree = {
	id: true
};

/**
 * 復元時に再生成する属性（ドット区切りパス → 値生成関数）
 * components[] の各要素をルートとする
 */
export const SNAPSHOT_RESTORE_GENERATORS: Record<string, () => unknown> = {
	id: () => nanoid(16)
};

/**
 * IR エディタ snapshot のエンベロープ
 */
export type IrSnapshot = {
	version: typeof IR_SNAPSHOT_VERSION;
	savedAt: string;
	uiDefinition?: UiDefinitionSnapshotMeta;
	components: unknown[];
};

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * exclude tree に従い object から除外キーを再帰的に除去する
 */
export function stripByExcludeTree(value: unknown, excludeTree: SnapshotExcludeTree): unknown {
	if (!isPlainObject(value)) {
		return value;
	}

	const result: Record<string, unknown> = { ...value };

	for (const [key, spec] of Object.entries(excludeTree)) {
		if (!(key in result)) {
			continue;
		}

		if (spec === true) {
			delete result[key];
			continue;
		}

		if (isPlainObject(result[key])) {
			result[key] = stripByExcludeTree(result[key], spec);
		}
	}

	return result;
}

/**
 * ドット区切りパスで object から値を除去する
 */
function deleteByPath(target: Record<string, unknown>, path: string): void {
	const segments = path.split('.');
	let current: Record<string, unknown> = target;

	for (let index = 0; index < segments.length - 1; index += 1) {
		const segment = segments[index];
		const next = current[segment];
		if (!isPlainObject(next)) {
			return;
		}
		current = next;
	}

	delete current[segments[segments.length - 1]];
}

/**
 * ドット区切りパスで object に値を設定する
 */
function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
	const segments = path.split('.');
	let current: Record<string, unknown> = target;

	for (let index = 0; index < segments.length - 1; index += 1) {
		const segment = segments[index];
		const next = current[segment];
		if (!isPlainObject(next)) {
			current[segment] = {};
		}
		current = current[segment] as Record<string, unknown>;
	}

	current[segments[segments.length - 1]] = value;
}

/**
 * 外部永続化向けに components から除外 tree 指定の属性を除去する
 */
export function stripSnapshotComponents(
	components: unknown[],
	excludeTree: SnapshotExcludeTree = SNAPSHOT_COMPONENT_EXCLUDE_TREE
): unknown[] {
	return components.map((component) => stripByExcludeTree(component, excludeTree));
}

/**
 * 復元時に除外属性を除去し、generator 指定の属性を再生成する
 */
export function restoreSnapshotComponents(
	components: unknown[],
	options: {
		excludeTree?: SnapshotExcludeTree;
		generators?: Record<string, () => unknown>;
	} = {}
): unknown[] {
	const excludeTree = options.excludeTree ?? SNAPSHOT_COMPONENT_EXCLUDE_TREE;
	const generators = options.generators ?? SNAPSHOT_RESTORE_GENERATORS;

	return components.map((component) => {
		if (!isPlainObject(component)) {
			return component;
		}

		const record = structuredClone(component) as Record<string, unknown>;
		const stripped = stripByExcludeTree(record, excludeTree) as Record<string, unknown>;

		for (const path of Object.keys(generators)) {
			deleteByPath(stripped, path);
		}

		for (const [path, generate] of Object.entries(generators)) {
			setByPath(stripped, path, generate());
		}

		return stripped;
	});
}

/**
 * components 配列から IrSnapshot を組み立てる
 */
export function createIrSnapshot(
	uiDefinition: UiDefinitionSnapshotMeta,
	components: unknown[],
	savedAt: Date = new Date()
): IrSnapshot {
	return {
		version: IR_SNAPSHOT_VERSION,
		savedAt: savedAt.toISOString(),
		uiDefinition,
		components: stripSnapshotComponents(components)
	};
}

/**
 * 任意値が IrSnapshot として妥当か検証する
 */
export function parseIrSnapshot(value: unknown): IrSnapshot {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('IR snapshot must be a mapping object');
	}

	const root = value as Record<string, unknown>;
	if (root.version !== IR_SNAPSHOT_VERSION) {
		throw new Error(`IR snapshot version must be ${IR_SNAPSHOT_VERSION}`);
	}
	if (typeof root.savedAt !== 'string' || root.savedAt.length === 0) {
		throw new Error('IR snapshot requires non-empty "savedAt"');
	}
	if (!Array.isArray(root.components)) {
		throw new Error('IR snapshot requires "components" array');
	}

	const uiDefinition = root.uiDefinition;
	if (
		uiDefinition !== undefined &&
		(uiDefinition === null || typeof uiDefinition !== 'object' || Array.isArray(uiDefinition))
	) {
		throw new Error('IR snapshot "uiDefinition" must be an object when present');
	}

	return {
		version: IR_SNAPSHOT_VERSION,
		savedAt: root.savedAt,
		uiDefinition: uiDefinition as UiDefinitionSnapshotMeta | undefined,
		components: root.components
	};
}

/**
 * components の内容を比較用に正規化する（永続化除外属性は含めない）
 */
export function normalizeComponentsForCompare(components: unknown[]): string {
	return stringifySnapshotYaml({ components: stripSnapshotComponents(components) });
}

/**
 * uiDefinition + components の内容を比較用に正規化する
 */
export function normalizeSnapshotForCompare(
	uiDefinition: UiDefinitionEditorMeta | UiDefinitionSnapshotMeta,
	components: unknown[]
): string {
	return stringifySnapshotYaml({
		uiDefinition: toEditorMeta(uiDefinition),
		components: stripSnapshotComponents(components)
	});
}

/**
 * IrSnapshot を YAML 文字列へシリアライズする
 */
export function serializeIrSnapshot(snapshot: IrSnapshot, comments: YamlCommentMap = {}): string {
	return stringifySnapshotYaml(snapshot, comments);
}

/**
 * YAML 文字列から IrSnapshot とコメントマップをデシリアライズする
 */
export function deserializeIrSnapshotDocument(yamlText: string): {
	snapshot: IrSnapshot;
	comments: YamlCommentMap;
} {
	const doc = parseYamlDocument(yamlText);
	return {
		snapshot: parseIrSnapshot(doc.toJS()),
		comments: extractYamlComments(doc)
	};
}

/**
 * YAML 文字列から IrSnapshot をデシリアライズする
 */
export function deserializeIrSnapshot(yamlText: string): IrSnapshot {
	return deserializeIrSnapshotDocument(yamlText).snapshot;
}
