import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { load } from 'js-yaml';
import { env } from '$env/dynamic/private';
import {
	type PreviewConfig,
	type PreviewSelectConfig,
	type PreviewSelectOption
} from '$lib/config/preview-config';

/**
 * IR 自動保存設定
 */
export type IrAutoSaveConfig = {
	enabled: boolean;
	delay: number;
	dir: string;
	maxGenerations: number;
};

/**
 * application.yml 相当の静的アプリ設定
 */
export type ApplicationConfig = {
	app: {
		name: string;
	};
	ir?: {
		autoSave?: IrAutoSaveConfig;
	};
	preview: PreviewConfig;
};

let cached: ApplicationConfig | undefined;

/**
 * 相対パスを process.cwd() 基準の絶対パスへ解決する
 */
export function resolveApplicationPath(configPath: string): string {
	if (isAbsolute(configPath)) {
		return configPath;
	}
	// WARN: process.cwd() は npm run 時にプロジェクトルートになる前提
	return resolve(process.cwd(), configPath);
}

/**
 * .env の APP_CONFIG_PATH を絶対パスへ解決する
 */
function resolveConfigPath(configPath: string): string {
	return resolveApplicationPath(configPath);
}

/**
 * ベース設定パスからプロファイル別 overlay 設定パスを導出する
 * 例: ./config/application.yml + dev -> ./config/application-dev.yml
 */
export function resolveProfileConfigPath(baseConfigPath: string, profile: string): string {
	const absoluteBase = resolveConfigPath(baseConfigPath);
	const directory = dirname(absoluteBase);
	const extension = extname(absoluteBase);
	const baseName = basename(absoluteBase, extension);
	return join(directory, `${baseName}-${profile}${extension}`);
}

/**
 * 設定 YAML の mapping オブジェクト同士を deep merge する（Spring overlay 相当）
 */
export function deepMergeConfig(
	base: Record<string, unknown>,
	override: Record<string, unknown>
): Record<string, unknown> {
	const merged: Record<string, unknown> = { ...base };

	for (const [key, value] of Object.entries(override)) {
		const current = merged[key];
		if (
			value !== null &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			current !== null &&
			typeof current === 'object' &&
			!Array.isArray(current)
		) {
			merged[key] = deepMergeConfig(
				current as Record<string, unknown>,
				value as Record<string, unknown>
			);
			continue;
		}
		merged[key] = value;
	}

	return merged;
}

/**
 * YAML ファイルを mapping オブジェクトとして読み込む
 */
function readYamlMapping(absolutePath: string): Record<string, unknown> {
	const parsed = load(readFileSync(absolutePath, 'utf8'));
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`application config YAML must be a mapping object: ${absolutePath}`);
	}
	return parsed as Record<string, unknown>;
}

/**
 * ベース YAML と APP_PROFILE overlay を merge した mapping を読み込む
 */
export function loadMergedApplicationConfigRoot(
	baseConfigPath: string,
	profile?: string
): Record<string, unknown> {
	const absoluteBasePath = resolveConfigPath(baseConfigPath);
	const baseRoot = readYamlMapping(absoluteBasePath);

	const trimmedProfile = profile?.trim();
	if (!trimmedProfile) {
		return baseRoot;
	}

	const profilePath = resolveProfileConfigPath(baseConfigPath, trimmedProfile);
	if (!existsSync(profilePath)) {
		throw new Error(
			`APP_PROFILE is "${trimmedProfile}" but overlay config not found: ${profilePath}`
		);
	}

	const profileRoot = readYamlMapping(profilePath);
	return deepMergeConfig(baseRoot, profileRoot);
}

/**
 * ir.autoSave ブロックをパースする
 */
function parseIrAutoSave(raw: unknown): IrAutoSaveConfig | undefined {
	if (raw === undefined) {
		return undefined;
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "ir.autoSave" must be an object');
	}

	const block = raw as Record<string, unknown>;
	const enabled = block.enabled === true;
	const delay = block.delay === undefined ? 500 : block.delay;
	const dir = block.dir;
	const maxGenerations =
		block.maxGenerations === undefined ? 10 : block.maxGenerations;

	if (typeof delay !== 'number' || !Number.isInteger(delay) || delay <= 0) {
		throw new Error('application config "ir.autoSave.delay" must be a positive integer');
	}
	if (typeof maxGenerations !== 'number' || !Number.isInteger(maxGenerations) || maxGenerations < 2) {
		throw new Error('application config "ir.autoSave.maxGenerations" must be an integer >= 2');
	}

	if (enabled) {
		if (typeof dir !== 'string' || dir.trim() === '') {
			throw new Error('application config "ir.autoSave.dir" is required when enabled is true');
		}
		return {
			enabled: true,
			delay,
			dir: dir.trim(),
			maxGenerations
		};
	}

	if (dir !== undefined && (typeof dir !== 'string' || dir.trim() === '')) {
		throw new Error('application config "ir.autoSave.dir" must be a non-empty string when set');
	}

	return {
		enabled: false,
		delay,
		dir: typeof dir === 'string' ? dir.trim() : '',
		maxGenerations
	};
}

