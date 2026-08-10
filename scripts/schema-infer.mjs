#!/usr/bin/env node
/**
 * 複数の具体例（JSON / YAML）から JSON Schema 草案を推論する CLI。
 *
 * WARN: 出力は草案。$id / const / pattern などは人手で整える前提。
 * WARN: ワイルドカードはシェルではなく Node（fs.globSync）で解決する（Windows 対策）。
 */
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';
import { InputData, jsonInputForTargetLanguage, quicktype } from 'quicktype-core';

const DEFAULT_OUT_DIR = 'schemas/drafts';
const DEFAULT_NAME_STEM = 'schema-infer';

/**
 * @typedef {'json' | 'yaml'} SchemaFormat
 */

/**
 * @typedef {object} CliOptions
 * @property {boolean} help
 * @property {string | undefined} out
 * @property {string | undefined} name
 * @property {SchemaFormat | undefined} format
 * @property {string[]} patterns
 */

/**
 * ヘルプ文言を返す
 * @returns {string}
 */
function usage() {
	return `Usage:
  npm run schema:infer -- [options] <pattern...>

Options:
  -o, --out <path>       出力ファイル（省略時は日時などから自動生成）
  -n, --name <name>      トップレベル型名（省略時は出力 stem または ${DEFAULT_NAME_STEM}）
      --top-level <name> --name の別名
      --format <json|yaml>
                         --out 省略時の出力形式（既定: json）
      --src <pattern>    入力パターン（複数指定可。位置引数でも可）
  -h, --help             このヘルプ

Examples:
  npm run schema:infer -- "schemas/samples/primefaces/*.json"
  npm run schema:infer -- --name PrimeFacesRaw --format yaml "data/**/*.yml"
  npm run schema:infer -- -o schemas/raw/foo.schema.json "tmp/samples/*.json"
`;
}

/**
 * ローカル日時をファイル名用タイムスタンプにする（yyyyMMddTHHmmss）
 * @param {Date} [date]
 * @returns {string}
 */
function formatLocalTimestamp(date = new Date()) {
	const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		'T',
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds())
	].join('');
}

/**
 * 型名 / ファイル名に使える stem へ正規化する
 * @param {string} value
 * @returns {string}
 */
