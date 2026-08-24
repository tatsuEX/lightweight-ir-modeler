import type { RawDefinition } from '$lib/raw/raw-definition';
import {
	DefinitionReadError,
	type DefinitionReader,
	type DefinitionSource
} from '$lib/server/io/readers/definition-reader';
import { parseXml } from '$lib/server/io/readers/parse/parse-xml';
import { unshapePrimeFaces } from '$lib/server/io/readers/unshape/primefaces-unshape';
import { PRIMEFACES_TARGET_ID } from '$lib/server/io/writers/shape/primefaces-shape';
import { getLogger, runLogged } from '$lib/server/logging/logger';

const logger = getLogger(import.meta.url);

/**
 * PrimeFaces XHTML 用 Reader
 */
export class PrimeFacesReader implements DefinitionReader {
	readonly targetId = PRIMEFACES_TARGET_ID;
	readonly acceptExtensions = ['.xhtml'] as const;

	/**
	 * PrimeFaces XHTML ファイルを RawDefinition へ変換する
	 */
	toRaw(source: DefinitionSource): RawDefinition {
		return runLogged(
			logger,
			'toRaw',
			{ targetId: this.targetId, filename: source.filename, bytes: source.content.length },
			() => {
				let document: unknown;
				try {
					document = runLogged(
						logger,
						'parseXml',
						{ filename: source.filename, bytes: source.content.length },
						() => parseXml(source.content)
					);
				} catch (error) {
					if (error instanceof DefinitionReadError) {
						throw error;
					}
					const detail = error instanceof Error ? error.message : String(error);
					throw new DefinitionReadError(this.targetId, `XML として解析できません: ${detail}`);
				}

				try {
					return runLogged(logger, 'unshapePrimeFaces', { filename: source.filename }, () =>
						unshapePrimeFaces(document)
					);
				} catch (error) {
					if (error instanceof DefinitionReadError) {
						throw error;
					}
					const detail = error instanceof Error ? error.message : String(error);
					throw new DefinitionReadError(
						this.targetId,
						`PrimeFaces 定義として読み取れません: ${detail}`
					);
				}
			}
		);
	}
}
