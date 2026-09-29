/**
 * UIDefinition 検証プロファイル（クライアントとサーバで共有）
 *
 * WARN: ここは fs を持たない。YAML の読込は server/config が行い、この parse を呼ぶ。
 */

/** auto-save 無効時の検証 debounce 既定（ms）。auto-save の delay とは別定数 */
export const DEFAULT_UI_DEFINITION_VALIDATION_DELAY = 500;

/** フィールド制約で受理するキー。これ以外のオブジェクトは子フィールド */
const CONSTRAINT_KEYWORDS = [
	'required',
	'pattern',
	'minLength',
	'maxLength',
	'minimum',
	'maximum',
	'enum',
	'prefix',
	'suffix',
	'minItems',
	'maxItems'
] as const;

const CONSTRAINT_KEYWORD_SET: ReadonlySet<string> = new Set(CONSTRAINT_KEYWORDS);

/** 宣言プロファイルのフィールド制約（JSON Schema の部分集合） */
export type UiDefinitionFieldConstraint = {
	required?: true;
	pattern?: string;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	enum?: readonly string[];
	prefix?: string;
	suffix?: string;
	minItems?: number;
	maxItems?: number;
};

/** 制約と、その下の子フィールド */
export type UiDefinitionFieldRule = {
	constraint: UiDefinitionFieldConstraint;
	children: Readonly<Record<string, UiDefinitionFieldRule>>;
};

/** エディタが項目を出すか */
export type UiDefinitionEditorFieldMode = 'hidden' | 'disabled';

/**
 * UIDefinition に対する検証プロファイル
 *
 * WARN: `plugins` に id があっても、登録済み実装が無いあいだは parse が拒否する。
 */
export type UiDefinitionValidationProfile = {
	delay: number;
	meta: Readonly<Record<string, UiDefinitionFieldRule>>;
	components: Readonly<Record<string, UiDefinitionFieldRule>>;
	byType: Readonly<Record<string, Readonly<Record<string, UiDefinitionFieldRule>>>>;
	maxComponents?: number;
	editorFields: Readonly<Record<string, Readonly<Record<string, UiDefinitionEditorFieldMode>>>>;
	plugins: readonly string[];
};

/**
 * コア規則だけのプロファイルを返す
 */
export function createDefaultUiDefinitionValidationProfile(): UiDefinitionValidationProfile {
	return {
		delay: DEFAULT_UI_DEFINITION_VALIDATION_DELAY,
		meta: {},
		components: {},
		byType: {},
		editorFields: {},
		plugins: []
	};
}

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 設定パス付きのエラーを投げる
 */
function fail(path: string, message: string): never {
	throw new Error(`application config "${path}" ${message}`);
}

/**
 * 非負整数かを判定する
 */
function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * 有限数かを判定する
 */
function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 制約キーを 1 つ読む
 */
function readConstraintKeyword(path: string, key: string, value: unknown): unknown {
	if (key === 'required') {
		if (value !== true) {
			fail(path, 'must be true when set (core rules cannot be weakened)');
		}
		return true;
	}
	if (key === 'pattern' || key === 'prefix' || key === 'suffix') {
		if (typeof value !== 'string' || value.trim() === '') {
			fail(path, 'must be a non-empty string');
		}
		if (key === 'pattern') {
			try {
				new RegExp(value);
			} catch {
				fail(path, 'must be a valid regular expression');
			}
		}
		return value;
	}
	if (key === 'minLength' || key === 'maxLength' || key === 'minItems' || key === 'maxItems') {
		if (!isNonNegativeInteger(value)) {
			fail(path, 'must be a non-negative integer');
		}
		return value;
	}
	if (key === 'minimum' || key === 'maximum') {
		if (!isFiniteNumber(value)) {
			fail(path, 'must be a finite number');
		}
		return value;
	}
	if (key === 'enum') {
		if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string')) {
			fail(path, 'must be a non-empty array of strings');
		}
		return value;
	}
	fail(path, 'is not a supported constraint');
}

/**
 * フィールド規則ノードを読む。未知の制約キーは子フィールド、どちらでもなければ失敗する
 */
