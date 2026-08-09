import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import { resolveExportTemplateDir } from '$lib/server/config/application-config';

const handlebars = Handlebars.create();

// Handlebars helpers
// ================================================================================================

// 文字列比較
// usage: {{eq left right}}
handlebars.registerHelper('eq', (left: unknown, right: unknown) => left === right);

/**
 * Handlebars コンパイルキャッシュ
 */
const compiledCache = new Map<string, Handlebars.TemplateDelegate>();

/** type をテンプレートファイル名に使うときの許可パターン */
const COMPONENT_TYPE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const UNSUPPORTED_COMPONENT_TEMPLATE = 'components/unsupported.hbs';

/**
 * テンプレート絶対パスを読み込み、コンパイル結果をキャッシュして返す
 */
function getCompiledTemplate(absoluteTemplatePath: string): Handlebars.TemplateDelegate {
	const cached = compiledCache.get(absoluteTemplatePath);
	if (cached) {
		return cached;
	}

	const source = readFileSync(absoluteTemplatePath, 'utf8');
	const compiled = handlebars.compile(source);
	compiledCache.set(absoluteTemplatePath, compiled);
	return compiled;
}

/**
 * Handlebars ソース文字列を描画する（単体テスト・内部用）
 *
 * WARN: ユーザー由来文字列はテンプレート側で {{ }} を使うこと。
 * 事前レンダー済み断片を親へ渡すときだけ SafeString / {{{ }}} を使う。
 */
export function renderHandlebarsSource(
	source: string,
	context: Record<string, unknown>
): string {
	return handlebars.compile(source)(context);
}

/**
 * context.type をコンポーネント解決用の文字列として取り出す
 */
function readContextType(context: Record<string, unknown>): string {
	return typeof context.type === 'string' ? context.type : '';
}

/**
 * app.io.export.templates.<targetId>.dir 上のテンプレートを描画する
 *
 * templateFileName 省略時は context.type から components/<type>.hbs を解決する。
 * （form など明示テンプレートは第3引数で渡す）
 */
export function serializeHandlebarsTemplate(
	targetId: string,
	context: Record<string, unknown>,
	templateFileName?: string
): string {
	const templateFile =
		templateFileName ?? resolveComponentTemplateFile(targetId, readContextType(context));
	const templatePath = join(resolveExportTemplateDir(targetId), templateFile);
	const template = getCompiledTemplate(templatePath);
	return template(context);
}

/**
 * IR/Raw type からコンポーネントテンプレート相対パスを解決する
 *
 * WARN: type をパス連結するため、許可パターン外・ファイル無しは unsupported に落とす。
 */
export function resolveComponentTemplateFile(targetId: string, type: string): string {
	if (!COMPONENT_TYPE_PATTERN.test(type)) {
		return UNSUPPORTED_COMPONENT_TEMPLATE;
	}

	const relativePath = `components/${type}.hbs`;
	const absolutePath = join(resolveExportTemplateDir(targetId), relativePath);
	if (!existsSync(absolutePath)) {
		return UNSUPPORTED_COMPONENT_TEMPLATE;
	}

	return relativePath;
}

/**
 * 事前レンダー済み HTML 断片を親テンプレートへ二重 escape せず渡す
 */
export function toHandlebarsSafeString(html: string): Handlebars.SafeString {
	return new handlebars.SafeString(html);
}

/**
 * テスト用: Handlebars コンパイルキャッシュを破棄する
 */
export function clearHandlebarsTemplateCache(): void {
	compiledCache.clear();
}
