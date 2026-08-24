import { DEFAULT_LOGGING_CONFIG, type LoggingConfig } from '$lib/config/logging-config';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import { DefinitionReadError } from '$lib/server/io/readers/definition-reader';
import { createWinstonLogger } from '$lib/server/logging/winston-factory';
import type winston from 'winston';

/**
 * アプリから使うロガー（Winston を隠す）
 */
export type AppLogger = {
	debug: (message: string, meta?: Record<string, unknown>) => void;
	info: (message: string, meta?: Record<string, unknown>) => void;
	warn: (message: string, meta?: Record<string, unknown>) => void;
	error: (message: string, meta?: Record<string, unknown>) => void;
};

let rootLogger: winston.Logger | undefined;

/**
 * Vitest 実行中はファイルもコンソールも出さない（単体テストの出力を汚さない）
 */
function isVitestRuntime(): boolean {
	return process.env.VITEST === 'true';
}

/**
 * application.yml の logging を読む。未設定・未ロード時はコンソールのみ
 */
function loadLoggingConfig(): LoggingConfig {
	try {
		const config = loadApplicationConfig();
		return config.logging ?? DEFAULT_LOGGING_CONFIG;
	} catch {
		return DEFAULT_LOGGING_CONFIG;
	}
}

/**
 * プロセス内シングルトンの Winston logger
 */
function getRootLogger(): winston.Logger {
	if (rootLogger) {
		return rootLogger;
	}

	const silent = isVitestRuntime();
	rootLogger = createWinstonLogger(loadLoggingConfig(), silent);
	return rootLogger;
}

/**
 * import.meta.url から短いモジュール名を作る
 */
export function loggerNameFromModuleUrl(moduleUrl: string): string {
	const normalized = moduleUrl.replace(/\\/g, '/');
	const marker = '/src/';
	const index = normalized.lastIndexOf(marker);
	const sliced = index >= 0 ? normalized.slice(index + marker.length) : normalized;
	return sliced.replace(/\.(ts|js)$/, '');
}

/**
 * モジュール専用 logger を返す（SLF4J の getLogger 相当）
 */
export function getLogger(moduleUrlOrName: string): AppLogger {
	const moduleName = moduleUrlOrName.includes(':')
		? loggerNameFromModuleUrl(moduleUrlOrName)
		: moduleUrlOrName;
	const root = getRootLogger();

	return {
		debug: (message, meta) => root.debug(message, { module: moduleName, ...meta }),
		info: (message, meta) => root.info(message, { module: moduleName, ...meta }),
		warn: (message, meta) => root.warn(message, { module: moduleName, ...meta }),
		error: (message, meta) => root.error(message, { module: moduleName, ...meta })
	};
}

/**
 * テスト用: ルート logger を破棄する
 */
export function resetRootLogger(): void {
	if (rootLogger) {
		rootLogger.close();
		rootLogger = undefined;
	}
}

/**
 * 想定内の業務エラーか（warn で throw ログする）
 */
function isExpectedOperationalError(error: unknown): boolean {
	return error instanceof RawValidationError || error instanceof DefinitionReadError;
}

/**
 * throw ログ用の短いメタ
 */
export function errorLogMeta(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		const meta: Record<string, unknown> = {
			errorName: error.name,
			errorMessage: error.message
		};
		if (!isExpectedOperationalError(error) && error.stack) {
			meta.stack = error.stack;
		}
		return meta;
	}
	return { errorMessage: String(error) };
}

/**
 * before / return / throw を囲む（同期・非同期両対応。Aspect の @Around 相当）
 */
export function runLogged<T>(
	logger: AppLogger,
	operation: string,
	meta: Record<string, unknown>,
	fn: () => T
): T {
	const startedAt = Date.now();
	logger.info(`${operation} start`, meta);

	const onReturn = (value: unknown): unknown => {
		logger.info(`${operation} return`, { ...meta, durationMs: Date.now() - startedAt });
		return value;
	};

	const onThrow = (error: unknown): never => {
		const payload = { ...meta, durationMs: Date.now() - startedAt, ...errorLogMeta(error) };
		if (isExpectedOperationalError(error)) {
			logger.warn(`${operation} throw`, payload);
		} else {
			logger.error(`${operation} throw`, payload);
		}
		throw error;
	};

	try {
		const result = fn();
		if (result instanceof Promise) {
			return result.then(onReturn, onThrow) as T;
		}
		return onReturn(result) as T;
	} catch (error) {
		return onThrow(error);
	}
}
