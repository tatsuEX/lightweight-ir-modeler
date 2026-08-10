import type { LayoutEditorConfig } from '$lib/config/layout-editor-config';
import type { PreviewConfig } from '$lib/config/preview-config';

/**
 * IR 自動保存設定（application.yml の ir.autoSave）
 */
export type IrAutoSaveConfig = {
	enabled: boolean;
	delay: number;
	dir: string;
	maxGenerations: number;
};

/**
 * 出力 target ごとのテンプレート配置（Handlebars 等）
 */
export type AppIoExportTemplateTargetConfig = {
	dir: string;
};

/**
 * 外部 UI 定義エクスポート関連の I/O 設定
 */
export type AppIoExportConfig = {
	templates?: Record<string, AppIoExportTemplateTargetConfig>;
};

/**
 * アプリ I/O パス設定
 */
export type AppIoConfig = {
	exportDir?: string;
	importDir?: string;
	export?: AppIoExportConfig;
};

/**
 * application.yml 相当の静的アプリ設定（型のみ・クライアントからも参照可）
 */
export type ApplicationConfig = {
	app: {
		name: string;
		io?: AppIoConfig;
	};
	ir?: {
		autoSave?: IrAutoSaveConfig;
	};
	layoutEditor: LayoutEditorConfig;
	preview: PreviewConfig;
};
