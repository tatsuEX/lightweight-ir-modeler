#!/usr/bin/env node
/**
 * JSON Schema の JSON ↔ YAML 相互変換 CLI。
 *
 * WARN: 意味の正規化はしない（コメント付き YAML は js-yaml の挙動に従う）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';

/**
 * @typedef {'json' | 'yaml'} SchemaFileFormat
 */

/**
 * @typedef {object} CliOptions
 * @property {boolean} help
 * @property {string | undefined} input
 * @property {string | undefined} out
 * @property {SchemaFileFormat | undefined} to
 * @property {boolean} check
 */

/**
 * ヘルプ文言を返す
 * @returns {string}
 */
function usage() {
	return `Usage:
  npm run schema:convert -- <input> [options]

Options:
  -o, --out <path>       出力ファイル（省略時は入力と同 stem の他形式）
      --to <json|yaml>   出力形式（省略時は入力拡張子から反対側を推定）
      --check            変換往復でオブジェクトが一致するか検証（ファイルは書かない）
  -h, --help             このヘルプ

Examples:
  npm run schema:convert -- schemas/raw/im-forma.schema.json
  npm run schema:convert -- schemas/raw/im-forma.schema.yaml -o schemas/raw/im-forma.schema.json
  npm run schema:convert -- schemas/raw/im-forma.schema.yaml --check
`;
}

/**
 * オプション値の有無を検証する
 * @param {string} flag
 * @param {string | undefined} value
 * @returns {string}
 */
function requireValue(flag, value) {
	if (value === undefined || value.length === 0 || value.startsWith('-')) {
		throw new Error(`${flag} には値が必要です`);
	}
	return value;
}

/**
 * CLI 引数を解析する
 * @param {string[]} argv
 * @returns {CliOptions}
 */
function parseArgs(argv) {
	/** @type {CliOptions} */
	const options = {
		help: false,
		input: undefined,
		out: undefined,
		to: undefined,
		check: false
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '-h' || arg === '--help') {
			options.help = true;
			continue;
		}
		if (arg === '-o' || arg === '--out') {
			options.out = requireValue(arg, argv[++i]);
			continue;
		}
		if (arg === '--to') {
			const raw = requireValue(arg, argv[++i]).toLowerCase();
			if (raw !== 'json' && raw !== 'yaml' && raw !== 'yml') {
				throw new Error(`--to は json または yaml を指定してください: ${raw}`);
			}
			options.to = raw === 'yml' ? 'yaml' : raw;
			continue;
		}
		if (arg === '--check') {
			options.check = true;
			continue;
		}
		if (arg.startsWith('-')) {
			throw new Error(`不明なオプションです: ${arg}`);
		}
		if (options.input) {
			throw new Error(`入力は 1 つだけ指定してください（余分: ${arg}）`);
		}
		options.input = arg;
	}

	return options;
}

/**
 * 拡張子からファイル形式を判定する
 * @param {string} filePath
 * @returns {SchemaFileFormat}
 */
function formatFromPath(filePath) {
	const ext = extname(filePath).toLowerCase();
	if (ext === '.yaml' || ext === '.yml') {
		return 'yaml';
	}
	if (ext === '.json') {
		return 'json';
	}
	throw new Error(`未対応の拡張子です（.json / .yaml / .yml）: ${filePath}`);
}

/**
 * 形式に対応する拡張子を返す
 * @param {SchemaFileFormat} format
 * @returns {string}
 */
function extensionForFormat(format) {
	return format === 'yaml' ? '.yaml' : '.json';
}

/**
 * スキーマパスの拡張子を他形式へ付け替える
 * @param {string} filePath
 * @param {SchemaFileFormat} targetFormat
 * @returns {string}
 */
function withSchemaFileFormat(filePath, targetFormat) {
	const ext = extname(filePath).toLowerCase();
	if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
		return `${filePath.slice(0, -ext.length)}${extensionForFormat(targetFormat)}`;
	}
	return `${filePath}.schema${extensionForFormat(targetFormat)}`;
}

