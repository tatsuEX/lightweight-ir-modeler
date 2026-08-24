import { load } from 'js-yaml';
import type {
	AppIoConfig,
	AppIoExportConfig,
	AppIoExportTemplateTargetConfig,
	ApplicationConfig,
	IrAutoSaveConfig
} from '$lib/config/application-types';
import {
	DEFAULT_CONFIRM_SNAPSHOT_DIR_CREATION,
	DEFAULT_ITEM_DELIMITER,
	type LayoutEditorConfig,
	type LayoutEditorPropertyConfig
} from '$lib/config/layout-editor-config';
import {
	DEFAULT_LOGGING_CONFIG,
	isLoggingLevel,
	isLoggingRolling,
	type LoggingConfig,
	type LoggingFileAppenderConfig
} from '$lib/config/logging-config';
import {
	type PreviewConfig,
	type PreviewSelectConfig,
	type PreviewSelectOption
} from '$lib/config/preview-config';

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
	const maxGenerations = block.maxGenerations === undefined ? 10 : block.maxGenerations;

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
 * layoutEditor.property ブロックをパースする
 */
function parseLayoutEditorProperty(raw: unknown): LayoutEditorPropertyConfig {
	const defaults: LayoutEditorPropertyConfig = {
		itemDelimiter: DEFAULT_ITEM_DELIMITER,
		confirmSnapshotDirCreation: DEFAULT_CONFIRM_SNAPSHOT_DIR_CREATION
	};

	if (raw === undefined) {
		return defaults;
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "layoutEditor.property" must be an object');
	}

	const block = raw as Record<string, unknown>;
	let itemDelimiter = defaults.itemDelimiter;
	if (block.itemDelimiter !== undefined) {
		if (typeof block.itemDelimiter !== 'string' || block.itemDelimiter === '') {
			throw new Error(
				'application config "layoutEditor.property.itemDelimiter" must be a non-empty string'
			);
		}
		itemDelimiter = block.itemDelimiter;
	}

	let confirmSnapshotDirCreation = defaults.confirmSnapshotDirCreation;
	if (block.confirmSnapshotDirCreation !== undefined) {
		if (typeof block.confirmSnapshotDirCreation !== 'boolean') {
			throw new Error(
				'application config "layoutEditor.property.confirmSnapshotDirCreation" must be a boolean'
			);
		}
		confirmSnapshotDirCreation = block.confirmSnapshotDirCreation;
	}

	return { itemDelimiter, confirmSnapshotDirCreation };
}

/**
 * layoutEditor ブロックをパースする（未設定時は既定値）
 */