function sanitizeStem(value) {
	const stem = value
		.trim()
		.replace(/[^a-zA-Z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return stem.length > 0 ? stem : DEFAULT_NAME_STEM;
}

/**
 * 拡張子から出力形式を判定する
 * @param {string} filePath
 * @returns {SchemaFormat}
 */
function formatFromPath(filePath) {
	const ext = extname(filePath).toLowerCase();
	return ext === '.yaml' || ext === '.yml' ? 'yaml' : 'json';
}

/**
 * 形式に対応する拡張子を返す
 * @param {SchemaFormat} format
 * @returns {string}
 */
function extensionForFormat(format) {
	return format === 'yaml' ? '.yaml' : '.json';
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
		out: undefined,
		name: undefined,
		format: undefined,
		patterns: []
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
		if (arg === '-n' || arg === '--name' || arg === '--top-level') {
			options.name = requireValue(arg, argv[++i]);
			continue;
		}
		if (arg === '--format') {
			const raw = requireValue(arg, argv[++i]).toLowerCase();
			if (raw !== 'json' && raw !== 'yaml' && raw !== 'yml') {
				throw new Error(`--format は json または yaml を指定してください: ${raw}`);
			}
			options.format = raw === 'yml' ? 'yaml' : raw;
			continue;
		}
		if (arg === '--src') {
			options.patterns.push(requireValue(arg, argv[++i]));
			continue;
		}
		if (arg.startsWith('-')) {
			throw new Error(`不明なオプションです: ${arg}`);
		}
		options.patterns.push(arg);
	}

	return options;
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
 * glob パターンを正規化する（Windows の \\ を / に寄せる）
 * @param {string} pattern
 * @returns {string}
 */
function normalizePattern(pattern) {
	return pattern.replace(/\\/g, '/');
}

/**
 * 入力パターンをファイル絶対パス一覧へ展開する
 * @param {string[]} patterns
 * @param {string} cwd
 * @returns {string[]}
 */
function resolveInputFiles(patterns, cwd) {
	/** @type {Set<string>} */
	const files = new Set();

	for (const raw of patterns) {
		const pattern = normalizePattern(raw);
		const matches = globSync(pattern, {
			cwd,
			absolute: true,
			nodir: true,
			dot: false
		});

		if (matches.length > 0) {
			for (const match of matches) {
				files.add(resolve(match));
			}
			continue;
		}

		// glob 0 件でも実在ファイルなら採用（リテラルパス）
		const literal = resolve(cwd, raw);
		if (existsSync(literal)) {
			files.add(literal);
			continue;
		}

		throw new Error(`入力にマッチするファイルがありません: ${raw}`);
	}

	const list = [...files].sort((a, b) => a.localeCompare(b));
	if (list.length === 0) {
		throw new Error('入力ファイルが 0 件です');
	}
	return list;
}

/**
 * UTF-8 BOM を除去する（Windows エディタ由来の入力対策）
 * @param {string} text
 * @returns {string}
 */
function stripBom(text) {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * サンプルファイルを quicktype 向け JSON 文字列として読む
 * @param {string} filePath
 * @returns {string}
 */
function readSampleAsJsonString(filePath) {
	const text = stripBom(readFileSync(filePath, 'utf8'));
	const ext = extname(filePath).toLowerCase();

	if (ext === '.yaml' || ext === '.yml') {
		const data = yamlLoad(text);
		if (data === undefined || data === null) {
			throw new Error(`YAML が空です: ${filePath}`);
		}
		return JSON.stringify(data);
	}

	if (ext === '.json') {
		// 妥当性確認のため一度 parse する
		JSON.parse(text);
		return text;
	}

	throw new Error(`未対応の入力拡張子です（.json / .yaml / .yml）: ${filePath}`);
}

/**
 * 自動出力パスを組み立てる
 * @param {object} params
 * @param {string} params.cwd
 * @param {string | undefined} params.name
 * @param {SchemaFormat} params.format
 * @param {Date} [params.now]
 * @returns {string}
 */
function buildDefaultOutPath({ cwd, name, format, now = new Date() }) {
	const stem = sanitizeStem(name ?? DEFAULT_NAME_STEM);
	const stamp = formatLocalTimestamp(now);
	const fileName = `${stem}-${stamp}.schema${extensionForFormat(format)}`;
	return resolve(cwd, DEFAULT_OUT_DIR, fileName);
}

/**
 * 出力パスと形式・型名を確定する
 * @param {CliOptions} options
 * @param {string} cwd
 * @returns {{ outPath: string, format: SchemaFormat, typeName: string }}
 */
function resolveOutput(options, cwd) {
	if (options.out) {
		const outPath = resolve(cwd, options.out);
		const format = options.format ?? formatFromPath(outPath);
		const typeName = sanitizeStem(options.name ?? basename(outPath, extname(outPath)).replace(/\.schema$/i, ''));
		return { outPath, format, typeName };
	}

	const format = options.format ?? 'json';
	const typeName = sanitizeStem(options.name ?? DEFAULT_NAME_STEM);
	const outPath = buildDefaultOutPath({ cwd, name: typeName, format });
	return { outPath, format, typeName };
}

/**
 * 複数サンプルから JSON Schema テキストを推論する
 * @param {string[]} sampleJsonStrings
 * @param {string} typeName
 * @returns {Promise<string>}
 */
async function inferSchemaJson(sampleJsonStrings, typeName) {
	const jsonInput = jsonInputForTargetLanguage('schema');
	await jsonInput.addSource({
		name: typeName,
		samples: sampleJsonStrings
	});

	const inputData = new InputData();
	inputData.addInput(jsonInput);

	const result = await quicktype({
		inputData,
		lang: 'schema'
	});

	return result.lines.join('\n');
}

/**
 * schema JSON テキストを指定形式のファイル内容にする
 * @param {string} schemaJsonText
 * @param {SchemaFormat} format
 * @returns {string}
 */
function serializeSchema(schemaJsonText, format) {
	if (format === 'json') {
		const parsed = JSON.parse(schemaJsonText);
		return `${JSON.stringify(parsed, null, '\t')}\n`;
	}

	const parsed = JSON.parse(schemaJsonText);
	return yamlDump(parsed, {
		indent: 2,
		lineWidth: 120,
		noRefs: true,
		sortKeys: false
	});
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
 * エントリポイント
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
async function main(argv) {
	const options = parseArgs(argv);
	if (options.help) {
		process.stdout.write(`${usage()}\n`);
		return 0;
	}

	if (options.patterns.length === 0) {
		throw new Error(`入力パターンを指定してください。\n\n${usage()}`);
	}

	const cwd = process.cwd();
	const inputFiles = resolveInputFiles(options.patterns, cwd);
	const { outPath, format, typeName } = resolveOutput(options, cwd);
	const samples = inputFiles.map((filePath) => readSampleAsJsonString(filePath));

	const schemaJsonText = await inferSchemaJson(samples, typeName);
	const body = serializeSchema(schemaJsonText, format);

	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, body, 'utf8');

	const shown = displayPath(outPath, cwd);
	process.stdout.write(`output: ${shown}\n`);
	process.stdout.write(`inputs: ${inputFiles.length} file(s), typeName=${typeName}, format=${format}\n`);
	return 0;
}

const isDirectRun =
	process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
	main(process.argv.slice(2)).then(
		(code) => {
			process.exitCode = code;
		},
		(error) => {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`error: ${message}\n`);
			process.exitCode = 1;
		}
	);
}
