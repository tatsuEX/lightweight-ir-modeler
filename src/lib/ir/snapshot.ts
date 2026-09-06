import { parseYamlDocument, stringifyYamlDocument, createYamlDocument } from '$lib/utils/yaml-document';
import { attachYamlComments, extractYamlComments, type YamlCommentMap } from '$lib/utils/yaml-comments';
import { nanoid } from 'nanoid';
import {
	createEmptyUiDefinitionMeta,
	toEditorMeta,
	type UiDefinitionEditorMeta,
	type UiDefinitionSnapshotMeta
} from '$lib/ir/ui-definition-meta';
import { CURRENT_IR_SCHEMA_VERSION } from '$lib/ir/snapshot-schema-version';
import {
	migrateIrSnapshotRecord,
	readRecordSchemaVersion,
	type IrSnapshotMigrationOptions
} from '$lib/ir/snapshot-migration';
import { SYSTEM_ID_LENGTH } from './elements/factories';
import { hydrateEditorComponent, type EditorComponent } from '$lib/ir/elements/component-schema';

/**
 * IR snapshot YAML でシステムメタの次に置くドメインキー
 */
export const SNAPSHOT_YAML_PREFERRED_KEYS: readonly string[] = [
	'uiDefinition',
	'components',
	'logicalId',
	'name',
	'version',
	'changeReason',
	'releasedAt',
	'closedAt',
	'closedReason',
	'description',
	'basedOn',
	'type',
	'sourceType',
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
	id: () => nanoid(SYSTEM_ID_LENGTH)
};

/**
 * IR エディタ snapshot のエンベロープ
 *
 * WARN: `schemaVersion` は UI IR 定義の**構造**の版。`uiDefinition.version`（ユーザ意図の
 * 画面定義の製品版）とは別概念で、混ぜてはいけない。
 */
export type IrSnapshot = {
	schemaVersion: string;
	savedAt: string;
	uiDefinition?: UiDefinitionSnapshotMeta;
	components: unknown[];
};

/**
 * YAML から復元したドメインモデル（運用コメントは含めない）
 *
 * WARN: CLI（summon / 将来の diff・grep・inspect）もこの形を入力にする。
 * target 投影やテンプレ描画は各コマンド側で行う。
 */
export type RestoredIrSnapshot = {
	schemaVersion: string;
	savedAt: string;
	uiDefinition: UiDefinitionSnapshotMeta;
	components: EditorComponent[];
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
 * 復元時に除外属性を除去し、generator 指定の属性を再生成して EditorComponent にする
 *
 * WARN: ここで Zod parse するので、既定値補完・`tooltip`/`autosize` 除去・未知 type の
 * `unsupported` 正規化が走る。projection / summon は復元後 record を読む。
 */
export function restoreSnapshotComponents(
	components: unknown[],
	options: {
		excludeTree?: SnapshotExcludeTree;
		generators?: Record<string, () => unknown>;
	} = {}
): EditorComponent[] {
	const excludeTree = options.excludeTree ?? SNAPSHOT_COMPONENT_EXCLUDE_TREE;
	const generators = options.generators ?? SNAPSHOT_RESTORE_GENERATORS;

	return components.map((component) => {
		const record = isPlainObject(component)
			? (structuredClone(component) as Record<string, unknown>)
			: {};
		const stripped = stripByExcludeTree(record, excludeTree) as Record<string, unknown>;

		for (const path of Object.keys(generators)) {
			deleteByPath(stripped, path);
		}

		for (const [path, generate] of Object.entries(generators)) {
			setByPath(stripped, path, generate());
		}

		const generatedId =
			typeof stripped.id === 'string' && stripped.id.trim() !== ''
				? stripped.id
				: nanoid(SYSTEM_ID_LENGTH);
		return hydrateEditorComponent(stripped, generatedId);
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
		schemaVersion: CURRENT_IR_SCHEMA_VERSION,
		savedAt: savedAt.toISOString(),
		uiDefinition,
		components: stripSnapshotComponents(components)
	};
}

/**
 * 任意値が IrSnapshot として妥当か検証する
 *
 * WARN: 「LIRM の snapshot か」は root が mapping・`savedAt` 非空・`components` 配列で判定する。
 * 廃止した envelope `version` の一致判定には依存しない。
 * WARN: `schemaVersion` の世代判定は migration 側の責務。ここは現行 schema としての構造検証だけ行う。
 */
export function parseIrSnapshot(value: unknown): IrSnapshot {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('IR snapshot must be a mapping object');
	}

	const root = value as Record<string, unknown>;
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
		schemaVersion: readRecordSchemaVersion(root),
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
 *
 * WARN: 全読込経路の choke point。ここで migration するので `current` と `versions/<v>/` の
 * どちらから読んでも挙動が揃う。migration は生 record に対して行い、その後で現行 schema として
 * 構造検証する（step が envelope 形状を変えても順序が壊れない）。
 */
export function deserializeIrSnapshotDocument(
	yamlText: string,
	options: IrSnapshotMigrationOptions = {}
): {
	snapshot: IrSnapshot;
	comments: YamlCommentMap;
} {
	const doc = parseYamlDocument(yamlText);
	const migrated = migrateIrSnapshotRecord(doc.toJS(), options);

	return {
		snapshot: parseIrSnapshot(migrated.record),
		comments: extractYamlComments(doc)
	};
}

/**
 * YAML 文字列から IrSnapshot をデシリアライズする
 */
export function deserializeIrSnapshot(
	yamlText: string,
	options: IrSnapshotMigrationOptions = {}
): IrSnapshot {
	return deserializeIrSnapshotDocument(yamlText, options).snapshot;
}

/**
 * YAML 文字列からドメインモデルを復元する（envelope 検証 + id 再採番）
 */
export function restoreIrSnapshotFromYaml(
	yamlText: string,
	options: IrSnapshotMigrationOptions = {}
): RestoredIrSnapshot {
	const snapshot = deserializeIrSnapshot(yamlText, options);
	const editorDefaults = createEmptyUiDefinitionMeta();

	return {
		schemaVersion: snapshot.schemaVersion,
		savedAt: snapshot.savedAt,
		uiDefinition: snapshot.uiDefinition ?? {
			...editorDefaults,
			createdAt: snapshot.savedAt,
			modifiedAt: snapshot.savedAt
		},
		components: restoreSnapshotComponents(snapshot.components)
	};
}
