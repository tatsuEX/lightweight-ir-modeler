<script lang="ts">
	import type { CommentTreeNode } from '$lib/ir/comment-target-tree';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';

	type Props = {
		root: CommentTreeNode;
		selectedOwnerKey: string;
		onSelect: (ownerKey: string, title: string) => void;
	};

	let { root, selectedOwnerKey, onSelect }: Props = $props();

	const comments = getSnapshotCommentsContext();

	/**
	 * ツリー行を選択する
	 */
	function selectNode(node: CommentTreeNode): void {
		onSelect(node.ownerKey, node.title);
	}
</script>

<nav class="h-full min-h-0 overflow-auto text-sm" aria-label="コメント対象">
	<ul class="flex flex-col gap-0.5">
		{@render treeItem(root, 0)}
	</ul>
</nav>

{#snippet treeItem(node: CommentTreeNode, depth: number)}
	<li>
		<button
			type="button"
			class="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left font-mono text-xs {node.ownerKey ===
			selectedOwnerKey
				? 'bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
				: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'} {comments.has(
				node.ownerKey
			)
				? 'font-semibold'
				: ''}"
			style="padding-left: {0.5 + depth * 0.75}rem"
			aria-current={node.ownerKey === selectedOwnerKey ? 'true' : undefined}
			onclick={() => selectNode(node)}
		>
			{node.label}
		</button>
		{#if node.children.length > 0}
			<ul>
				{#each node.children as child (child.ownerKey)}
					{@render treeItem(child, depth + 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}
