import Handlebars from 'handlebars';
import { hasTargetResidual, readTargetResidual } from '$lib/ir/external-residual';
import type { RestoredIrSnapshot } from '$lib/ir/snapshot';

const handlebars = Handlebars.create();

handlebars.registerHelper('eq', (left: unknown, right: unknown) => left === right);

/**
 * Handlebars に渡す summon context
 *
 * `external` は `--target` 名前空間の袋だけ（uiDefinition と各 component で同じ規則）。
 * 運用コメントは載せない。
 */
export type SummonTemplateContext = {
	target: string;
	version: number;
	savedAt: string;
	uiDefinition: Record<string, unknown>;
	components: unknown[];
	external: Record<string, unknown>;
};

/**
 * summon の描画結果
 */
export type SummonResult = {
	output: string;
	warnings: string[];
};

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * snapshot 内のどこにも target 残余が無いときの警告文を返す
 */
export function missingTargetResidualWarning(targetId: string): string {
	return `arcane:summon: no external['${targetId}'] on uiDefinition or components`;
}

/**
 * component を target の external 袋だけ見える形へ投影する
 */
function projectComponentForTarget(component: unknown, targetId: string): unknown {
	if (!isPlainObject(component)) {
		return component;
	}

	return {
		...component,
		external: readTargetResidual(component.external, targetId)
	};
}

/**
 * 復元済み snapshot から Handlebars context を組み立てる
 */
export function buildSummonContext(
	snapshot: RestoredIrSnapshot,
	targetId: string
): { context: SummonTemplateContext; warnings: string[] } {
	const uiExternal = readTargetResidual(snapshot.uiDefinition.external, targetId);
	const uiHas = hasTargetResidual(snapshot.uiDefinition.external, targetId);
	const anyComponentHas = snapshot.components.some(
		(component) => isPlainObject(component) && hasTargetResidual(component.external, targetId)
	);

	const warnings: string[] = [];
	if (!uiHas && !anyComponentHas) {
		warnings.push(missingTargetResidualWarning(targetId));
	}

	return {
		context: {
			target: targetId,
			version: snapshot.version,
			savedAt: snapshot.savedAt,
			uiDefinition: {
				...snapshot.uiDefinition,
				external: uiExternal
			},
			components: snapshot.components.map((component) =>
				projectComponentForTarget(component, targetId)
			),
			external: uiExternal
		},
		warnings
	};
}

/**
 * 復元済み snapshot と Handlebars ソースからコードを生成する
 *
 * WARN: ユーザー由来文字列はテンプレート側で {{ }} を使うこと。
 */
export function summonFromSnapshot(options: {
	target: string;
	templateSource: string;
	snapshot: RestoredIrSnapshot;
}): SummonResult {
	const { context, warnings } = buildSummonContext(options.snapshot, options.target);
	const output = handlebars.compile(options.templateSource)(context);
	return { output, warnings };
}
