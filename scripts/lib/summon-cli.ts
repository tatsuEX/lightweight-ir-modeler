import { existsSync, readFileSync } from 'node:fs';
import { loadRestoredIrSnapshotFile } from '$lib/server/io/ir-snapshot-file';
import { resolveUserPath } from './paths';
import { summonFromSnapshot } from './summon';

/**
 * summon CLI の解析結果
 */
export type SummonCliOptions = {
	help: boolean;
	target: string | undefined;
	template: string | undefined;
	source: string | undefined;
	out: string | undefined;
	projectionIds: string[] | undefined;
	bytesPerChar: number | undefined;
};

/**
 * summon 実行結果（I/O 前）
 */
export type SummonCliRunResult = {
	output: string;
	warnings: string[];
	outPath: string | undefined;
};

/**
 * ヘルプ文言を返す
 */
export function summonUsage(): string {
	return `Usage:
  npm run arcane:summon -- --target <id> --template <hbs> --source <yaml> [--out <file>] [--projection <ids>] [--bytes-per-char <n>]

Options:
      --target <id>            テンプレートへ渡す targetId（任意文字列）
      --template <hbs>         Handlebars テンプレートパス
      --source <yaml>          IR snapshot YAML ファイル
  -o, --out <file>             出力ファイル（省略時は stdout）
      --projection <ids>       射影プラグイン id（カンマ区切り、例: by-logical-id,db-maxlength）
      --bytes-per-char <n>     db-maxlength のバイト倍率（正の整数、省略時 3）
  -h, --help                   このヘルプ

Examples:
  npm run arcane:summon -- --target primefaces --template ./create-events.js.hbs --source ./ir-snapshot.yaml
  npm run arcane:summon -- --target primefaces --template ./x.hbs --source ./s.yaml > out.js
  npm run arcane:summon -- --target primefaces --template ./create-table.sql.hbs --source ./s.yaml --projection by-logical-id,db-maxlength
`;
}

/**
 * カンマ区切りの射影 id リストを配列にする
 */
export function parseProjectionIdList(raw: string): string[] {
	return raw
		.split(',')
		.map((pluginId) => pluginId.trim())
		.filter((pluginId) => pluginId !== '');
}

/**
 * --bytes-per-char の値を正の整数として読む
 */
function parseBytesPerChar(raw: string): number {
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error('--bytes-per-char must be a positive integer');
	}

	return value;
}

/**
 * argv から summon オプションを読む
 */
export function parseSummonCliArgs(argv: string[]): SummonCliOptions {
	const options: SummonCliOptions = {
		help: false,
		target: undefined,
		template: undefined,
		source: undefined,
		out: undefined,
		projectionIds: undefined,
		bytesPerChar: undefined
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		/**
		 * 次の argv 要素を値として消費する
		 */
		const next = () => {
			const value = argv[i + 1];
			if (value === undefined || value.startsWith('-')) {
				throw new Error(`missing value for ${arg}`);
			}
			i += 1;
			return value;
		};

		switch (arg) {
			case '-h':
			case '--help':
				options.help = true;
				break;
			case '--target':
				options.target = next();
				break;
			case '--template':
				options.template = next();
				break;
			case '--source':
			case '--src':
				options.source = next();
				break;
			case '-o':
			case '--out':
				options.out = next();
				break;
			case '--projection':
				options.projectionIds = parseProjectionIdList(next());
				break;
			case '--bytes-per-char':
				options.bytesPerChar = parseBytesPerChar(next());
				break;
			default:
				throw new Error(`unknown argument: ${arg}`);
		}
	}

	return options;
}

/**
 * 必須パスを解決し、存在しなければエラーにする
 */
function requireExistingFile(flag: string, filePath: string | undefined): string {
	if (filePath === undefined || filePath.trim() === '') {
		throw new Error(`${flag} is required`);
	}

	const resolved = resolveUserPath(filePath.trim());
	if (!existsSync(resolved)) {
		throw new Error(`${flag} not found: ${resolved}`);
	}

	return resolved;
}

/**
 * summon CLI 本体を実行する（stdout / ファイル書き込みはしない）
 */
export function runSummonCli(argv: string[]): SummonCliRunResult {
	const options = parseSummonCliArgs(argv);
	if (options.help) {
		return { output: summonUsage(), warnings: [], outPath: undefined };
	}

	const target = options.target?.trim() ?? '';
	if (target === '') {
		throw new Error('--target is required');
	}

	const templatePath = requireExistingFile('--template', options.template);
	const sourcePath = requireExistingFile('--source', options.source);
	const snapshot = loadRestoredIrSnapshotFile(sourcePath);
	const templateSource = readFileSync(templatePath, 'utf8');
	const pluginOptions =
		options.bytesPerChar === undefined
			? undefined
			: { 'db-maxlength': { bytesPerChar: options.bytesPerChar } };
	const { output, warnings } = summonFromSnapshot({
		target,
		templateSource,
		snapshot,
		projectionIds: options.projectionIds,
		pluginOptions
	});

	return {
		output,
		warnings,
		outPath: options.out?.trim() ? resolveUserPath(options.out.trim()) : undefined
	};
}