/**
 * preview の Select options 配列をパースする
 */
function parsePreviewSelectOptions(raw: unknown, pathPrefix: string): PreviewSelectOption[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		throw new Error(`application config "${pathPrefix}.options" must be a non-empty array`);
	}

	return raw.map((item, index) => {
		if (item === null || typeof item !== 'object' || Array.isArray(item)) {
			throw new Error(`application config "${pathPrefix}.options[${index}]" must be an object`);
		}

		const option = item as Record<string, unknown>;
		const name = option.name;
		const value = option.value;

		if (typeof name !== 'string' || name.trim() === '') {
			throw new Error(
				`application config "${pathPrefix}.options[${index}].name" must be a non-empty string`
			);
		}
		if (typeof value !== 'string' || value.trim() === '') {
			throw new Error(
				`application config "${pathPrefix}.options[${index}].value" must be a non-empty string`
			);
		}

		return { name: name.trim(), value: value.trim() };
	});
}

/**
 * preview の theme / transformTarget ブロックをパースする
 */
function parsePreviewSelectConfig(raw: unknown, blockName: string): PreviewSelectConfig {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error(`application config "preview.${blockName}" must be an object`);
	}

	const block = raw as Record<string, unknown>;
	const pathPrefix = `preview.${blockName}`;
	const defaultValue = block.default;
	const options = parsePreviewSelectOptions(block.options, pathPrefix);

	if (typeof defaultValue !== 'string' || defaultValue.trim() === '') {
		throw new Error(`application config "${pathPrefix}.default" must be a non-empty string`);
	}

	const trimmedDefault = defaultValue.trim();
	const matched = options.find((option) => option.value === trimmedDefault);
	if (!matched) {
		throw new Error(
			`application config "${pathPrefix}.default" must match one of options[].value`
		);
	}

	return {
		default: trimmedDefault,
		options
	};
}

/**
 * preview ブロックをパースする
 */
function parsePreview(raw: unknown): PreviewConfig {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "preview" must be an object');
	}

	const block = raw as Record<string, unknown>;
	return {
		theme: parsePreviewSelectConfig(block.theme, 'theme'),
		transformTarget: parsePreviewSelectConfig(block.transformTarget, 'transformTarget')
	};
}

/**
 * merge 済み mapping を ApplicationConfig としてパースする
 */
export function parseApplicationConfigRoot(root: Record<string, unknown>): ApplicationConfig {
	const app = root.app;
	if (app === null || typeof app !== 'object' || Array.isArray(app)) {
		throw new Error('application config requires an "app" object');
	}

	const name = (app as Record<string, unknown>).name;
	if (typeof name !== 'string' || name.length === 0) {
		throw new Error('application config requires non-empty "app.name"');
	}

	const previewBlock = root.preview;
	if (previewBlock === undefined) {
		throw new Error('application config requires a "preview" object');
	}

	const config: ApplicationConfig = {
		app: { name },
		preview: parsePreview(previewBlock)
	};

	const ir = root.ir;
	if (ir !== undefined) {
		if (ir === null || typeof ir !== 'object' || Array.isArray(ir)) {
			throw new Error('application config "ir" must be an object');
		}
		const autoSave = parseIrAutoSave((ir as Record<string, unknown>).autoSave);
		if (autoSave !== undefined) {
			config.ir = { autoSave };
		}
	}

	return config;
}

/**
 * YAML 文字列を ApplicationConfig としてパースする
 */
export function parseApplicationConfig(yamlText: string): ApplicationConfig {
	const parsed = load(yamlText);
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('application config YAML must be a mapping object');
	}
	return parseApplicationConfigRoot(parsed as Record<string, unknown>);
}

/**
 * .env の APP_CONFIG_PATH（ベース）と APP_PROFILE（overlay）から設定を読み込む
 */
export function loadApplicationConfig(): ApplicationConfig {
	if (cached !== undefined) {
		return cached;
	}

	const configPath = env.APP_CONFIG_PATH;
	if (typeof configPath !== 'string' || configPath.trim() === '') {
		throw new Error('APP_CONFIG_PATH is not set in environment (.env)');
	}

	const profile = env.APP_PROFILE;
	const mergedRoot = loadMergedApplicationConfigRoot(
		configPath.trim(),
		typeof profile === 'string' ? profile : undefined
	);
	cached = parseApplicationConfigRoot(mergedRoot);
	return cached;
}

/**
 * テスト用: キャッシュ済み設定を破棄する
 */
export function clearApplicationConfigCache(): void {
	cached = undefined;
}
