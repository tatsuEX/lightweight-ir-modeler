import type { ImportedDefinition } from '$lib/transform/imported-definition';

/**
 * 外部 UI 定義ファイル取り込みポート（target 別）
 */
export interface UiImportClient {
	readonly targetId: string;
	/** ファイル選択ダイアログの accept に使う拡張子 */
	readonly acceptExtensions: readonly string[];
	/**
	 * 選択したファイルをサーバーで IR へ変換して取得する
	 */
	importDefinition(file: File): Promise<ImportedDefinition>;
}

/**
 * HTTP 経由の共通 UiImportClient 実装
 */
export class HttpUiImportClient implements UiImportClient {
	/**
	 * targetId と受付拡張子付きクライアントを生成する
	 */
	constructor(
		readonly targetId: string,
		readonly acceptExtensions: readonly string[]
	) {}

	/**
	 * POST /api/ui/import へ multipart 送信して IR を取得する
	 */
	async importDefinition(file: File): Promise<ImportedDefinition> {
		const form = new FormData();
		form.append('target', this.targetId);
		form.append('file', file);

		const response = await fetch('/api/ui/import', { method: 'POST', body: form });
		const payload = (await response.json().catch(() => ({}))) as {
			error?: string;
			uiDefinition?: ImportedDefinition['uiDefinition'];
			components?: unknown[];
			issues?: { path: string; message: string }[];
		};

		if (!response.ok) {
			const issueSummary = payload.issues?.[0]
				? `${payload.issues[0].path}: ${payload.issues[0].message}`
				: undefined;
			throw new Error(issueSummary ?? payload.error ?? `import failed (${response.status})`);
		}

		if (!payload.uiDefinition || !Array.isArray(payload.components)) {
			throw new Error('取り込み結果の形式が不正です');
		}

		return { uiDefinition: payload.uiDefinition, components: payload.components };
	}
}

/**
 * IM-Forma 向け取り込みクライアント
 */
export class IMFormaImportClient extends HttpUiImportClient {
	/**
	 * IM-Forma クライアントを生成する
	 */
	constructor() {
		super('im-forma', ['.json']);
	}
}

/**
 * PrimeFaces 向け取り込みクライアント
 */
export class PrimeFacesImportClient extends HttpUiImportClient {
	/**
	 * PrimeFaces クライアントを生成する
	 */
	constructor() {
		super('primefaces', ['.xhtml']);
	}
}

// WARN: Reader 実装済み target だけを登録する。UI の選択肢はこの registry で絞り込む。
const UI_IMPORT_CLIENT_REGISTRY: Record<string, UiImportClient> = {
	'im-forma': new IMFormaImportClient(),
	primefaces: new PrimeFacesImportClient()
};

/**
 * targetId に対応する UiImportClient を解決する
 */
export function resolveUiImportClient(targetId: string): UiImportClient | undefined {
	return UI_IMPORT_CLIENT_REGISTRY[targetId];
}

/**
 * 取り込み可能な targetId 一覧を返す
 */
export function listUiImportTargetIds(): string[] {
	return Object.keys(UI_IMPORT_CLIENT_REGISTRY);
}