function parseFieldRule(path: string, raw: unknown): UiDefinitionFieldRule {
	if (!isPlainObject(raw)) {
		fail(path, 'must be an object');
	}

	const constraint: Record<string, unknown> = {};
	const children: Record<string, UiDefinitionFieldRule> = {};

	for (const [key, value] of Object.entries(raw)) {
		const childPath = `${path}.${key}`;
		if (CONSTRAINT_KEYWORD_SET.has(key)) {
			constraint[key] = readConstraintKeyword(childPath, key, value);
			continue;
		}
		if (isPlainObject(value)) {
			children[key] = parseFieldRule(childPath, value);
			continue;
		}
		fail(childPath, 'is not a supported constraint or nested field');
	}

	return { constraint: constraint as UiDefinitionFieldConstraint, children };
}

/**
 * フィールド名 → 規則 の map を読む
 */
function parseFieldRuleMap(
	path: string,
	raw: unknown
): Readonly<Record<string, UiDefinitionFieldRule>> {
	if (raw === undefined) {
		return {};
	}
	if (!isPlainObject(raw)) {
		fail(path, 'must be an object');
	}

	const map: Record<string, UiDefinitionFieldRule> = {};
	for (const [key, value] of Object.entries(raw)) {
		map[key] = parseFieldRule(`${path}.${key}`, value);
	}
	return map;
}

/**
 * components ブロックを、共通フィールドと byType に分けて読む
 */
function parseComponentsRules(path: string, raw: unknown): {
	components: Readonly<Record<string, UiDefinitionFieldRule>>;
	byType: Readonly<Record<string, Readonly<Record<string, UiDefinitionFieldRule>>>>;
} {
	if (raw === undefined) {
		return { components: {}, byType: {} };
	}
	if (!isPlainObject(raw)) {
		fail(path, 'must be an object');
	}

	const components: Record<string, UiDefinitionFieldRule> = {};
	let byType: Readonly<Record<string, Readonly<Record<string, UiDefinitionFieldRule>>>> = {};

	for (const [key, value] of Object.entries(raw)) {
		if (key === 'byType') {
			if (!isPlainObject(value)) {
				fail(`${path}.byType`, 'must be an object');
			}
			const types: Record<string, Readonly<Record<string, UiDefinitionFieldRule>>> = {};
			for (const [typeName, typeRules] of Object.entries(value)) {
				types[typeName] = parseFieldRuleMap(`${path}.byType.${typeName}`, typeRules);
			}
			byType = types;
			continue;
		}
		components[key] = parseFieldRule(`${path}.${key}`, value);
	}

	return { components, byType };
}

/**
 * editor.fields を読む
 */
function parseEditorFields(
	path: string,
	raw: unknown
): Readonly<Record<string, Readonly<Record<string, UiDefinitionEditorFieldMode>>>> {
	if (raw === undefined) {
		return {};
	}
	if (!isPlainObject(raw)) {
		fail(path, 'must be an object');
	}

	const fields: Record<string, Readonly<Record<string, UiDefinitionEditorFieldMode>>> = {};
	for (const [typeName, typeFields] of Object.entries(raw)) {
		const typePath = `${path}.${typeName}`;
		if (!isPlainObject(typeFields)) {
			fail(typePath, 'must be an object');
		}
		const modes: Record<string, UiDefinitionEditorFieldMode> = {};
		for (const [fieldName, mode] of Object.entries(typeFields)) {
			if (mode !== 'hidden' && mode !== 'disabled') {
				fail(`${typePath}.${fieldName}`, 'must be "hidden" or "disabled"');
			}
			modes[fieldName] = mode;
		}
		fields[typeName] = modes;
	}
	return fields;
}

/**
 * プラグイン id 列を読む
 *
 * WARN: 登録済みプラグインが無いあいだは、空以外を未知 id として拒否する。
 */
function parsePluginIds(path: string, raw: unknown): readonly string[] {
	if (raw === undefined) {
		return [];
	}
	if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string')) {
		fail(path, 'must be an array of plugin ids');
	}

	for (const item of raw) {
		const pluginId = item.trim();
		if (pluginId === '') {
			continue;
		}
		fail(path, `unknown uiDefinition validation plugin: ${pluginId}`);
	}
	return [];
}

