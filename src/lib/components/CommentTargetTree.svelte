<script lang="ts">
	import { untrack } from 'svelte';
	import { AngleDownOutline, AngleRightOutline } from 'flowbite-svelte-icons';
	import {
		collectAncestorOwnerKeys,
		defaultExpandedOwnerKeys,
		type CommentTreeNode
	} from '$lib/ir/comment-target-tree';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';

	type Props = {
		root: CommentTreeNode;
		selectedOwnerKey: string;
		onSelect: (ownerKey: string, title: string) => void;
	};

	let { root, selectedOwnerKey, onSelect }: Props = $props();

	const comments = getSnapshotCommentsContext();

	let expandedKeys = $state(new Set<string>());
	let trackedRootKey = $state<string | null>(null);

	$effect(() => {
		const currentRoot = root;
		const selected = selectedOwnerKey;
		const defaults = defaultExpandedOwnerKeys(currentRoot);
		const ancestors = collectAncestorOwnerKeys(currentRoot, selected);

		untrack(() => {
			if (trackedRootKey !== currentRoot.ownerKey) {
				trackedRootKey = currentRoot.ownerKey;
				expandedKeys = new Set([...defaults, ...ancestors]);
				return;
			}

			const next = new Set(expandedKeys);
			let changed = false;
			for (const key of [...defaults, ...ancestors]) {
				if (!next.has(key)) {
					next.add(key);
					changed = true;
				}
			}
			if (changed) {
				expandedKeys = next;
			}
		});
	});

	/**
	 * ツリー行を選択する
	 */
	function selectNode(node: CommentTreeNode): void {
		onSelect(node.ownerKey, node.title);
	}

	/**
	 * ノードの子を開閉する（ルートは閉じない）
	 */
	function toggleExpand(node: CommentTreeNode): void {
		if (node.ownerKey === root.ownerKey) {
			return;
		}
		const next = new Set(expandedKeys);
		if (next.has(node.ownerKey)) {
			next.delete(node.ownerKey);
		} else {
			next.add(node.ownerKey);
		}
		expandedKeys = next;
	}

	/**
	 * ノードの子を描画するか判定する
	 */
	function isExpanded(node: CommentTreeNode): boolean {
		return node.ownerKey === root.ownerKey || expandedKeys.has(node.ownerKey);
	}
</script>

<nav class="h-full min-h-0 overflow-auto text-sm" aria-label="コメント対象">
	<ul class="flex flex-col gap-0.5">
		{@render treeItem(root, 0)}
	</ul>
</nav>

{#snippet treeItem(node: CommentTreeNode, depth: number)}
	{@const hasChildren = node.children.length > 0}
	{@const canToggle = hasChildren && node.ownerKey !== root.ownerKey}
	{@const open = isExpanded(node)}
	<li>
		<div class="flex items-center" style="padding-left: {0.5 + depth * 0.75}rem">
			{#if canToggle}
				<button
					type="button"
					class="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
					aria-expanded={open}
					aria-label="{node.label}を{open ? '閉じる' : '開く'}"
					onclick={() => toggleExpand(node)}
				>
					{#if open}
						<AngleDownOutline size="xs" />
					{:else}
						<AngleRightOutline size="xs" />
					{/if}
				</button>
			{:else}
				<span class="inline-flex w-3 shrink-0" aria-hidden="true"></span>
			{/if}
			<button
				type="button"
				class="min-w-0 flex-1 rounded-md px-1 py-1 text-left font-mono text-xs {node.ownerKey ===
				selectedOwnerKey
					? 'bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
					: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'} {comments.has(
					node.ownerKey
				)
					? 'font-semibold'
					: ''}"
				aria-current={node.ownerKey === selectedOwnerKey ? 'true' : undefined}
				onclick={() => selectNode(node)}
			>
				{node.label}
			</button>
		</div>
		{#if hasChildren && open}
			<ul>
				{#each node.children as child (child.ownerKey)}
					{@render treeItem(child, depth + 1)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}
