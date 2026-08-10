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

	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { getTransformTargetContext } from '$lib/store/layout-editor/transform-target.svelte';
	import { resolveUiImportClient } from '$lib/store/layout-editor/ui-import-client';

	const uiDefinition = getUIDefinitionContext();
	const transformTarget = getTransformTargetContext();

	// WARN: Reader 未実装の target は選ばせない。選択肢は import クライアント registry で絞り込む。
	const targetItems: SelectOptionType<string>[] = transformTarget.target.filter((item) =>
		Boolean(resolveUiImportClient(item.value))
	);

	let open = $state(false);
	let selectedTarget = $state<string>(targetItems[0]?.value ?? '');
	let files = $state<FileList | undefined>();
	let errorMessage = $state('');
	let busy = $state(false);

	const importClient = $derived(resolveUiImportClient(selectedTarget));
	const acceptAttribute = $derived(importClient?.acceptExtensions.join(',') ?? '');
	const selectedFile = $derived(files?.item(0) ?? null);

	/**
	 * 取り込みダイアログを開く
	 */
	function openImport(): void {
		errorMessage = '';
		files = undefined;
		open = true;
	}

	/**
	 * 選択したファイルを取り込み、編集中の画面定義を丸ごと置き換える
	 */
	async function handleImport(): Promise<void> {
		if (!importClient || !selectedFile || busy) {
			return;
		}

		busy = true;
		errorMessage = '';
		try {
			uiDefinition.loadImported(await importClient.importDefinition(selectedFile));
			open = false;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : '取り込みに失敗しました';
		} finally {
			busy = false;
		}
	}
</script>

<Button color="alternative" disabled={targetItems.length === 0} onclick={openImport}>
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
			現在の編集内容はすべて破棄され、選択したファイルの内容で置き換わります。取り込み後は新しい論理
			ID で自動保存されます。
		</Alert>

		{#if errorMessage}
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
