import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { load } from 'js-yaml';

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
