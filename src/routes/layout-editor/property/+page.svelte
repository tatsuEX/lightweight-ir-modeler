<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import ComponentAttributeTable from '$lib/components/ComponentAttributeTable.svelte';
	import ComponentToolPalette from '$lib/components/ComponentToolPalette.svelte';
	import DefinitionImportModal from '$lib/components/DefinitionImportModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedCount = $state(0);
	let attributeTable = $state<ComponentAttributeTable | undefined>();

	/**
	 * 選択中の行を削除する
	 */
	function removeSelectedRows(): void {
		attributeTable?.removeSelected();
	}
</script>

<main class="flex h-full min-h-0 flex-col">
	<div class="mb-4 flex shrink-0 items-start justify-between gap-4">
		<div>
			<h1 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Property</h1>
			<p class="text-gray-600 dark:text-gray-400">
				UI コンポーネントの属性を編集する画面です。Basic / Details / Validation で列を切り替えられます。
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<DefinitionImportModal />
			<Button size="xs" color="red" disabled={selectedCount === 0} onclick={removeSelectedRows}>
				選択行を削除
			</Button>
			<ComponentToolPalette />
		</div>
	</div>
	<div class="h-full min-h-0 flex-1">
		<ComponentAttributeTable
			bind:selectedCount
			bind:this={attributeTable}
			itemDelimiter={data.layoutEditor.property.itemDelimiter}
		/>
	</div>
</main>
