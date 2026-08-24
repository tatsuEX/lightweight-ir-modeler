<script lang="ts">
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

	let previewOpen = $state(false);

	/**
	 * プレビューを出す（コメントがあるときだけ）
	 */
	function showPreview(): void {
		if (filled) {
			previewOpen = true;
		}
	}

	/**
	 * プレビューを閉じる
	 */
	function hidePreview(): void {
		previewOpen = false;
	}

	/**
	 * 編集モーダルを開く
	 */
	function openEditor(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		hidePreview();
		comments.openEditor(ownerKey, title);
	}
</script>

<span
	class="relative inline-flex"
	onmouseenter={showPreview}
	onmouseleave={hidePreview}
	onfocusin={showPreview}
	onfocusout={hidePreview}
>
	<button
		type="button"
		class="inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm {filled
			? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/40 dark:text-blue-200'
			: 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'}"
		aria-label={ariaLabel}
		aria-pressed={filled}
		onclick={openEditor}
	>
		#
	</button>
	{#if previewOpen && previewHtml}
		<div
			class="markdown-comment-preview absolute top-full right-0 z-30 mt-1 max-h-64 w-72 overflow-auto rounded-md border border-gray-200 bg-white p-3 text-left text-xs text-gray-800 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
			role="tooltip"
		>
			{@html previewHtml}
		</div>
	{/if}
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
