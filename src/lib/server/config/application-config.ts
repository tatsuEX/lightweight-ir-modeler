import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { load } from 'js-yaml';
import { env } from '$env/dynamic/private';

/**
 * application.yml 相当の静的アプリ設定
 */
export type ApplicationConfig = {
	app: {
		name: string;
	};
};

let cached: ApplicationConfig | undefined;

/**
 * .env の APP_CONFIG_PATH を絶対パスへ解決する
 */
function resolveConfigPath(configPath: string): string {
	if (isAbsolute(configPath)) {
		return configPath;
	}
	// WARN: process.cwd() は npm run 時にプロジェクトルートになる前提
	return resolve(process.cwd(), configPath);
}

/**
 * YAML 文字列を ApplicationConfig としてパースする
 */
function parseApplicationConfig(yamlText: string): ApplicationConfig {
	const parsed = load(yamlText);
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('application config YAML must be a mapping object');
	}

	const root = parsed as Record<string, unknown>;
	const app = root.app;
	if (app === null || typeof app !== 'object' || Array.isArray(app)) {
		throw new Error('application config requires an "app" object');
	}

	const name = (app as Record<string, unknown>).name;
	if (typeof name !== 'string' || name.length === 0) {
		throw new Error('application config requires non-empty "app.name"');
	}

	return { app: { name } };
}

/**
 * .env の APP_CONFIG_PATH から静的 YAML 設定を読み込む（初回のみファイル I/O）
 */
export function loadApplicationConfig(): ApplicationConfig {
	if (cached !== undefined) {
		return cached;
	}

	const configPath = env.APP_CONFIG_PATH;
	if (typeof configPath !== 'string' || configPath.trim() === '') {
		throw new Error('APP_CONFIG_PATH is not set in environment (.env)');
	}

	const absolutePath = resolveConfigPath(configPath.trim());
	const yamlText = readFileSync(absolutePath, 'utf8');
	cached = parseApplicationConfig(yamlText);
	return cached;
}

/**
 * テスト用: キャッシュ済み設定を破棄する
 */
export function clearApplicationConfigCache(): void {
	cached = undefined;
}
