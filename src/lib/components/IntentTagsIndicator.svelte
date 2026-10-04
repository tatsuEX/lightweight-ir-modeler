<script lang="ts">
	import { Tooltip } from 'flowbite-svelte';
	import { TagOutline } from 'flowbite-svelte-icons';

	type Props = {
		/** 付与済み Intent Tags（空なら何も描画しない） */
		tags: readonly string[] | undefined;
		ariaLabel: string;
		/** クリック時（閲覧ダイアログを開く） */
		onopen: () => void;
	};

	let { tags, ariaLabel, onopen }: Props = $props();

	const count = $derived(tags?.length ?? 0);
</script>

{#if count > 0}
	<span class="relative inline-flex">
		<button
			type="button"
			class="inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-md border border-indigo-300 bg-indigo-50 px-1 text-xs text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-200"
			aria-label="{ariaLabel}（Intent Tags {count} 件）"
			onclick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onopen();
			}}
		>
			<TagOutline size="xs" />
			{count}
		</button>
		<Tooltip placement="bottom" class="z-40 max-w-xs whitespace-normal">
			<div class="font-semibold">Intent Tags</div>
			<ul class="mt-1 font-mono text-xs">
				{#each tags ?? [] as tag (tag)}
					<li>{tag}</li>
				{/each}
			</ul>
		</Tooltip>
	</span>
{/if}
