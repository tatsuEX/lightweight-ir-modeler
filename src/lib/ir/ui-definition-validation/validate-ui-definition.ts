/**
 * UIDefinition の構造・意味の整合性を検査する
 *
 * WARN: Zod の component parse は空文字を許したままにする。ここは別レイヤ。
 * 編集中の未完成はメモリに残し、current / history へ書く直前だけがこの結果で止まる。
 */

import {
	type UiDefinitionFieldConstraint,
	type UiDefinitionFieldRule,
	type UiDefinitionValidationProfile,
	createDefaultUiDefinitionValidationProfile
} from '$lib/config/ui-definition-validation-config';
import type { EditorComponent } from '$lib/ir/elements/component-schema';
import { isValidLogicalId, type UiDefinitionEditorMeta, type UiDefinitionLiveMeta } from '$lib/ir/ui-definition-meta';

/** 検証が付ける issue。path は editor id 基準 */
export type UiDefinitionValidationIssue = {
	path: string;
	code: string;
	message: string;
	source: 'core' | 'profile';
};

/** `validateUiDefinition` の結果 */
export type UiDefinitionValidationReport = {
	ok: boolean;
	issues: UiDefinitionValidationIssue[];
};

/** 検証に渡す画面メタ（ライブでもエディタ投影でもよい） */
export type UiDefinitionValidationMeta = UiDefinitionLiveMeta | UiDefinitionEditorMeta;

/**
 * コードポイント数を返す（全角 1 字は 1）
 */
function codePointLength(value: string): number {
	return Array.from(value).length;
}

/**
 * プレーン object かどうかを判定する
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * issue を 1 件足す
 */
function pushIssue(
	issues: UiDefinitionValidationIssue[],
	issue: UiDefinitionValidationIssue
): void {
	issues.push(issue);
}

/**
 * コアの必須または文字クラスで落ちた path を記録する
 */
function blockPath(blocked: Map<string, 'required' | 'charset'>, path: string, kind: 'required' | 'charset'): void {
	if (!blocked.has(path)) {
		blocked.set(path, kind);
	}
}

/**
 * 文字列制約を足す。コアで落ちた path には形の制約を重ねない
 */
function applyStringConstraint(
	issues: UiDefinitionValidationIssue[],
	path: string,
	value: unknown,
	constraint: UiDefinitionFieldConstraint,
	blocked: ReadonlyMap<string, 'required' | 'charset'>
): void {
	const text = typeof value === 'string' ? value.trim() : '';
	const block = blocked.get(path);
	if (block === 'required') {
		return;
	}
	if (constraint.required === true && text === '' && block === undefined) {
		pushIssue(issues, {
			path,
			code: 'required',
			message: '必須です',
			source: 'profile'
		});
		return;
	}
	if (text === '' || block === 'charset') {
		return;
	}
	if (constraint.prefix !== undefined && !text.startsWith(constraint.prefix)) {
		pushIssue(issues, {
			path,
			code: 'prefix',
			message: `${constraint.prefix} で始めてください`,
			source: 'profile'
		});
	}
	if (constraint.suffix !== undefined && !text.endsWith(constraint.suffix)) {
		pushIssue(issues, {
			path,
			code: 'suffix',
			message: `${constraint.suffix} で終わってください`,
			source: 'profile'
		});
	}
	if (constraint.pattern !== undefined && !new RegExp(constraint.pattern).test(text)) {
		pushIssue(issues, {
			path,
			code: 'pattern',
			message: '形式が一致しません',
			source: 'profile'
		});
	}
	const length = codePointLength(text);
	if (constraint.minLength !== undefined && length < constraint.minLength) {
		pushIssue(issues, {
			path,
			code: 'min-length',
			message: `${constraint.minLength} 文字以上にしてください`,
			source: 'profile'
		});
	}
	if (constraint.maxLength !== undefined && length > constraint.maxLength) {
		pushIssue(issues, {
			path,
			code: 'max-length',
			message: `${constraint.maxLength} 文字以内にしてください`,
			source: 'profile'
		});
	}
	if (constraint.enum !== undefined && !constraint.enum.includes(text)) {
		pushIssue(issues, {
			path,
			code: 'enum',
			message: '許可された値ではありません',
			source: 'profile'
		});
	}
}

/**
 * 数値制約を足す
 */
