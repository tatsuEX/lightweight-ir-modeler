import { getContext, setContext } from 'svelte';
import type { UiDefinitionValidationProfile } from '$lib/config/ui-definition-validation-config';
import type { EditorComponent } from '$lib/ir/elements/component-schema';
import type { UiDefinitionEditorMeta, UiDefinitionLiveMeta } from '$lib/ir/ui-definition-meta';
import type { UIDefinition } from '$lib/ir/ui-definition';
import {
	validateUiDefinition,
	type UiDefinitionValidationReport
} from '$lib/ir/ui-definition-validation/validate-ui-definition';
import { hashUiDefinitionIr } from '$lib/store/layout-editor/ir-auto-save.svelte';
import type { ToastMessages } from '$lib/store/toast/toast.svelte';

const UI_DEFINITION_VALIDATION_CONTEXT_KEY = 'ui-definition-validation';

/**
 * Property が表示する直近の検証結果
 */
export type UiDefinitionValidationState = {
	readonly profile: UiDefinitionValidationProfile;
	readonly report: UiDefinitionValidationReport;
	/**
	 * 直近の検証結果を差し替える
	 */
	publish(report: UiDefinitionValidationReport): void;
	/**
	 * いまの UIDefinition を検証し、結果を publish する。成功なら true。
	 *
	 * WARN: issue は全件 publish する。詳細は issue ごと Toast 1 件（自動消去）。件数まとめは出さない。
	 */
	revalidate(): boolean;
};

/**
 * 空の成功結果を返す
 */
export function emptyUiDefinitionValidationReport(): UiDefinitionValidationReport {
	return { ok: true, issues: [] };
}

/**
 * 検証結果の入れ物を作る。コンポーネント初期化中に呼ぶ
 */
export function createUiDefinitionValidationState(
	profile: UiDefinitionValidationProfile,
	uiDefinition: UIDefinition,
	toast: ToastMessages
): UiDefinitionValidationState {
	let report = $state<UiDefinitionValidationReport>(emptyUiDefinitionValidationReport());
	let lastOkHash: string | null = null;
	let lastAnnounced = '';
	let validationToastIds: string[] = [];

	/**
	 * 検証用 Toast をすべて消す
	 */
	function clearValidationToasts(): void {
		for (const id of validationToastIds) {
			toast.dismiss(id);
		}
		validationToastIds = [];
	}

	/**
	 * 検証用 Toast を issue ごとに差し替える（同じ issue 並びで全件表示中なら触らない）
	 *
	 * WARN: sticky にしない。消えたあとも再検証で再度出る。
	 */
	function announceValidationIssues(
		signature: string,
		issues: UiDefinitionValidationReport['issues']
	): void {
		const stillVisible =
			validationToastIds.length > 0 &&
			validationToastIds.every((id) => toast.messages.some((message) => message.id === id));
		if (signature === lastAnnounced && stillVisible) {
			return;
		}
		lastAnnounced = signature;
		clearValidationToasts();
		validationToastIds = issues.map((issue) =>
			toast.add({
				severity: 'error',
				summary: issue.message
			})
		);
	}

	/**
	 * いまの UIDefinition を検証し、結果を publish する
	 */
	function revalidate(): boolean {
		const hash = hashUiDefinitionIr(uiDefinition);
		if (lastOkHash === hash && report.ok) {
			return true;
		}

		const next = validateUiDefinition(
			uiDefinition.meta as UiDefinitionLiveMeta | UiDefinitionEditorMeta,
			uiDefinition.components as readonly EditorComponent[],
			profile
		);
		report = next;
		if (next.ok) {
			lastOkHash = hash;
			lastAnnounced = '';
			clearValidationToasts();
			return true;
		}

		lastOkHash = null;
		const signature = next.issues.map((issue) => `${issue.path}:${issue.code}`).join('|');
		announceValidationIssues(signature, next.issues);
		return false;
	}

	return {
		profile,
		get report() {
			return report;
		},
		publish(next) {
			report = next;
		},
		revalidate
	};
}

/**
 * 検証結果を Context に載せる
 */
export function setUiDefinitionValidationContext(state: UiDefinitionValidationState): void {
	setContext(UI_DEFINITION_VALIDATION_CONTEXT_KEY, state);
}

/**
 * 検証結果を Context から取得する
 */
export function getUiDefinitionValidationContext(): UiDefinitionValidationState {
	const state = getContext<UiDefinitionValidationState | undefined>(UI_DEFINITION_VALIDATION_CONTEXT_KEY);
	if (!state) {
		throw new Error('UiDefinitionValidation context is not set');
	}
	return state;
}
