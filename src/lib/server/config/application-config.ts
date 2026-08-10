import { env } from '$env/dynamic/private';
import type { ApplicationConfig } from '$lib/config/application-types';
import { parseApplicationConfigRoot } from '$lib/server/config/application-config-parse';
import {
	loadMergedApplicationConfigRoot,
	resolveApplicationPath
} from '$lib/server/config/application-config-yaml';

export type {
	AppIoConfig,
	AppIoExportConfig,
	AppIoExportTemplateTargetConfig,
	ApplicationConfig,
	IrAutoSaveConfig
} from '$lib/config/application-types';
export type {
	LayoutEditorConfig,
	LayoutEditorPropertyConfig
} from '$lib/config/layout-editor-config';
export {
	parseApplicationConfig,
	parseApplicationConfigRoot
} from '$lib/server/config/application-config-parse';
export {
	deepMergeConfig,
	loadMergedApplicationConfigRoot,
	resolveApplicationPath,
	resolveProfileConfigPath
} from '$lib/server/config/application-config-yaml';

let cached: ApplicationConfig | undefined;

/**
 * target 向けエクスポートテンプレート dir を絶対パスへ解決する
 */
export function resolveExportTemplateDir(targetId: string): string {
	const config = loadApplicationConfig();
	const dir = config.app.io?.export?.templates?.[targetId]?.dir?.trim();

	if (!dir) {
		throw new Error(
			`application config "app.io.export.templates.${targetId}.dir" is not configured`
		);
	}

	return resolveApplicationPath(dir);
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
