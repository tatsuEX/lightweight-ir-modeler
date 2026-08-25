#!/usr/bin/env node
/**
 * IR snapshot YAML を復元し、Handlebars で簡易コード生成する CLI。
 *
 * WARN: Export パイプライン（Raw / Writer）は使わない。
 * WARN: 生成本文は stdout（--out 時はファイルのみ）。警告は stderr。
 * WARN: このファイルは npm script 専用。テストは `scripts/lib/summon-cli.ts` を import する。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runSummonCli, summonUsage } from './lib/summon-cli';

/**
 * 生成結果を stdout または --out へ書き出す
 */
function emitSummonOutput(output: string, outPath: string | undefined): void {
	if (outPath === undefined) {
		process.stdout.write(output);
		return;
	}

	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, output, 'utf8');
}

try {
	const argv = process.argv.slice(2);
	if (argv.includes('-h') || argv.includes('--help')) {
		process.stdout.write(`${summonUsage()}\n`);
		process.exit(0);
	}

	const { output, warnings, outPath } = runSummonCli(argv);
	for (const warning of warnings) {
		console.error(warning);
	}
	emitSummonOutput(output, outPath);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`arcane:summon: ${message}`);
	console.error(summonUsage());
	process.exit(1);
}
