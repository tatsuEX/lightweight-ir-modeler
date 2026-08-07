import type { UIDefinition } from '$lib/store/layout-editor/layout-editor.svelte';

/**
 * 明示出力 API の成功レスポンス
 */
export type UiExportResult = {
	target: string;
	logicalId: string;
	relativePath: string;
	filename: string;
	writtenAt: string;
};

/**
 * ダウンロード結果
 */
export type UiDownloadResult = {
	filename: string;
	autoExported: boolean;
	exportSource: 'existing' | 'snapshot';
	blob: Blob;
};

/**
 * Preview から呼ぶ外部 UI 定義出力ポート（target 別）
 */
export interface UiExportClient {
	readonly targetId: string;
	/**
	 * 編集中 IR を exportDir へ出力する
	 */
	export(ui: UIDefinition): Promise<UiExportResult>;
	/**
	 * 成果物をダウンロードする（未出力時はサーバ側で snapshot から export）
	 */
	download(logicalId: string): Promise<UiDownloadResult>;
}

/**
 * HTTP 経由の共通 UiExportClient 実装
 */
export class HttpUiExportClient implements UiExportClient {
	/**
	 * targetId 付きクライアントを生成する
	 */
	constructor(readonly targetId: string) {}

	/**
	 * 編集中 IR を POST /api/ui/export で出力する
	 */
	async export(ui: UIDefinition): Promise<UiExportResult> {
		const response = await fetch('/api/ui/export', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				target: this.targetId,
				uiDefinition: {
					logicalId: ui.logicalId,
					name: ui.name,
					description: ui.description,
					version: ui.version
				},
				components: ui.components
			})
		});

		const payload = (await response.json().catch(() => ({}))) as {
			error?: string;
			target?: string;
			logicalId?: string;
			relativePath?: string;
			filename?: string;
			writtenAt?: string;
			issues?: { path: string; message: string }[];
		};

		if (!response.ok) {
			const issueSummary = payload.issues?.[0]
				? `${payload.issues[0].path}: ${payload.issues[0].message}`
				: undefined;
			throw new Error(issueSummary ?? payload.error ?? `export failed (${response.status})`);
		}

		return {
			target: payload.target ?? this.targetId,
			logicalId: payload.logicalId ?? ui.logicalId,
			relativePath: payload.relativePath ?? '',
			filename: payload.filename ?? '',
			writtenAt: payload.writtenAt ?? ''
		};
	}

	/**
	 * GET /api/ui/download/<target>/<logicalId> で成果物を取得する
	 */
	async download(logicalId: string): Promise<UiDownloadResult> {
		const response = await fetch(
			`/api/ui/download/${encodeURIComponent(this.targetId)}/${encodeURIComponent(logicalId)}`
		);

		if (!response.ok) {
			const payload = (await response.json().catch(() => ({}))) as { error?: string };
			throw new Error(payload.error ?? `download failed (${response.status})`);
		}

		const disposition = response.headers.get('Content-Disposition') ?? '';
		const filenameMatch = /filename="([^"]+)"/.exec(disposition);
		const filename = filenameMatch?.[1] ?? `${logicalId}`;
		const autoExported = response.headers.get('X-Ui-Export-Auto') === 'true';
		const sourceHeader = response.headers.get('X-Ui-Export-Source');
		const exportSource: 'existing' | 'snapshot' =
			sourceHeader === 'snapshot' || autoExported ? 'snapshot' : 'existing';

		return {
			filename,
			autoExported,
			exportSource,
			blob: await response.blob()
		};
	}
}

/**
 * PrimeFaces 向け出力クライアント
 */
export class PrimeFacesExportClient extends HttpUiExportClient {
	/**
	 * PrimeFaces クライアントを生成する
	 */
	constructor() {
		super('primefaces');
	}
}

/**
 * IM-Forma 向け出力クライアント
 */
export class IMFormaExportClient extends HttpUiExportClient {
	/**
	 * IM-Forma クライアントを生成する
	 */
	constructor() {
		super('im-forma');
	}
}

const UI_EXPORT_CLIENT_REGISTRY: Record<string, UiExportClient> = {
	primefaces: new PrimeFacesExportClient(),
	'im-forma': new IMFormaExportClient()
};

/**
 * targetId に対応する UiExportClient を解決する
 */
export function resolveUiExportClient(targetId: string): UiExportClient | undefined {
	return UI_EXPORT_CLIENT_REGISTRY[targetId];
}

/**
 * Blob をブラウザダウンロードとして保存する
 */
export function saveBlobAsFile(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
