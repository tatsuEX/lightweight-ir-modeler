import { isAbsolute, resolve } from 'node:path';

/**
 * ユーザー指定パスを cwd 基準の絶対パスへ解決する
 */
export function resolveUserPath(filePath: string): string {
	return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
}
