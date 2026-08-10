import type { RawDefinition } from '$lib/raw/raw-definition';
import {
	DefinitionReadError,
	type DefinitionReader,
	type DefinitionSource
} from '$lib/server/io/readers/definition-reader';
import { parseJson } from '$lib/server/io/readers/parse/parse-json';
import { unshapeImForma } from '$lib/server/io/readers/unshape/im-forma-unshape';
import { IM_FORMA_TARGET_ID } from '$lib/server/io/writers/shape/im-forma-shape';

/**
 * IM-Forma JSON 用 Reader
 */
export class IMFormaReader implements DefinitionReader {
	readonly targetId = IM_FORMA_TARGET_ID;
	readonly acceptExtensions = ['.json'] as const;

	/**
	 * IM-Forma JSON ファイルを RawDefinition へ変換する
	 */
	toRaw(source: DefinitionSource): RawDefinition {
		let payload: unknown;
		try {
			payload = parseJson(source.content);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			throw new DefinitionReadError(this.targetId, `JSON として解析できません: ${detail}`);
		}

		try {
			return unshapeImForma(payload);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			throw new DefinitionReadError(this.targetId, `IM-Forma 定義として読み取れません: ${detail}`);
		}
	}
}
