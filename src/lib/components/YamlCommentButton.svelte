<script lang="ts">
	import { Tooltip } from 'flowbite-svelte';
	import { renderMarkdownPreview } from '$lib/utils/markdown-preview';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';

	type Props = {
		ownerKey: string;
		/** モーダル見出し（YAML パスなど） */
		title: string;
		ariaLabel: string;
	};

	let { ownerKey, title, ariaLabel }: Props = $props();

	const comments = getSnapshotCommentsContext();
	const body = $derived(comments.get(ownerKey));
	const filled = $derived(comments.has(ownerKey));
	const previewHtml = $derived(filled ? renderMarkdownPreview(body) : '');

	/**
	 * 編集モーダルを開く
	 */
	function openEditor(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		comments.openEditor(ownerKey, title);
	}
</script>

<span class="relative inline-flex">
	<button
		type="button"
		class="inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm {filled
			? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/40 dark:text-blue-200'
			: 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'}"
		aria-label="{ariaLabel}（コメントを編集）"
		aria-pressed={filled}
		onclick={openEditor}
	>
		#
	</button>
	<Tooltip placement="bottom" class="z-40 max-w-xs whitespace-normal">
		コメントを編集
		{#if previewHtml}
			<div
				class="markdown-comment-preview mt-2 max-h-48 overflow-auto border-t border-gray-200 pt-2 text-left dark:border-gray-600"
			>
				{@html previewHtml}
			</div>
		{/if}
	</Tooltip>
</span>

<style>
	.markdown-comment-preview :global(h1),
	.markdown-comment-preview :global(h2),
	.markdown-comment-preview :global(h3) {
		font-weight: 600;
		margin: 0 0 0.35rem;
	}
	.markdown-comment-preview :global(p),
	.markdown-comment-preview :global(ul) {
		margin: 0 0 0.35rem;
	}
	.markdown-comment-preview :global(ul) {
		padding-left: 1.1rem;
		list-style: disc;
	}
	.markdown-comment-preview :global(code) {
		font-size: 0.75rem;
	}
</style>
