import type { RawDefinition } from '$lib/raw/raw-definition';

/**
 * Writer が生成する成果物（ファイル名・本文・MIME は形式固有知識）
 */
export type DefinitionArtifact = {
	filename: string;
	content: string;
	contentType: string;
};

/**
 * 外部 UI 定義ファイルのシリアライザ（サーバ側）
 *
 * 拡張子や MIME を共有 IO が解釈しないよう、ファイル識別は Writer が返す。
 * interface に fileExtension のような形式断片は載せない。
 */
export interface DefinitionWriter {
	readonly targetId: string;
	/**
	 * logicalId に対する成果物のファイル名と Content-Type を返す（本文は作らない）
	 */
	describeArtifact(logicalId: string): Pick<DefinitionArtifact, 'filename' | 'contentType'>;
	/**
	 * Raw を成果物へ変換する
	 */
	toArtifact(raw: RawDefinition): DefinitionArtifact;
}
