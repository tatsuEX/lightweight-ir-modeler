<script lang="ts">
    import Preview from '$lib/components/Preview.svelte';
</script>

<main class="flex h-full min-h-0 flex-col overflow-hidden">
	<div class="mb-4 shrink-0">
		<h1 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Preview</h1>
		<p class="text-gray-600 dark:text-gray-400">
			完成イメージを表示し、外部 UI 定義ファイルを出力できる画面です。
		</p>
	</div>
	<div class="h-full min-h-0 flex-1">
		<Preview />
	</div>
</main>
