<script lang="ts">
	import {
		Alert,
		Button,
		Fileupload,
		Label,
		Modal,
		Select,
		type SelectOptionType
	} from 'flowbite-svelte';

	import ConfirmNewSnapshotDirModal from '$lib/components/ConfirmNewSnapshotDirModal.svelte';
	import { isValidLogicalId } from '$lib/ir/ui-definition-meta';
	import type { ImportedDefinition } from '$lib/transform/imported-definition';
	import { getLayoutEditorConfigContext } from '$lib/store/layout-editor/layout-editor-config.svelte';
	import { getUIDefinitionContext, loadImported } from '$lib/store/layout-editor/layout-editor.svelte';
	import { rekeyActiveSessionFromMeta } from '$lib/store/layout-editor/layout-editor-session.svelte';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';
	import { getTransformTargetContext } from '$lib/store/layout-editor/transform-target.svelte';
	import { resolveUiImportClient } from '$lib/store/layout-editor/ui-import-client';
	import {
		setSnapshotDirConfirmSkippedByUser,
		shouldPromptNewSnapshotDir,
		snapshotDirectoryExists
	} from '$lib/store/layout-editor/snapshot-dir-confirm';
	import { getToastContext } from '$lib/store/toast/toast.svelte';
	import { getUiDefinitionValidationContext } from '$lib/store/layout-editor/ui-definition-validation.svelte';
	import { IssuesError, issuesFromUnknown, type NotifyIssue } from '$lib/utils/validation-issue-notify';

	const uiDefinition = getUIDefinitionContext();
	const snapshotComments = getSnapshotCommentsContext();
	const transformTarget = getTransformTargetContext();
	const layoutEditorConfig = getLayoutEditorConfigContext();
	const toast = getToastContext();
	const validationState = getUiDefinitionValidationContext();

	// WARN: Reader 未実装の target は選ばせない。選択肢は import クライアント registry で絞り込む。
	const targetItems: SelectOptionType<string>[] = transformTarget.target.filter((item) =>
		Boolean(resolveUiImportClient(item.value))
	);

	let open = $state(false);
	let selectedTarget = $state<string>(targetItems[0]?.value ?? '');
	let files = $state<FileList | undefined>();
	let errorMessage = $state('');
	let errorIssues = $state<NotifyIssue[]>([]);
	let busy = $state(false);

	let confirmOpen = $state(false);
	let confirmInitialId = $state('');
	// WARN: $state に載せるト Proxy 化され loadSnapshot の structuredClone が DataCloneError になる
	let pendingImported: ImportedDefinition | null = null;

	const importClient = $derived(resolveUiImportClient(selectedTarget));
	const acceptAttribute = $derived(importClient?.acceptExtensions.join(',') ?? '');
	const selectedFile = $derived(files?.item(0) ?? null);

	/**
	 * 取り込みダイアログを開く
	 */
	function openImport(): void {
		errorMessage = '';
		errorIssues = [];
		files = undefined;
		pendingImported = null;
		confirmOpen = false;
		open = true;
	}

	/**
	 * 取り込み結果を編集状態へ反映する
	 */
	function applyImported(imported: ImportedDefinition): void {
		confirmOpen = false;
		open = false;
		pendingImported = null;
		try {
			loadImported(uiDefinition, imported);
			rekeyActiveSessionFromMeta();
			snapshotComments.clear();
			toast.info('定義を取り込みました', imported.uiDefinition.logicalId);
			// WARN: 取り込み直後に全 issue を一度に publish する。1 件ずつ赤くしない。
			validationState.revalidate();
		} catch (error) {
			errorIssues = issuesFromUnknown(error);
			errorMessage = error instanceof Error ? error.message : '取り込み結果の反映に失敗しました';
			open = true;
		}
	}

	/**
	 * 選択したファイルを取り込み、必要なら新規自動保存先の確認後に置き換える
	 */
	async function handleImport(): Promise<void> {
		if (!importClient || !selectedFile || busy) {
			return;
		}

		busy = true;
		errorMessage = '';
		errorIssues = [];
		try {
			const imported = await importClient.importDefinition(selectedFile);
			const logicalId = imported.uiDefinition.logicalId.trim();

			if (!isValidLogicalId(logicalId)) {
				applyImported(imported);
				return;
			}

			const exists = await snapshotDirectoryExists(logicalId);
			if (
				exists ||
				!shouldPromptNewSnapshotDir(layoutEditorConfig.property.confirmSnapshotDirCreation)
			) {
				applyImported(imported);
				return;
			}

			pendingImported = imported;
			confirmInitialId = logicalId;
			confirmOpen = true;
		} catch (error) {
			errorIssues = issuesFromUnknown(error);
			if (error instanceof IssuesError) {
				errorMessage = `取り込み検証エラーが ${error.issues.length} 件あります`;
			} else {
				errorMessage = error instanceof Error ? error.message : '取り込みに失敗しました';
			}
		} finally {
			busy = false;
		}
	}

	/**
	 * 新規自動保存先確認で続行する
	 */
	function handleConfirmContinue(logicalId: string, dontAskAgain: boolean): void {
		if (!pendingImported) {
			confirmOpen = false;
			return;
		}
		if (dontAskAgain) {
			setSnapshotDirConfirmSkippedByUser(true);
		}
		pendingImported.uiDefinition.logicalId = logicalId;
		applyImported(pendingImported);
	}

	/**
	 * 新規自動保存先確認をキャンセルする（取り込み自体を中止）
	 */
	function handleConfirmCancel(): void {
		confirmOpen = false;
		pendingImported = null;
	}
</script>

<Button size="xs" color="alternative" disabled={targetItems.length === 0} onclick={openImport}>
	定義インポート
</Button>

<Modal title="定義インポート" bind:open size="sm">
	<div class="flex flex-col gap-4">
		<Label>
			取り込み元の形式
			<Select class="mt-2" items={targetItems} bind:value={selectedTarget} />
		</Label>

		<Label>
			定義ファイル
			<Fileupload class="mt-2" accept={acceptAttribute} bind:files clearable />
		</Label>

		<Alert color="yellow">
			現在の編集内容はすべて破棄され、選択したファイルの内容で置き換わります。取り込み後は画面 ID
			で自動保存されます。
		</Alert>

		{#if errorIssues.length > 0}
			<Alert color="red" role="alert">
				<p class="font-medium">{errorMessage}</p>
				<ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
					{#each errorIssues as issue (`${issue.path}:${issue.message}`)}
						<li><span class="font-mono text-xs">{issue.path}</span>: {issue.message}</li>
					{/each}
				</ul>
			</Alert>
		{:else if errorMessage}
			<Alert color="red" role="alert">{errorMessage}</Alert>
		{/if}

		<div class="flex flex-row flex-wrap items-center justify-end gap-2">
			<Button color="alternative" disabled={busy} onclick={() => (open = false)}>キャンセル</Button>
			<Button color="primary" disabled={!importClient || !selectedFile || busy} onclick={handleImport}>
				取り込む
			</Button>
		</div>
	</div>
</Modal>

<ConfirmNewSnapshotDirModal
	bind:open={confirmOpen}
	initialId={confirmInitialId}
	onConfirm={handleConfirmContinue}
	onCancel={handleConfirmCancel}
/>
