#!/usr/bin/env node
/**
 * 複数の具体例（JSON / YAML）から JSON Schema 草案を推論する CLI。
 *
 * WARN: 出力は草案。$id / const / pattern などは人手で整える前提。
 * WARN: ワイルドカードはシェルではなく Node（fs.globSync）で解決する（Windows 対策）。
 * WARN: --normalize-json は undefined→null 等で意味が変わる。opt-in のみ。
 */
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';
import { InputData, jsonInputForTargetLanguage, quicktype } from 'quicktype-core';

const DEFAULT_OUT_DIR = 'schemas/drafts';
const DEFAULT_NAME_STEM = 'schema-infer';
/** 正規化レポートに出す置換例の最大件数（ファイルごと） */
const NORMALIZE_EXAMPLE_LIMIT = 5;
/** 置換例スニペットの前後文字数 */
const SNIPPET_RADIUS = 36;

/**
 * @typedef {'json' | 'yaml'} SchemaFileFormat
 */

/**
 * CLI の --format（both = json と yaml を両方出力）
 * @typedef {'json' | 'yaml' | 'both'} SchemaEmitFormat
 */

/**
 * @typedef {'undefined-to-null' | 'nan-to-null' | 'infinity-to-null' | 'trailing-comma'} JsonRewriteKind
 */

/**
 * @typedef {object} JsonRewrite
 * @property {JsonRewriteKind} kind
 * @property {number} offset
 * @property {string} before
 * @property {string} after
 */

/**
 * @typedef {object} NormalizeJsonResult
 * @property {string} text
 * @property {JsonRewrite[]} rewrites
 */

/**
 * @typedef {object} ReadSampleResult
 * @property {string} jsonText
 * @property {JsonRewrite[]} rewrites
 */

/**
 * @typedef {object} CliOptions
 * @property {boolean} help
 * @property {string | undefined} out
 * @property {string | undefined} name
 * @property {SchemaEmitFormat | undefined} format
 * @property {boolean} normalizeJson
 * @property {string[]} patterns
 */

/**
 * @typedef {object} SchemaOutputTarget
 * @property {string} outPath
 * @property {SchemaFileFormat} format
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
                         --format both のときは片方のパスを指定すれば隣に他形式も出力
  -n, --name <name>      トップレベル型名（省略時は出力 stem または ${DEFAULT_NAME_STEM}）
      --top-level <name> --name の別名
      --format <json|yaml|both>
                         出力形式（既定: json）。both は .json と .yaml を両方書く
      --src <pattern>    入力パターン（複数指定可。位置引数でも可）
      --normalize-json   JS風トークン等を正しい JSON へ正規化してから取り込む
                         （undefined/NaN/Infinity → null、末尾カンマ除去）
  -h, --help             このヘルプ

Examples:
  npm run schema:infer -- "schemas/samples/primefaces/*.json"
  npm run schema:infer -- --name PrimeFacesRaw --format yaml "data/**/*.yml"
  npm run schema:infer -- --format both --name ImFormaRaw ".samples/forma/*.json"
  npm run schema:infer -- -o schemas/raw/foo.schema.json "tmp/samples/*.json"
  npm run schema:infer -- --normalize-json --name ImFormaRaw ".samples/forma/*.json"
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
 * 拡張子から単一ファイル形式を判定する
 * @param {string} filePath
 * @returns {SchemaFileFormat}
 */
