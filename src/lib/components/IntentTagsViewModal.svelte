<script lang="ts">
	import { Badge, Button, Modal } from 'flowbite-svelte';
	import { getIntentTagCatalogContext } from '$lib/store/layout-editor/intent-tag-catalog.svelte';

	type Props = {
		open?: boolean;
		/** 見出し（例 `components[userName]`、将来は `meta[screenA]`） */
		title: string;
		tags: readonly string[];
	};

	let { open = $bindable(false), title, tags }: Props = $props();

	const catalog = getIntentTagCatalogContext();
</script>

<Modal title={title} bind:open size="md" outsideclose>
	{#if tags.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400">Intent Tags はありません。</p>
	{:else}
		<ul class="flex flex-col divide-y divide-gray-200 dark:divide-gray-600">
			{#each tags as tag (tag)}
				{@const definition = catalog.find(tag)}
				<li class="flex flex-col gap-1 py-2">
					<div class="flex items-center gap-2">
						<span class="font-mono text-sm text-gray-900 dark:text-white">{tag}</span>
						{#if definition}
							<Badge color="indigo">{definition.source}</Badge>
						{:else}
							<Badge color="yellow">未登録</Badge>
						{/if}
					</div>
					{#if definition?.description}
						<p class="text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-300">
							{definition.description}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#snippet footer()}
		<Button size="xs" color="alternative" onclick={() => (open = false)}>閉じる</Button>
	{/snippet}
</Modal>