/**
 * `uiDefinition` ブロックを検証プロファイルにする。未設定時はコアのみ
 */
export function parseUiDefinitionValidationConfig(raw: unknown): UiDefinitionValidationProfile {
	const defaults = createDefaultUiDefinitionValidationProfile();
	if (raw === undefined) {
		return defaults;
	}
	if (!isPlainObject(raw)) {
		fail('uiDefinition', 'must be an object');
	}

	const validation = raw.validation;
	if (validation === undefined) {
		return defaults;
	}
	if (!isPlainObject(validation)) {
		fail('uiDefinition.validation', 'must be an object');
	}

	const allowed = new Set(['delay', 'rules', 'editor', 'plugins']);
	for (const key of Object.keys(validation)) {
		if (!allowed.has(key)) {
			fail(`uiDefinition.validation.${key}`, 'is not a supported key');
		}
	}

	let delay = defaults.delay;
	if (validation.delay !== undefined) {
		if (!isNonNegativeInteger(validation.delay)) {
			fail('uiDefinition.validation.delay', 'must be a non-negative integer');
		}
		delay = validation.delay;
	}

	let meta: Readonly<Record<string, UiDefinitionFieldRule>> = {};
	let components: Readonly<Record<string, UiDefinitionFieldRule>> = {};
	let byType: Readonly<Record<string, Readonly<Record<string, UiDefinitionFieldRule>>>> = {};
	let maxComponents: number | undefined;

	if (validation.rules !== undefined) {
		if (!isPlainObject(validation.rules)) {
			fail('uiDefinition.validation.rules', 'must be an object');
		}
		const ruleKeys = new Set(['meta', 'components', 'limits']);
		for (const key of Object.keys(validation.rules)) {
			if (!ruleKeys.has(key)) {
				fail(`uiDefinition.validation.rules.${key}`, 'is not a supported key');
			}
		}
		meta = parseFieldRuleMap('uiDefinition.validation.rules.meta', validation.rules.meta);
		const componentRules = parseComponentsRules(
			'uiDefinition.validation.rules.components',
			validation.rules.components
		);
		components = componentRules.components;
		byType = componentRules.byType;

		if (validation.rules.limits !== undefined) {
			if (!isPlainObject(validation.rules.limits)) {
				fail('uiDefinition.validation.rules.limits', 'must be an object');
			}
			for (const key of Object.keys(validation.rules.limits)) {
				if (key !== 'maxComponents') {
					fail(`uiDefinition.validation.rules.limits.${key}`, 'is not a supported key');
				}
			}
			if (validation.rules.limits.maxComponents !== undefined) {
				if (!isNonNegativeInteger(validation.rules.limits.maxComponents)) {
					fail(
						'uiDefinition.validation.rules.limits.maxComponents',
						'must be a non-negative integer'
					);
				}
				maxComponents = validation.rules.limits.maxComponents;
			}
		}
	}

	let editorFields = defaults.editorFields;
	if (validation.editor !== undefined) {
		if (!isPlainObject(validation.editor)) {
			fail('uiDefinition.validation.editor', 'must be an object');
		}
		for (const key of Object.keys(validation.editor)) {
			if (key !== 'fields') {
				fail(`uiDefinition.validation.editor.${key}`, 'is not a supported key');
			}
		}
		editorFields = parseEditorFields(
			'uiDefinition.validation.editor.fields',
			validation.editor.fields
		);
	}

	return {
		delay,
		meta,
		components,
		byType,
		...(maxComponents !== undefined ? { maxComponents } : {}),
		editorFields,
		plugins: parsePluginIds('uiDefinition.validation.plugins', validation.plugins)
	};
}

/**
 * プロジェクトが項目を隠すか、編集不可にするかを返す
 */
export function editorFieldMode(
	profile: UiDefinitionValidationProfile,
	componentType: string,
	fieldName: string
): 'editable' | UiDefinitionEditorFieldMode {
	return profile.editorFields[componentType]?.[fieldName] ?? 'editable';
}
