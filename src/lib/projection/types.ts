import type { RestoredIrSnapshot } from '$lib/ir/snapshot';

/**
 * 既定の射影プラグイン id リスト（opt-in。空なら射影なし）
 */
export const DEFAULT_PROJECTION_IDS: readonly string[] = [];

/**
 * 復元済み IR に読み取り専用の射影キーを足した view
 *
 * WARN: snapshot / store に書き戻さない。SSOT は `components[]` のまま。
 */
export type IrProjectionView = RestoredIrSnapshot & {
	componentsByLogicalId?: Record<string, unknown>;
};

/**
 * `applyProjections` の optional 上書き
 */
export type ApplyProjectionsOptions = {
	projectionIds?: readonly string[];
	pluginOptions?: Record<string, Record<string, unknown>>;
};

/**
 * 射影の適用結果
 */
export type ApplyProjectionsResult = {
	view: IrProjectionView;
	warnings: string[];
};

/**
 * 射影プラグインの適用タイミング
 *
 * `transform` を先に、`index` を後に走らせる（呼び出し側の id 順には依存しない）。
 */
export type ProjectionPluginKind = 'transform' | 'index';

/**
 * in-repo 射影プラグイン（コンパイル時登録）
 */
export type IrProjectionPlugin = {
	id: string;
	kind: ProjectionPluginKind;
	/**
	 * view を変形して返す（入力を mutate しない）
	 */
	project: (
		view: IrProjectionView,
		options: Record<string, unknown> | undefined,
		warnings: string[]
	) => IrProjectionView;
};
