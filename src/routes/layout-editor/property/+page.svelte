<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import ComponentAttributeTable from '$lib/components/ComponentAttributeTable.svelte';
	import ComponentToolPalette from '$lib/components/ComponentToolPalette.svelte';

	let selectedCount = $state(0);
	let attributeTable = $state<ComponentAttributeTable | undefined>();

	/**
	 * 選択中の行を削除する
	 */
	function removeSelectedRows(): void {
		attributeTable?.removeSelected();
	}
</script>

<main>
	<div class="mb-4 flex items-start justify-between gap-4">
		<div>
			<h1 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Property</h1>
			<p class="text-gray-600 dark:text-gray-400">
				UI コンポーネントの基本属性を編集する画面です。
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button color="red" disabled={selectedCount === 0} onclick={removeSelectedRows}>
				選択行を削除
			</Button>
			<ComponentToolPalette />
		</div>
	</div>
	<ComponentAttributeTable bind:selectedCount bind:this={attributeTable} />
</main>
