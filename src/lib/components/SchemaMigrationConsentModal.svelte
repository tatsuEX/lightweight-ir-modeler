<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';

	let {
		open = false,
		rationales = [],
		busy = false,
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		rationales?: readonly string[];
		busy?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	let modalOpen = $state(false);

	$effect(() => {
		modalOpen = open;
	});
</script>

<Modal
	title="画面定義の構造を更新します"
	bind:open={modalOpen}
	dismissable={false}
	outsideclose={false}
	size="md"
	classes={{ header: 'py-2 md:py-2', body: 'p-4' }}
>
	<div class="flex flex-col gap-4">
		<p class="text-sm text-gray-700 dark:text-gray-300">
			保存済み snapshot の構造が、このビルドより古い主要版です。読み込むと構造が変わります。
		</p>
		{#if rationales.length > 0}
			<ul class="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
				{#each rationales as rationale, index (index)}
					<li>{rationale}</li>
				{/each}
			</ul>
		{/if}
		<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
			<Button size="xs" color="alternative" disabled={busy} onclick={onCancel}>キャンセル</Button>
			<Button size="xs" color="primary" disabled={busy} onclick={onConfirm}>同意して読み込む</Button>
		</div>
	</div>
</Modal>
