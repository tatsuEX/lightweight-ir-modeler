<script lang="ts">
	import ComponentLayoutBuilder from '$lib/components/ComponentLayoutBuilder.svelte';
</script>

<main class="h-full min-h-0 overflow-auto">
	<h1 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Layout</h1>
	<p class="text-gray-600 dark:text-gray-400">
		UI コンポーネントを並べ替える画面です。
	</p>
	<ComponentLayoutBuilder />
</main>