function parseLayoutEditor(raw: unknown): LayoutEditorConfig {
	if (raw === undefined) {
		return { property: parseLayoutEditorProperty(undefined) };
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "layoutEditor" must be an object');
	}

	const block = raw as Record<string, unknown>;
	return {
		property: parseLayoutEditorProperty(block.property)
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
 * app.io.export.templates ブロックをパースする
 */
function parseAppIoExportTemplates(
	raw: unknown
): Record<string, AppIoExportTemplateTargetConfig> | undefined {
	if (raw === undefined) {
		return undefined;
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "app.io.export.templates" must be an object');
	}

	const templates: Record<string, AppIoExportTemplateTargetConfig> = {};
	for (const [targetId, value] of Object.entries(raw as Record<string, unknown>)) {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error(
				`application config "app.io.export.templates.${targetId}" must be an object`
			);
		}

		const dir = (value as Record<string, unknown>).dir;
		if (typeof dir !== 'string' || dir.trim() === '') {
			throw new Error(
				`application config "app.io.export.templates.${targetId}.dir" must be a non-empty string`
			);
		}

		templates[targetId] = { dir: dir.trim() };
	}

	return templates;
}

/**
 * app.io.export ブロックをパースする
 */
function parseAppIoExport(raw: unknown): AppIoExportConfig | undefined {
	if (raw === undefined) {
		return undefined;
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "app.io.export" must be an object');
	}

	const block = raw as Record<string, unknown>;
	const templates = parseAppIoExportTemplates(block.templates);
	if (templates === undefined) {
		return {};
	}

	return { templates };
}

/**
 * app.io ブロックをパースする
 */
function parseAppIo(raw: unknown): AppIoConfig | undefined {
	if (raw === undefined) {
		return undefined;
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "app.io" must be an object');
	}

	const block = raw as Record<string, unknown>;
	const io: AppIoConfig = {};

	if (block.exportDir !== undefined) {
		if (typeof block.exportDir !== 'string' || block.exportDir.trim() === '') {
			throw new Error('application config "app.io.exportDir" must be a non-empty string when set');
		}
		io.exportDir = block.exportDir.trim();
	}

	if (block.importDir !== undefined) {
		if (typeof block.importDir !== 'string' || block.importDir.trim() === '') {
			throw new Error('application config "app.io.importDir" must be a non-empty string when set');
		}
		io.importDir = block.importDir.trim();
	}

	const exportConfig = parseAppIoExport(block.export);
	if (exportConfig !== undefined) {
		io.export = exportConfig;
	}

	return io;
}

/**
 * logging.file の info / error appender をパースする
 */
function parseLoggingFileAppender(
	raw: unknown,
	pathPrefix: string,
	defaults: LoggingFileAppenderConfig
): LoggingFileAppenderConfig {
	if (raw === undefined) {
		return { ...defaults };
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error(`application config "${pathPrefix}" must be an object`);
	}

	const block = raw as Record<string, unknown>;
	let enabled = defaults.enabled;
	if (block.enabled !== undefined) {
		if (typeof block.enabled !== 'boolean') {
			throw new Error(`application config "${pathPrefix}.enabled" must be a boolean`);
		}
		enabled = block.enabled;
	}

	let filename = defaults.filename;
	if (block.filename !== undefined) {
		if (typeof block.filename !== 'string' || block.filename.trim() === '') {
			throw new Error(`application config "${pathPrefix}.filename" must be a non-empty string`);
		}
		filename = block.filename.trim();
	}

	let rolling = defaults.rolling;
	if (block.rolling !== undefined) {
		if (typeof block.rolling !== 'string' || !isLoggingRolling(block.rolling)) {
			throw new Error(
				`application config "${pathPrefix}.rolling" must be daily, monthly, or none`
			);
		}
		rolling = block.rolling;
	}

	let maxFiles = defaults.maxFiles;
	if (block.maxFiles !== undefined) {
		if (typeof block.maxFiles === 'number') {
			if (!Number.isInteger(block.maxFiles) || block.maxFiles <= 0) {
				throw new Error(
					`application config "${pathPrefix}.maxFiles" must be a positive integer or string`
				);
			}
			maxFiles = block.maxFiles;
		} else if (typeof block.maxFiles === 'string' && block.maxFiles.trim() !== '') {
			maxFiles = block.maxFiles.trim();
		} else {
			throw new Error(
				`application config "${pathPrefix}.maxFiles" must be a positive integer or string`
			);
		}
	}

	return { enabled, filename, rolling, maxFiles };
}

/**
 * logging ブロックをパースする（未設定時はコンソールのみ）
 */
function parseLogging(raw: unknown): LoggingConfig {
	if (raw === undefined) {
		return {
			level: DEFAULT_LOGGING_CONFIG.level,
			console: { ...DEFAULT_LOGGING_CONFIG.console },
			file: {
				dir: DEFAULT_LOGGING_CONFIG.file.dir,
				info: { ...DEFAULT_LOGGING_CONFIG.file.info },
				error: { ...DEFAULT_LOGGING_CONFIG.file.error }
			}
		};
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('application config "logging" must be an object');
	}

	const block = raw as Record<string, unknown>;
	let level = DEFAULT_LOGGING_CONFIG.level;
	if (block.level !== undefined) {
		if (typeof block.level !== 'string' || !isLoggingLevel(block.level)) {
			throw new Error(
				'application config "logging.level" must be error, warn, info, http, verbose, debug, or silly'
			);
		}
		level = block.level;
	}

	let consoleEnabled = DEFAULT_LOGGING_CONFIG.console.enabled;
	if (block.console !== undefined) {
		if (block.console === null || typeof block.console !== 'object' || Array.isArray(block.console)) {
			throw new Error('application config "logging.console" must be an object');
		}
		const consoleBlock = block.console as Record<string, unknown>;
		if (consoleBlock.enabled !== undefined) {
			if (typeof consoleBlock.enabled !== 'boolean') {
				throw new Error('application config "logging.console.enabled" must be a boolean');
			}
			consoleEnabled = consoleBlock.enabled;
		}
	}

	const fileDefaults = DEFAULT_LOGGING_CONFIG.file;
	let fileDir = fileDefaults.dir;
	let fileBlock: Record<string, unknown> | undefined;
	if (block.file !== undefined) {
		if (block.file === null || typeof block.file !== 'object' || Array.isArray(block.file)) {
			throw new Error('application config "logging.file" must be an object');
		}
		fileBlock = block.file as Record<string, unknown>;
		if (fileBlock.dir !== undefined) {
			if (typeof fileBlock.dir !== 'string' || fileBlock.dir.trim() === '') {
				throw new Error('application config "logging.file.dir" must be a non-empty string');
			}
			fileDir = fileBlock.dir.trim();
		}
	}

	return {
		level,
		console: { enabled: consoleEnabled },
		file: {
			dir: fileDir,
			info: parseLoggingFileAppender(fileBlock?.info, 'logging.file.info', fileDefaults.info),
			error: parseLoggingFileAppender(fileBlock?.error, 'logging.file.error', fileDefaults.error)
		}
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

	const appRecord = app as Record<string, unknown>;
	const name = appRecord.name;
	if (typeof name !== 'string' || name.length === 0) {
		throw new Error('application config requires non-empty "app.name"');
	}

	const previewBlock = root.preview;
	if (previewBlock === undefined) {
		throw new Error('application config requires a "preview" object');
	}

	const io = parseAppIo(appRecord.io);
	const config: ApplicationConfig = {
		app: io ? { name, io } : { name },
		layoutEditor: parseLayoutEditor(root.layoutEditor),
		preview: parsePreview(previewBlock),
		logging: parseLogging(root.logging)
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