function applyNumberConstraint(
	issues: UiDefinitionValidationIssue[],
	path: string,
	value: unknown,
	constraint: UiDefinitionFieldConstraint
): void {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		if (constraint.required === true) {
			pushIssue(issues, {
				path,
				code: 'required',
				message: '必須です',
				source: 'profile'
			});
		}
		return;
	}
	if (constraint.minimum !== undefined && value < constraint.minimum) {
		pushIssue(issues, {
			path,
			code: 'minimum',
			message: `${constraint.minimum} 以上にしてください`,
			source: 'profile'
		});
	}
	if (constraint.maximum !== undefined && value > constraint.maximum) {
		pushIssue(issues, {
			path,
			code: 'maximum',
			message: `${constraint.maximum} 以下にしてください`,
			source: 'profile'
		});
	}
}

/**
 * 配列の件数制約を足す
 */
function applyArrayConstraint(
	issues: UiDefinitionValidationIssue[],
	path: string,
	value: unknown,
	constraint: UiDefinitionFieldConstraint
): void {
	if (!Array.isArray(value)) {
		return;
	}
	if (constraint.minItems !== undefined && value.length < constraint.minItems) {
		pushIssue(issues, {
			path,
			code: 'min-items',
			message: `${constraint.minItems} 件以上にしてください`,
			source: 'profile'
		});
	}
	if (constraint.maxItems !== undefined && value.length > constraint.maxItems) {
		pushIssue(issues, {
			path,
			code: 'max-items',
			message: `${constraint.maxItems} 件以内にしてください`,
			source: 'profile'
		});
	}
}

/**
 * 規則ノードを値へ適用する
 */
function applyRule(
	issues: UiDefinitionValidationIssue[],
	path: string,
	value: unknown,
	rule: UiDefinitionFieldRule,
	blocked: ReadonlyMap<string, 'required' | 'charset'>
): void {
	if (typeof value === 'number') {
		applyNumberConstraint(issues, path, value, rule.constraint);
	} else if (Array.isArray(value)) {
		applyArrayConstraint(issues, path, value, rule.constraint);
	} else if (!isPlainObject(value)) {
		applyStringConstraint(issues, path, value, rule.constraint, blocked);
	} else if (rule.constraint.required === true && Object.keys(value).length === 0) {
		pushIssue(issues, {
			path,
			code: 'required',
			message: '必須です',
			source: 'profile'
		});
	}

	for (const [childKey, childRule] of Object.entries(rule.children)) {
		if (Array.isArray(value)) {
			value.forEach((item, index) => {
				const record = isPlainObject(item) ? item : {};
				applyRule(issues, `${path}/${index}/${childKey}`, record[childKey], childRule, blocked);
			});
			continue;
		}
		const record = isPlainObject(value) ? value : {};
		applyRule(issues, `${path}/${childKey}`, record[childKey], childRule, blocked);
	}
}

/**
 * コア規則を集める
 */
function collectCoreIssues(
	meta: UiDefinitionValidationMeta,
	components: readonly EditorComponent[],
	issues: UiDefinitionValidationIssue[],
	blocked: Map<string, 'required' | 'charset'>
): void {
	const logicalId = meta.logicalId.trim();
	if (logicalId === '') {
		pushIssue(issues, {
			path: 'meta.logicalId',
			code: 'logical-id-required',
			message: 'logicalId は必須です',
			source: 'core'
		});
		blockPath(blocked, 'meta.logicalId', 'required');
	} else if (!isValidLogicalId(logicalId)) {
		pushIssue(issues, {
			path: 'meta.logicalId',
			code: 'logical-id-charset',
			message: 'logicalId に使えるのは英数字と - _ # だけです',
			source: 'core'
		});
		blockPath(blocked, 'meta.logicalId', 'charset');
	}

	if (meta.name.trim() === '') {
		pushIssue(issues, {
			path: 'meta.name',
			code: 'name-required',
			message: 'name は必須です',
			source: 'core'
		});
		blockPath(blocked, 'meta.name', 'required');
	}

	const seen = new Map<string, string[]>();
	for (const component of components) {
		const path = `components/${component.id}/logicalId`;
		const idText = component.logicalId.trim();
		if (idText === '') {
			pushIssue(issues, {
				path,
				code: 'logical-id-required',
				message: 'logicalId は必須です',
				source: 'core'
			});
			blockPath(blocked, path, 'required');
		} else if (!isValidLogicalId(idText)) {
			pushIssue(issues, {
				path,
				code: 'logical-id-charset',
				message: 'logicalId に使えるのは英数字と - _ # だけです',
				source: 'core'
			});
			blockPath(blocked, path, 'charset');
		} else {
			const owners = seen.get(idText) ?? [];
			owners.push(path);
			seen.set(idText, owners);
		}

		if (component.type !== 'unsupported' && component.label.trim() === '') {
			const labelPath = `components/${component.id}/label`;
			pushIssue(issues, {
				path: labelPath,
				code: 'label-required',
				message: 'label は必須です',
				source: 'core'
			});
			blockPath(blocked, labelPath, 'required');
		}
	}

	for (const owners of seen.values()) {
		if (owners.length < 2) {
			continue;
		}
		for (const path of owners) {
			pushIssue(issues, {
				path,
				code: 'logical-id-duplicate',
				message: 'logicalId が重複しています',
				source: 'core'
			});
		}
	}
}