/**
 * cwd からの相対表示パスを返す（表示用）
 * @param {string} absolutePath
 * @param {string} cwd
 * @returns {string}
 */
function displayPath(absolutePath, cwd) {
	const rel = relative(cwd, absolutePath);
	if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
		return absolutePath;
	}
	return rel.replace(/\\/g, '/');
}

/**
 * スキーマファイルをオブジェクトとして読む
 * @param {string} filePath
 * @param {SchemaFileFormat} format
 * @returns {Record<string, unknown>}
 */
function readSchemaObject(filePath, format) {
	const text = readFileSync(filePath, 'utf8');
	const parsed = format === 'yaml' ? yamlLoad(text) : JSON.parse(text);

	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`schema はオブジェクトである必要があります: ${filePath}`);
	}

	return /** @type {Record<string, unknown>} */ (parsed);
}

/**
 * スキーマオブジェクトを指定形式の本文にする
 * @param {Record<string, unknown>} schemaObject
 * @param {SchemaFileFormat} format
 * @returns {string}
 */
function serializeSchemaObject(schemaObject, format) {
	if (format === 'json') {
		return `${JSON.stringify(schemaObject, null, '\t')}\n`;
	}

	return yamlDump(schemaObject, {
		indent: 2,
		lineWidth: 120,
		noRefs: true,
		sortKeys: false
	});
}

/**
 * 深い値が JSON 互換として等しいか（変換往復チェック用）
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
function deepEqualJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * エントリポイント
 * @param {string[]} argv
 * @returns {number}
 */
function main(argv) {
	const options = parseArgs(argv);
	if (options.help) {
		process.stdout.write(`${usage()}\n`);
		return 0;
	}

	if (!options.input) {
		throw new Error(`入力ファイルを指定してください。\n\n${usage()}`);
	}

	const cwd = process.cwd();
	const inputPath = resolve(cwd, options.input);
	if (!existsSync(inputPath)) {
		throw new Error(`入力ファイルがありません: ${displayPath(inputPath, cwd)}`);
	}

	const inputFormat = formatFromPath(inputPath);
	const outputFormat = options.to ?? (inputFormat === 'json' ? 'yaml' : 'json');

	if (inputFormat === outputFormat && !options.check) {
		throw new Error(
			`入力と出力形式が同じです（${inputFormat}）。--to で反対側を指定するか、拡張子の異なる -o を使ってください`
		);
	}

	const schemaObject = readSchemaObject(inputPath, inputFormat);
	const shownIn = displayPath(inputPath, cwd);

	if (options.check) {
		const intermediate = serializeSchemaObject(schemaObject, outputFormat);
		const roundTrip =
			outputFormat === 'yaml'
				? yamlLoad(intermediate)
				: JSON.parse(intermediate);
		const back = serializeSchemaObject(
			/** @type {Record<string, unknown>} */ (roundTrip),
			inputFormat
		);
		const restored =
			inputFormat === 'yaml' ? yamlLoad(back) : JSON.parse(back);

		if (!deepEqualJson(schemaObject, restored)) {
			throw new Error(`check failed: round-trip mismatch for ${shownIn} via ${outputFormat}`);
		}

		process.stdout.write(`check: ok (${shownIn} ↔ ${outputFormat})\n`);
		return 0;
	}

	const outPath = resolve(cwd, options.out ?? withSchemaFileFormat(inputPath, outputFormat));
	if (resolve(outPath) === resolve(inputPath)) {
		throw new Error(`出力が入力と同じパスです: ${displayPath(outPath, cwd)}`);
	}

	const body = serializeSchemaObject(schemaObject, outputFormat);
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, body, 'utf8');

	process.stdout.write(`output: ${displayPath(outPath, cwd)}\n`);
	process.stdout.write(
		`convert: ${shownIn} (${inputFormat}) → ${displayPath(outPath, cwd)} (${outputFormat})\n`
	);
	return 0;
}

const isDirectRun =
	process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`error: ${message}\n`);
		process.exitCode = 1;
	}
}