function formatFromPath(filePath) {
	const ext = extname(filePath).toLowerCase();
	return ext === '.yaml' || ext === '.yml' ? 'yaml' : 'json';
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
 * スキーマパスの拡張子を他形式へ付け替える（.yml も .json へ寄せる）
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
		normalizeJson: false,
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
			if (raw !== 'json' && raw !== 'yaml' && raw !== 'yml' && raw !== 'both') {
				throw new Error(`--format は json / yaml / both を指定してください: ${raw}`);
			}
			options.format = raw === 'yml' ? 'yaml' : raw;
			continue;
		}
		if (arg === '--src') {
			options.patterns.push(requireValue(arg, argv[++i]));
			continue;
		}
		if (arg === '--normalize-json') {
			options.normalizeJson = true;
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
 * 識別子境界かどうか（トークン置換用）
 * @param {string | undefined} ch
 * @returns {boolean}
 */
function isIdentBoundary(ch) {
	if (ch === undefined) {
		return true;
	}
	return !/[A-Za-z0-9_]/.test(ch);
}

/**
 * 置換位置まわりの表示用スニペットを作る
 * @param {string} text
 * @param {number} offset
 * @param {number} length
 * @returns {string}
 */
function contextSnippet(text, offset, length) {
	const start = Math.max(0, offset - SNIPPET_RADIUS);
	const end = Math.min(text.length, offset + length + SNIPPET_RADIUS);
	const slice = text.slice(start, end).replace(/\s+/g, ' ');
	return `${start > 0 ? '...' : ''}${slice}${end < text.length ? '...' : ''}`;
}

/**
 * JS 風の不正 JSON を正しい JSON 文字列へ正規化する（文字列リテラル外のみ）
 *
 * WARN: エスケープ不備の修復は未対応（必要になったら同経路に追加）。
 * @param {string} text
 * @returns {NormalizeJsonResult}
 */
function normalizeJsonText(text) {
	/** @type {JsonRewrite[]} */
	const rewrites = [];
	let out = '';
	let i = 0;
	let inString = false;
	let escape = false;

	/** @type {{ from: string, to: string, kind: JsonRewriteKind }[]} */
	const bareTokens = [
		{ from: '-Infinity', to: 'null', kind: 'infinity-to-null' },
		{ from: 'Infinity', to: 'null', kind: 'infinity-to-null' },
		{ from: '-NaN', to: 'null', kind: 'nan-to-null' },
		{ from: 'NaN', to: 'null', kind: 'nan-to-null' },
		{ from: 'undefined', to: 'null', kind: 'undefined-to-null' }
	];

	while (i < text.length) {
		const c = text[i];

		if (inString) {
			out += c;
			if (escape) {
				escape = false;
			} else if (c === '\\') {
				escape = true;
			} else if (c === '"') {
				inString = false;
			}
			i += 1;
			continue;
		}

		if (c === '"') {
			inString = true;
			out += c;
			i += 1;
			continue;
		}

		// 末尾カンマ: ',' + 空白 + '}' | ']'
		if (c === ',') {
			let j = i + 1;
			while (j < text.length && /[ \t\r\n]/.test(text[j])) {
				j += 1;
			}
			if (j < text.length && (text[j] === '}' || text[j] === ']')) {
				rewrites.push({
					kind: 'trailing-comma',
					offset: i,
					before: contextSnippet(text, i, j - i + 1),
					after: contextSnippet(`${text.slice(0, i)}${text.slice(i + 1)}`, i, j - i)
				});
				i += 1;
				continue;
			}
			out += c;
			i += 1;
			continue;
		}

		let matched = false;
		for (const token of bareTokens) {
			if (
				text.startsWith(token.from, i) &&
				isIdentBoundary(i === 0 ? undefined : text[i - 1]) &&
				isIdentBoundary(text[i + token.from.length])
			) {
				rewrites.push({
					kind: token.kind,
					offset: i,
					before: contextSnippet(text, i, token.from.length),
					after: contextSnippet(
						`${text.slice(0, i)}${token.to}${text.slice(i + token.from.length)}`,
						i,
						token.to.length
					)
				});
				out += token.to;
				i += token.from.length;
				matched = true;
				break;
			}
		}
		if (matched) {
			continue;
		}

		out += c;
		i += 1;
	}

	return { text: out, rewrites };
}

/**
 * サンプル読込失敗メッセージを組み立てる
 * @param {string} shownPath
 * @param {unknown} cause
 * @returns {string}
 */
function formatSampleReadError(shownPath, cause) {
	const causeMessage = cause instanceof Error ? cause.message : String(cause);
	/** @type {string[]} */
	const lines = [`sample read failed: ${shownPath}`, `  cause: ${causeMessage}`];

	if (cause instanceof SyntaxError) {
		const positioned = /** @type {SyntaxError & { pos?: number }} */ (cause);
		if (typeof positioned.pos === 'number') {
			lines.push(`  offset: ${positioned.pos}`);
		}
	}

	return lines.join('\n');
}

/**
 * 正規化レポートを標準出力へ書く
 * @param {string} shownPath
 * @param {JsonRewrite[]} rewrites
 */
function writeNormalizeReport(shownPath, rewrites) {
	/** @type {Record<JsonRewriteKind, number>} */
	const counts = {
		'undefined-to-null': 0,
		'nan-to-null': 0,
		'infinity-to-null': 0,
		'trailing-comma': 0
	};
	for (const rewrite of rewrites) {
		counts[rewrite.kind] += 1;
	}

	process.stdout.write(`normalize: ${shownPath}\n`);
	if (counts['undefined-to-null'] > 0) {
		process.stdout.write(`  undefined→null: ${counts['undefined-to-null']}\n`);
	}
	if (counts['nan-to-null'] > 0) {
		process.stdout.write(`  NaN→null: ${counts['nan-to-null']}\n`);
	}
	if (counts['infinity-to-null'] > 0) {
		process.stdout.write(`  Infinity→null: ${counts['infinity-to-null']}\n`);
	}
	if (counts['trailing-comma'] > 0) {
		process.stdout.write(`  trailing-comma: ${counts['trailing-comma']}\n`);
	}

	process.stdout.write('  examples:\n');
	for (const rewrite of rewrites.slice(0, NORMALIZE_EXAMPLE_LIMIT)) {
		process.stdout.write(
			`    - offset=${rewrite.offset} [${rewrite.kind}]: ${rewrite.before} => ${rewrite.after}\n`
		);
	}
	if (rewrites.length > NORMALIZE_EXAMPLE_LIMIT) {
		process.stdout.write(`    - ...and ${rewrites.length - NORMALIZE_EXAMPLE_LIMIT} more\n`);
	}
}

/**
 * サンプルファイルを quicktype 向け JSON 文字列として読む
 * @param {string} filePath
 * @param {{ normalizeJson?: boolean }} [options]
 * @returns {ReadSampleResult}
 */
function readSampleAsJsonString(filePath, options = {}) {
	const text = stripBom(readFileSync(filePath, 'utf8'));
	const ext = extname(filePath).toLowerCase();

	if (ext === '.yaml' || ext === '.yml') {
		const data = yamlLoad(text);
		if (data === undefined || data === null) {
			throw new Error(`YAML が空です`);
		}
		return { jsonText: JSON.stringify(data), rewrites: [] };
	}

	if (ext === '.json') {
		/** @type {JsonRewrite[]} */
		let rewrites = [];
		let source = text;

		if (options.normalizeJson) {
			const normalized = normalizeJsonText(text);
			source = normalized.text;
			rewrites = normalized.rewrites;
		}

		// 妥当性確認のため一度 parse する
		JSON.parse(source);
		return { jsonText: source, rewrites };
	}

	throw new Error(`未対応の入力拡張子です（.json / .yaml / .yml）`);
}

/**
 * 自動出力パスを組み立てる
 * @param {object} params
 * @param {string} params.cwd
 * @param {string | undefined} params.name
 * @param {SchemaFileFormat} params.format
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
 * -o パスから型名 stem を取り出す
 * @param {string} outPath
 * @returns {string}
 */
function typeNameFromOutPath(outPath) {
	return sanitizeStem(basename(outPath, extname(outPath)).replace(/\.schema$/i, ''));
}

/**
 * 出力パス一覧と型名・emit 形式を確定する
 * @param {CliOptions} options
 * @param {string} cwd
 * @returns {{ targets: SchemaOutputTarget[], emitFormat: SchemaEmitFormat, typeName: string }}
 */
function resolveOutput(options, cwd) {
	const emitFormat = options.format ?? (options.out ? formatFromPath(resolve(cwd, options.out)) : 'json');

	if (emitFormat === 'both') {
		if (options.out) {
			const primary = resolve(cwd, options.out);
			const jsonPath = withSchemaFileFormat(primary, 'json');
			const yamlPath = withSchemaFileFormat(primary, 'yaml');
			const typeName = sanitizeStem(options.name ?? typeNameFromOutPath(primary));
			return {
				targets: [
					{ outPath: jsonPath, format: 'json' },
					{ outPath: yamlPath, format: 'yaml' }
				],
				emitFormat,
				typeName
			};
		}

		const typeName = sanitizeStem(options.name ?? DEFAULT_NAME_STEM);
		const now = new Date();
		return {
			targets: [
				{ outPath: buildDefaultOutPath({ cwd, name: typeName, format: 'json', now }), format: 'json' },
				{ outPath: buildDefaultOutPath({ cwd, name: typeName, format: 'yaml', now }), format: 'yaml' }
			],
			emitFormat,
			typeName
		};
	}

	/** @type {SchemaFileFormat} */
	const fileFormat = emitFormat;
	if (options.out) {
		const outPath = resolve(cwd, options.out);
		const typeName = sanitizeStem(options.name ?? typeNameFromOutPath(outPath));
		return {
			targets: [{ outPath, format: fileFormat }],
			emitFormat,
			typeName
		};
	}

	const typeName = sanitizeStem(options.name ?? DEFAULT_NAME_STEM);
	return {
		targets: [{ outPath: buildDefaultOutPath({ cwd, name: typeName, format: fileFormat }), format: fileFormat }],
		emitFormat,
		typeName
	};
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
 * パース済み schema オブジェクトを指定形式のファイル内容にする
 * @param {unknown} schemaObject
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
	const { targets, emitFormat, typeName } = resolveOutput(options, cwd);

	/** @type {string[]} */
	const samples = [];
	let normalizeFileCount = 0;
	let normalizeRewriteCount = 0;

	for (const filePath of inputFiles) {
		const shown = displayPath(filePath, cwd);
		try {
			const { jsonText, rewrites } = readSampleAsJsonString(filePath, {
				normalizeJson: options.normalizeJson
			});
			samples.push(jsonText);
			if (rewrites.length > 0) {
				normalizeFileCount += 1;
				normalizeRewriteCount += rewrites.length;
				writeNormalizeReport(shown, rewrites);
			}
		} catch (cause) {
			throw new Error(formatSampleReadError(shown, cause));
		}
	}

	if (normalizeFileCount > 0) {
		process.stdout.write(
			`normalize: summary — ${normalizeFileCount} file(s) rewritten, ${normalizeRewriteCount} rewrite(s)\n`
		);
	}

	const schemaJsonText = await inferSchemaJson(samples, typeName);
	const schemaObject = JSON.parse(schemaJsonText);

	/** @type {string[]} */
	const written = [];
	for (const target of targets) {
		const body = serializeSchemaObject(schemaObject, target.format);
		mkdirSync(dirname(target.outPath), { recursive: true });
		writeFileSync(target.outPath, body, 'utf8');
		written.push(displayPath(target.outPath, cwd));
	}

	for (const shown of written) {
		process.stdout.write(`output: ${shown}\n`);
	}
	process.stdout.write(
		`inputs: ${inputFiles.length} file(s), typeName=${typeName}, format=${emitFormat}, normalizeJson=${options.normalizeJson}\n`
	);
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
