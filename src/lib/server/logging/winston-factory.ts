import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import DailyRotateFile from '@depup/winston-daily-rotate-file';
import winston from 'winston';
import type {
	LoggingConfig,
	LoggingFileAppenderConfig,
	LoggingLevel,
	LoggingRolling
} from '$lib/config/logging-config';
import { resolveApplicationPath } from '$lib/server/config/application-config-yaml';

const INFO_FILE_LEVELS = new Set(['info', 'warn']);
const ERROR_FILE_LEVELS = new Set(['error']);

/**
 * テキスト 1 行フォーマット（timestamp [level] [module] message {meta}）
 */
export const textLogFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
	winston.format.errors({ stack: true }),
	winston.format.printf((info) => {
		const extra: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(info)) {
			if (
				key === 'timestamp' ||
				key === 'level' ||
				key === 'message' ||
				key === 'module' ||
				key === 'stack' ||
				key === 'splat'
			) {
				continue;
			}
			extra[key] = value;
		}

		const modulePart =
			typeof info.module === 'string' && info.module !== '' ? ` [${info.module}]` : '';
		const extraKeys = Object.keys(extra);
		const extraPart = extraKeys.length > 0 ? ` ${JSON.stringify(extra)}` : '';
		const stackPart = typeof info.stack === 'string' && info.stack !== '' ? `\n${info.stack}` : '';
		return `${info.timestamp} [${info.level}]${modulePart} ${info.message}${extraPart}${stackPart}`;
	})
);

/**
 * 指定レベルだけを通す（transport.level の「以上」ではない）
 */
function exclusiveLevelFormat(allowed: Set<string>) {
	return winston.format((info) => (allowed.has(info.level) ? info : false))();
}

/**
 * filename.log → filename-%DATE%.log（既に %DATE% があればそのまま）
 */
function filenameWithDateToken(filename: string): string {
	if (filename.includes('%DATE%')) {
		return filename;
	}
	const dot = filename.lastIndexOf('.');
	if (dot <= 0) {
		return `${filename}-%DATE%`;
	}
	return `${filename.slice(0, dot)}-%DATE%${filename.slice(dot)}`;
}

/**
 * rolling に対応する datePattern。none のときは使わない
 */
function datePatternForRolling(rolling: LoggingRolling): string {
	return rolling === 'monthly' ? 'YYYY-MM' : 'YYYY-MM-DD';
}

/**
 * ファイル appender を Winston transport にする。disabled なら null
 */
function createFileTransport(
	appender: LoggingFileAppenderConfig,
	absoluteDir: string,
	allowedLevels: Set<string>,
	auditName: string
): winston.transport | null {
	if (!appender.enabled) {
		return null;
	}

	const format = winston.format.combine(exclusiveLevelFormat(allowedLevels), textLogFormat);

	if (appender.rolling === 'none') {
		return new winston.transports.File({
			filename: join(absoluteDir, appender.filename),
			format
		});
	}

	return new DailyRotateFile({
		dirname: absoluteDir,
		filename: filenameWithDateToken(appender.filename),
		datePattern: datePatternForRolling(appender.rolling),
		maxFiles: appender.maxFiles,
		auditFile: join(absoluteDir, auditName),
		format
	});
}

/**
 * LoggingConfig から Winston logger を組み立てる
 */
export function createWinstonLogger(config: LoggingConfig, silent = false): winston.Logger {
	const transports: winston.transport[] = [];

	if (config.console.enabled) {
		transports.push(
			new winston.transports.Console({
				format: textLogFormat
			})
		);
	}

	const fileEnabled = config.file.info.enabled || config.file.error.enabled;
	if (fileEnabled) {
		const absoluteDir = resolveApplicationPath(config.file.dir);
		mkdirSync(absoluteDir, { recursive: true });

		const infoTransport = createFileTransport(
			config.file.info,
			absoluteDir,
			INFO_FILE_LEVELS,
			'.audit-info.json'
		);
		const errorTransport = createFileTransport(
			config.file.error,
			absoluteDir,
			ERROR_FILE_LEVELS,
			'.audit-error.json'
		);
		if (infoTransport) {
			transports.push(infoTransport);
		}
		if (errorTransport) {
			transports.push(errorTransport);
		}
	}

	if (transports.length === 0) {
		transports.push(new winston.transports.Console({ silent: true, format: textLogFormat }));
	}

	return winston.createLogger({
		level: config.level as LoggingLevel,
		levels: winston.config.npm.levels,
		exitOnError: false,
		silent,
		transports
	});
}
