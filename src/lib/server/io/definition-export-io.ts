import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertSafeLogicalIdPathSegment } from '$lib/ir/ui-definition-meta';
import {
	loadApplicationConfig,
	resolveApplicationPath
} from '$lib/server/config/application-config';
import type { DefinitionArtifact } from '$lib/server/io/writers/definition-writer';

/**
 * 外部 UI 定義の書き込み結果
 */
export type DefinitionExportWriteResult = {
	targetId: string;
	logicalId: string;
	filename: string;
	relativePath: string;
	absolutePath: string;
	contentType: string;
	writtenAt: string;
};

/**
 * app.io.exportDir を絶対パスへ解決する
 */
export function resolveExportBaseDir(): string {
	const config = loadApplicationConfig();
	const exportDir = config.app.io?.exportDir?.trim();

	if (!exportDir) {
		throw new Error('app.io.exportDir is not configured');
	}

	return resolveApplicationPath(exportDir);
}

/**
 * exportDir/<targetId>/<logicalId>/ を解決する
 * ディレクトリ配置だけを知っており、拡張子・ファイル名規則は知らない
 */
export function resolveExportDirForTarget(targetId: string, logicalId: string): string {
	const safeTarget = assertSafeLogicalIdPathSegment(targetId);
	const safeLogicalId = assertSafeLogicalIdPathSegment(logicalId);

	return join(resolveExportBaseDir(), safeTarget, safeLogicalId);
}

/**
 * 成果物絶対パスを解決する（ファイル名は Writer 成果物由来）
 */
export function resolveExportFilePath(
	targetId: string,
	logicalId: string,
	filename: string
): string {
	return join(resolveExportDirForTarget(targetId, logicalId), filename);
}

/**
 * 指定ファイル名の成果物が存在するか判定する
 */
export async function hasExportedDefinition(
	targetId: string,
	logicalId: string,
	filename: string
): Promise<boolean> {
	const absolutePath = resolveExportFilePath(targetId, logicalId, filename);

	try {
		await access(absolutePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Writer 成果物を exportDir へ書き込む
 */
export async function writeExportedDefinition(
	targetId: string,
	logicalId: string,
	artifact: DefinitionArtifact,
	writtenAt: Date = new Date()
): Promise<DefinitionExportWriteResult> {
	const dir = resolveExportDirForTarget(targetId, logicalId);
	const absolutePath = join(dir, artifact.filename);
	const safeTarget = assertSafeLogicalIdPathSegment(targetId);
	const safeLogicalId = assertSafeLogicalIdPathSegment(logicalId);

	await mkdir(dir, { recursive: true });
	await writeFile(absolutePath, artifact.content, { encoding: 'utf8' });

	return {
		targetId: safeTarget,
		logicalId: safeLogicalId,
		filename: artifact.filename,
		relativePath: join(safeTarget, safeLogicalId, artifact.filename),
		absolutePath,
		contentType: artifact.contentType,
		writtenAt: writtenAt.toISOString()
	};
}

/**
 * 成果物ファイルを読み込む（存在しない場合は null）
 */
export async function readExportedDefinition(
	targetId: string,
	logicalId: string,
	filename: string
): Promise<{ content: string; filename: string; absolutePath: string } | null> {
	const absolutePath = resolveExportFilePath(targetId, logicalId, filename);

	try {
		const content = await readFile(absolutePath, 'utf8');
		return { content, filename, absolutePath };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}
