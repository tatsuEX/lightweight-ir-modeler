<script lang="ts">
	import { Button, Checkbox, Input, Label, Modal } from 'flowbite-svelte';
	import { isValidLogicalId } from '$lib/ir/ui-definition-meta';

	let {
		open = $bindable(false),
		/** ダイアログ表示時の初期画面 ID */
		initialId = '',
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		initialId?: string;
		onConfirm: (logicalId: string, dontAskAgain: boolean) => void;
		onCancel: () => void;
	} = $props();

	let draftId = $state('');
	let dontAskAgain = $state(false);

	const idValid = $derived(isValidLogicalId(draftId.trim()));

	$effect(() => {
		if (open) {
			draftId = initialId;
			dontAskAgain = false;
		}
	});

	/**
	 * 続行する
	 */
	function handleContinue(): void {
		const trimmed = draftId.trim();
		if (!isValidLogicalId(trimmed)) {
			return;
		}
		onConfirm(trimmed, dontAskAgain);
	}

	/**
	 * キャンセルする
	 */
	function handleCancel(): void {
		onCancel();
	}
</script>

<Modal title="画面 ID の確認" bind:open size="sm">
	<div class="flex flex-col gap-4">
		<p class="text-sm text-gray-700 dark:text-gray-300">
			未使用の画面IDが入力されたため、自動保存先が新規作成されます。<br />
			入力ミスがないか確認してください。
		</p>

		<div class="flex flex-col gap-1">
			<Label for="confirm-snapshot-dir-logical-id">ID</Label>
			<Input
				id="confirm-snapshot-dir-logical-id"
				size="sm"
				required
				aria-label="画面 ID"
				bind:value={draftId}
			/>
			{#if draftId.trim() !== '' && !idValid}
				<p class="text-xs text-red-600 dark:text-red-400">
					英字で始まり、英数字・_・- のみ使用できます。
				</p>
			{/if}
		</div>

		<Checkbox bind:checked={dontAskAgain}>次回以降確認しない</Checkbox>

		<div class="flex flex-row flex-wrap items-center justify-end gap-2">
			<Button color="alternative" onclick={handleCancel}>キャンセル</Button>
			<Button color="primary" disabled={!idValid} onclick={handleContinue}>続行</Button>
		</div>
	</div>
</Modal>
