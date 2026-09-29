<script lang="ts">
	import ComponentLayoutBuilder from '$lib/components/ComponentLayoutBuilder.svelte';
</script>

<main class="flex h-full min-h-0 flex-col overflow-hidden">
	<h1 class="mb-2 shrink-0 text-xl font-semibold text-gray-900 dark:text-white">Layout</h1>
	<p class="mb-3 shrink-0 text-gray-600 dark:text-gray-400">
		左右の列のあいだで UI コンポーネントを並べ替えます。退避列に項目があるあいだは自動保存しません。
	</p>
	<div class="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
		<ComponentLayoutBuilder />
	</div>
</main>
