import type { RawDefinition } from '$lib/raw/raw-definition';

/**
 * 取り込む外部 UI 定義ファイルの中身
 */
export type DefinitionSource = {
	filename: string;
	content: string;
};

/**
 * 外部 UI 定義ファイル → RawDefinition の入力ポート（DefinitionWriter の対）
 */
export interface DefinitionReader {
	readonly targetId: string;
	/** 受け付ける拡張子（UI の accept 属性とサーバー側検査に使う） */
	readonly acceptExtensions: readonly string[];
	/**
	 * 外部定義ファイルを RawDefinition へ変換する
	 */
	toRaw(source: DefinitionSource): RawDefinition;
}

/**
 * 外部定義ファイルの読み取りに失敗したことを表す
 * message は利用者に提示するため日本語で組み立てる
 */
export class DefinitionReadError extends Error {
	/**
	 * target と理由付きの読み取りエラーを生成する
	 */
	constructor(
		readonly targetId: string,
		message: string
	) {
		super(message);
		this.name = 'DefinitionReadError';
	}
}

/**
 * ファイル名の拡張子が Reader の受付対象か判定する
 */
export function acceptsFilename(reader: DefinitionReader, filename: string): boolean {
	const lowered = filename.toLowerCase();
	return reader.acceptExtensions.some((extension) => lowered.endsWith(extension));
}
