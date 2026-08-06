<script lang="ts">
	import ComponentAttributeTable from '$lib/components/ComponentAttributeTable.svelte';
	import ComponentToolPalette from '$lib/components/ComponentToolPalette.svelte';
</script>

<main>
	<div class="mb-4 flex items-start justify-between gap-4">
		<div>
			<h1 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Property</h1>
			<p class="text-gray-600 dark:text-gray-400">
				UI コンポーネントの基本属性を編集する画面です。
			</p>
		</div>
		<ComponentToolPalette />
	</div>
	<ComponentAttributeTable />
</main>
