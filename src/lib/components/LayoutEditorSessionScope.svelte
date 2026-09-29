<!--
 このコンポーネントは、layout editor のセッションを管理する。
 セッションは、
 - IR、コメント、スキーマ同意、自動保存、検証結果などを含む。
 - {#key session} で作り直す。
 - $state proxy なので、untrack で値を取り出す。
 - $effect で変化を監視し、必要な Context を設定する。
 - $effect で変化を監視し、必要な Context を設定する。
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import MarkdownCommentModal from '$lib/components/MarkdownCommentModal.svelte';
	import SchemaMigrationConsentModal from '$lib/components/SchemaMigrationConsentModal.svelte';
	import type { UiDefinitionValidationProfile } from '$lib/config/ui-definition-validation-config';
	import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';
	import {
		attachIrAutoSave,
		hashUiDefinitionIr,
		type IrAutoSaveOptions
	} from '$lib/store/layout-editor/ir-auto-save.svelte';
	import type { LayoutEditorConfig } from '$lib/config/layout-editor-config';
	import { setLayoutEditorConfigContext } from '$lib/store/layout-editor/layout-editor-config.svelte';
	import { setUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { setPreviewThemeContext } from '$lib/store/layout-editor/preview-theme.svelte';
	import {
		createUiDefinitionValidationState,
		setUiDefinitionValidationContext
	} from '$lib/store/layout-editor/ui-definition-validation.svelte';
	import {
		dismissSchemaConsent,
		markSchemaMigrationConsent,
		pendingSchemaConsent
	} from '$lib/store/layout-editor/schema-migration-consent.svelte';
	import {
		LAYOUT_PARKED_SAVE_BLOCK_MESSAGE,
		sameLayoutColumnItems,
		syncLayoutColumns
	} from '$lib/store/layout-editor/layout-columns';
	import { setLayoutColumnsContext } from '$lib/store/layout-editor/layout-columns.svelte';
	import { setSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';
	import { setTransformTargetContext } from '$lib/store/layout-editor/transform-target.svelte';
	import { getToastContext } from '$lib/store/toast/toast.svelte';
	import { debounce } from '$lib/utils/debounce';
	import {
		activateLayoutEditorDiskSnapshot,
		type LayoutEditorSession
	} from '$lib/store/layout-editor/layout-editor-session.svelte';

	/**
	 * セッションを管理するコンポーネントの props
	 */
	type Props = {
		session: LayoutEditorSession;
		autoSave: IrAutoSaveOptions;
		layoutEditor: LayoutEditorConfig;
		uiDefinitionValidation: UiDefinitionValidationProfile;
		schemaBlock: SnapshotSchemaBlock | null;
		children: Snippet;
	};

	let { session, autoSave, layoutEditor, uiDefinitionValidation, schemaBlock, children }: Props = $props();

	// WARN: {#key session} でこのコンポーネントは作り直す。初期化時の session を Context に載せる。
	const bound = untrack(() => session);
	const saveOptions = untrack(() => autoSave);
	const editorConfig = untrack(() => layoutEditor);
	const validationProfile = untrack(() => uiDefinitionValidation);

	setUIDefinitionContext(bound.uiDefinition);
	setLayoutColumnsContext(bound.layoutColumns);
	setPreviewThemeContext(bound.previewTheme);
	setTransformTargetContext(bound.transformTarget);
	setSnapshotCommentsContext(bound.snapshotComments);
	setLayoutEditorConfigContext(editorConfig);

	const toast = getToastContext();
	const validationState = createUiDefinitionValidationState(
		validationProfile,
		bound.uiDefinition,
		toast
	);
	setUiDefinitionValidationContext(validationState);

	/**
	 * 検証を行う
	 */
	untrack(() => {
		validationState.revalidate();
	});

	/**
	 * 自動保存を設定する
	 */
	attachIrAutoSave(
		bound.uiDefinition,
		bound.snapshotComments,
		saveOptions,
		bound.checkpoint,
		saveOptions.enabled
			? () => validationState.revalidate() && bound.layoutColumns.parked.length === 0
			: undefined,
		saveOptions.enabled ? () => bound.layoutColumns.parked.length > 0 : undefined
	);

	/**
	 * 検証を遅延実行する
	 */
	const validateLater = debounce(() => {
		validationState.revalidate();
	}, validationProfile.delay);
	/**
	 * 自動保存が無効なら、検証を遅延実行する
	 */
	$effect(() => {
		if (saveOptions.enabled) {
			return;
		}
		hashUiDefinitionIr(bound.uiDefinition);
		untrack(() => {
			validateLater();
		});
		return () => {
			validateLater.cancel();
		};
	});

	/**
	 * 確定済み components に二つの列を合わせる。退避が空で順が違えば確定する
	 *
	 * WARN: ドラッグ中は影 id が確定側に無いので同期しない。
	 */
	$effect(() => {
		const committed = bound.uiDefinition.components;
		const dragging = bound.layoutColumns.dragging;
		const main = bound.layoutColumns.main;
		const parked = bound.layoutColumns.parked;
		if (dragging) {
			return;
		}

		const next = syncLayoutColumns(committed, main, parked);
		untrack(() => {
			if (!sameLayoutColumnItems(bound.layoutColumns.main, next.main)) {
				bound.layoutColumns.main = next.main;
			}
			if (!sameLayoutColumnItems(bound.layoutColumns.parked, next.parked)) {
				bound.layoutColumns.parked = next.parked;
			}
			if (!next.commitMain) {
				return;
			}
			bound.uiDefinition.replaceComponents(next.main);
			bound.layoutColumns.main = bound.uiDefinition.components.slice();
			bound.layoutColumns.parked = [];
		});
	});

	let parkedToastId = '';

	/**
	 * 退避が空でなくなったときだけ error Toast を出し、空に戻したら消す
	 */
	$effect(() => {
		const parked = bound.layoutColumns.parked.length > 0;
		if (parked && parkedToastId === '') {
			parkedToastId = toast.add({
				severity: 'error',
				summary: LAYOUT_PARKED_SAVE_BLOCK_MESSAGE
			});
			return;
		}
		if (!parked && parkedToastId !== '') {
			toast.dismiss(parkedToastId);
			parkedToastId = '';
		}
	});

	/**
	 * スキーマ同意のポップアップを表示する
	 */
	const consentPrompt = $derived(pendingSchemaConsent());
	let consentBusy = $state(false);

	/**
	 * スキーマ同意のブロックを表示する
	 */
	$effect(() => {
		const block = schemaBlock;
		if (!block || block.code === 'schema-consent' || bound.schemaAnnounced) {
			return;
		}
		bound.schemaAnnounced = true;
		toast.error('snapshot を読めません', block.error);
	});

	/**
	 * 同意後に current を migration 済みで読み込み、エディタへ載せる
	 */
	async function reloadConsentedSnapshot(logicalId: string): Promise<void> {
		/**
		 * snapshot を読み込む
		 */
		const response = await fetch(
			`/api/ir/snapshot?logicalId=${encodeURIComponent(logicalId)}&confirmMigration=true`
		);
		if (!response.ok) {
			toast.error('snapshot の読み込みに失敗しました', `HTTP ${response.status}`);
			return;
		}

		const snapshot = (await response.json()) as {
			uiDefinition?: Record<string, unknown>;
			components?: unknown[];
			comments?: Record<string, string>;
		};
		activateLayoutEditorDiskSnapshot(snapshot);
	}

	/**
	 * 破壊的 migration に同意する
	 */
	async function acceptSchemaConsent(): Promise<void> {
		const prompt = pendingSchemaConsent();
		if (!prompt || consentBusy) {
			return;
		}

		consentBusy = true;
		try {
			markSchemaMigrationConsent(prompt.logicalId);
			const retry = dismissSchemaConsent();
			if (retry) {
				retry();
				return;
			}
			await reloadConsentedSnapshot(prompt.logicalId);
		} finally {
			consentBusy = false;
		}
	}

	/**
	 * 同意を見送る。自動保存は止めたままにする
	 */
	function declineSchemaConsent(): void {
		dismissSchemaConsent();
	}
</script>

{@render children()}
<MarkdownCommentModal />
<SchemaMigrationConsentModal
	open={consentPrompt !== null}
	rationales={consentPrompt?.rationales ?? []}
	busy={consentBusy}
	onConfirm={() => {
		void acceptSchemaConsent();
	}}
	onCancel={declineSchemaConsent}
/>