/**
 * 宣言プロファイルをコアのあとに足す
 */
function collectProfileIssues(
	meta: UiDefinitionValidationMeta,
	components: readonly EditorComponent[],
	profile: UiDefinitionValidationProfile,
	issues: UiDefinitionValidationIssue[],
	blocked: ReadonlyMap<string, 'required' | 'charset'>
): void {
	const metaRecord = meta as unknown as Record<string, unknown>;
	for (const [field, rule] of Object.entries(profile.meta)) {
		applyRule(issues, `meta.${field}`, metaRecord[field], rule, blocked);
	}

	for (const component of components) {
		const base = `components/${component.id}`;
		const record = component as unknown as Record<string, unknown>;
		for (const [field, rule] of Object.entries(profile.components)) {
			applyRule(issues, `${base}/${field}`, record[field], rule, blocked);
		}
		const typeRules = profile.byType[component.type] ?? {};
		for (const [field, rule] of Object.entries(typeRules)) {
			applyRule(issues, `${base}/${field}`, record[field], rule, blocked);
		}
	}

	if (profile.maxComponents !== undefined && components.length > profile.maxComponents) {
		pushIssue(issues, {
			path: 'document/maxComponents',
			code: 'max-components',
			message: `入力項目は ${profile.maxComponents} 個までです`,
			source: 'profile'
		});
	}
}

/**
 * meta フィールドの画面ラベル（Toast / 文言用）
 */
const META_FIELD_LABELS: Readonly<Record<string, string>> = {
	logicalId: 'ID',
	name: '画面名'
};

/**
 * フィールド名で始まる message から述部を取り出す
 */
function issueMessageTail(message: string, field: string): string {
	if (message.startsWith(`${field} `)) {
		return message.slice(field.length + 1);
	}
	if (message.startsWith(`${field}は`) || message.startsWith(`${field}に`) || message.startsWith(`${field}が`)) {
		return message.slice(field.length);
	}
	if (message.startsWith('は') || message.startsWith('に') || message.startsWith('が')) {
		return message;
	}
	return `は${message}`;
}

/**
 * meta 向け issue の message を「基本情報の ラベル (field) …」にする
 */
function decorateMetaIssueMessages(issues: UiDefinitionValidationIssue[]): void {
	for (const issue of issues) {
		if (!issue.path.startsWith('meta.')) {
			continue;
		}
		const field = issue.path.slice('meta.'.length);
		if (field === '' || field.includes('.')) {
			continue;
		}
		const label = META_FIELD_LABELS[field];
		const fieldPart = label === undefined ? field : `${label} (${field})`;
		const tail = issueMessageTail(issue.message, field);
		issue.message = `基本情報の ${fieldPart} ${tail}`;
	}
}

/**
 * components 向け issue の message を「n行目 logicalId (type) の …」にする
 *
 * WARN: logicalId が空のときは「-」。行番号は components 配列の 1 始まり。
 * この形式は確定。Toast / IssuesError も同じ文言を使う。
 */
function decorateComponentIssueMessages(
	components: readonly EditorComponent[],
	issues: UiDefinitionValidationIssue[]
): void {
	const byId = new Map(
		components.map((component, index) => [component.id, { component, row: index + 1 }] as const)
	);
	for (const issue of issues) {
		const match = /^components\/([^/]+)\/(.+)$/.exec(issue.path);
		if (!match) {
			continue;
		}
		const entry = byId.get(match[1] ?? '');
		if (!entry) {
			continue;
		}
		const field = match[2] ?? '';
		const displayId =
			entry.component.logicalId.trim() === '' ? '-' : entry.component.logicalId.trim();
		const predicate =
			issue.message === field ||
			issue.message.startsWith(`${field} `) ||
			issue.message.startsWith(`${field}は`)
				? issue.message
				: `${field} は${issue.message}`;
		issue.message = `${entry.row}行目 ${displayId} (${entry.component.type}) の ${predicate}`;
	}
}

