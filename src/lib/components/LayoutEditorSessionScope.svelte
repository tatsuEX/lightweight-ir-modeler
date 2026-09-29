<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import MarkdownCommentModal from '$lib/components/MarkdownCommentModal.svelte';
	import SchemaMigrationConsentModal from '$lib/components/SchemaMigrationConsentModal.svelte';
	import type { SnapshotSchemaBlock } from '$lib/ir/snapshot-schema-block';
	import { attachIrAutoSave, type IrAutoSaveOptions } from '$lib/store/layout-editor/ir-auto-save.svelte';
	import type { LayoutEditorConfig } from '$lib/config/layout-editor-config';
	import { setLayoutEditorConfigContext } from '$lib/store/layout-editor/layout-editor-config.svelte';
	import { setUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { setPreviewThemeContext } from '$lib/store/layout-editor/preview-theme.svelte';
	import {
		dismissSchemaConsent,
		markSchemaMigrationConsent,
		pendingSchemaConsent
	} from '$lib/store/layout-editor/schema-migration-consent.svelte';
	import { setSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';
	import { setTransformTargetContext } from '$lib/store/layout-editor/transform-target.svelte';
	import { getToastContext } from '$lib/store/toast/toast.svelte';
	import {
		activateLayoutEditorDiskSnapshot,
		type LayoutEditorSession
	} from '$lib/store/layout-editor/layout-editor-session.svelte';

	type Props = {
		session: LayoutEditorSession;
		autoSave: IrAutoSaveOptions;
		layoutEditor: LayoutEditorConfig;
		schemaBlock: SnapshotSchemaBlock | null;
		children: Snippet;
	};

	let { session, autoSave, layoutEditor, schemaBlock, children }: Props = $props();

	// WARN: {#key session} でこのコンポーネントは作り直す。初期化時の session を Context に載せる。
	const bound = untrack(() => session);
	const saveOptions = untrack(() => autoSave);
	const editorConfig = untrack(() => layoutEditor);

	setUIDefinitionContext(bound.uiDefinition);
	setPreviewThemeContext(bound.previewTheme);
	setTransformTargetContext(bound.transformTarget);
	setSnapshotCommentsContext(bound.snapshotComments);
	setLayoutEditorConfigContext(editorConfig);
	attachIrAutoSave(bound.uiDefinition, bound.snapshotComments, saveOptions, bound.checkpoint);

	const toast = getToastContext();
	const consentPrompt = $derived(pendingSchemaConsent());
	let consentBusy = $state(false);

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
