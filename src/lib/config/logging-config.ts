/**
 * application.yml の logging ブロック（クライアント安全な型のみ。Winston は参照しない）
 */

/** Winston 互換の重大度（小さいほど重大） */
export type LoggingLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

/** ファイルの時間ローテーション */
export type LoggingRolling = 'daily' | 'monthly' | 'none';

/**
 * コンソール出力
 */
export type LoggingConsoleConfig = {
	enabled: boolean;
};

/**
 * レベル帯 1 ファイル（info 帯または error 帯）
 */
export type LoggingFileAppenderConfig = {
	enabled: boolean;
	filename: string;
	rolling: LoggingRolling;
	maxFiles: string | number;
};

/**
 * ファイル出力（info / error で rolling を独立設定できる）
 */
export type LoggingFileConfig = {
	dir: string;
	info: LoggingFileAppenderConfig;
	error: LoggingFileAppenderConfig;
};

/**
 * アプリ全体のロギング設定
 */
export type LoggingConfig = {
	level: LoggingLevel;
	console: LoggingConsoleConfig;
	file: LoggingFileConfig;
};

/** 未設定時: コンソールのみ（テストが ./logs を汚さない） */
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
	level: 'info',
	console: { enabled: true },
	file: {
		dir: './logs',
		info: {
			enabled: false,
			filename: 'info.log',
			rolling: 'daily',
			maxFiles: '14d'
		},
		error: {
			enabled: false,
			filename: 'error.log',
			rolling: 'monthly',
			maxFiles: '12'
		}
	}
};

const LOGGING_LEVELS: readonly LoggingLevel[] = [
	'error',
	'warn',
	'info',
	'http',
	'verbose',
	'debug',
	'silly'
];

const LOGGING_ROLLINGS: readonly LoggingRolling[] = ['daily', 'monthly', 'none'];

/**
 * 文字列が LoggingLevel か判定する
 */
export function isLoggingLevel(value: string): value is LoggingLevel {
	return (LOGGING_LEVELS as readonly string[]).includes(value);
}

/**
 * 文字列が LoggingRolling か判定する
 */
export function isLoggingRolling(value: string): value is LoggingRolling {
	return (LOGGING_ROLLINGS as readonly string[]).includes(value);
}