/**
 * UIDefinition の整合性を検査する
 *
 * プロファイルを省略したときはコア規則だけを使う。
 */
export function validateUiDefinition(
	meta: UiDefinitionValidationMeta,
	components: readonly EditorComponent[],
	profile: UiDefinitionValidationProfile = createDefaultUiDefinitionValidationProfile()
): UiDefinitionValidationReport {
	if (profile.plugins.length > 0) {
		throw new Error(`unknown uiDefinition validation plugin: ${profile.plugins[0]}`);
	}

	const issues: UiDefinitionValidationIssue[] = [];
	const blocked = new Map<string, 'required' | 'charset'>();
	collectCoreIssues(meta, components, issues, blocked);
	collectProfileIssues(meta, components, profile, issues, blocked);
	decorateMetaIssueMessages(issues);
	decorateComponentIssueMessages(components, issues);
	return { ok: issues.length === 0, issues };
}

/**
 * path そのもの、またはその配下の issue を返す
 */
export function issuesUnderPath(
	issues: readonly UiDefinitionValidationIssue[],
	path: string
): UiDefinitionValidationIssue[] {
	return issues.filter((issue) => issue.path === path || issue.path.startsWith(`${path}/`));
}

/**
 * Details スロットが編集するドメインフィールド名を返す。非表示スロットは undefined
 */
export function detailsSlotField(type: string, slotId: number): string | undefined {
	if (slotId === 0 && type !== 'unsupported') {
		return 'defaultValue';
	}
	if (slotId === 1 && (type === 'checkbox' || type === 'radio' || type === 'dropdown' || type === 'dropdown-multi')) {
		return 'items';
	}
	if (
		slotId === 1 &&
		(type === 'datepicker' || type === 'date-span' || type === 'timepicker' || type === 'datetimepicker')
	) {
		return 'format';
	}
	if (slotId === 1 && type === 'textarea') {
		return 'cols';
	}
	if (slotId === 2 && type === 'textarea') {
		return 'rows';
	}
	return undefined;
}

/**
 * Validation スロットが編集する葉フィールド名を返す。非表示スロットは undefined
 */
export function validationSlotField(type: string, slotId: number): string | undefined {
	if (type === 'textbox' && slotId === 0) {
		return 'pattern';
	}
	if (type === 'textbox' && slotId === 1) {
		return 'minlength';
	}
	if (type === 'textbox' && slotId === 2) {
		return 'maxlength';
	}
	if (type === 'textarea' && slotId === 0) {
		return 'maxlength';
	}
	if (type === 'textarea' && slotId === 1) {
		return 'minlength';
	}
	if (type === 'number' && slotId === 0) {
		return 'min';
	}
	if (type === 'number' && slotId === 1) {
		return 'max';
	}
	if (type === 'number' && slotId === 2) {
		return 'scale';
	}
	if (type === 'number' && slotId === 3) {
		return 'step';
	}
	if ((type === 'datepicker' || type === 'date-span') && slotId === 0) {
		return 'minDate';
	}
	if ((type === 'datepicker' || type === 'date-span') && slotId === 1) {
		return 'maxDate';
	}
	if (type === 'date-span' && slotId === 2) {
		return 'requiredFrom';
	}
	if (type === 'date-span' && slotId === 3) {
		return 'requiredTo';
	}
	if (type === 'timepicker' && slotId === 0) {
		return 'minTime';
	}
	if (type === 'timepicker' && slotId === 1) {
		return 'maxTime';
	}
	if (type === 'datetimepicker' && slotId === 0) {
		return 'minDateTime';
	}
	if (type === 'datetimepicker' && slotId === 1) {
		return 'maxDateTime';
	}
	return undefined;
}

/**
 * スロットの検証 path を返す。validation 配下の葉は `validation/` を付ける
 */
export function slotIssuePath(componentId: string, fieldName: string, group: 'details' | 'validation'): string {
	if (group === 'validation') {
		return `components/${componentId}/validation/${fieldName}`;
	}
	return `components/${componentId}/${fieldName}`;
}
