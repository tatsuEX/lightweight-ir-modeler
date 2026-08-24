<script lang="ts">
	import YamlCommentButton from '$lib/components/YamlCommentButton.svelte';
	import { componentExternalCommentKey } from '$lib/ir/snapshot-comment-map';
	import { stringifyYamlKeyPath, type YamlPathSegment } from '$lib/ir/snapshot-comment-path';

	type Props = {
		value: unknown;
		/** uiDefinition.external か、コンポーネントの external か */
		scope: 'uiDefinition' | { componentId: string };
	};

	let { value, scope }: Props = $props();

	type TreeNode = {
		label: string;
		ownerKey: string;
		title: string;
		children: TreeNode[];
	};

	/**
	 * プレーン object かどうかを判定する
	 */
	function isPlainObject(candidate: unknown): candidate is Record<string, unknown> {
		return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate);
	}

	/**
	 * external からの相対セグメントを YAML パス / オーナキーにする
	 */
	function toKeys(segments: YamlPathSegment[]): { ownerKey: string; title: string } {
		const relative = stringifyYamlKeyPath(segments);
		if (scope === 'uiDefinition') {
			const title = `uiDefinition.${relative}`;
			return { ownerKey: title, title };
		}
		return {
			ownerKey: componentExternalCommentKey(scope.componentId, relative),
			title: `component.external → ${relative}`
		};
	}

	/**
	 * 値をコメント可能なツリーにする
	 */
	function buildTree(candidate: unknown, segments: YamlPathSegment[]): TreeNode[] {
		if (Array.isArray(candidate)) {
			return candidate.map((item, index) => {
				const next = [...segments, { type: 'index' as const, index }];
				const keys = toKeys(next);
				return {
					label: `[${index}]`,
					...keys,
					children: buildTree(item, next)
				};
			});
		}

		if (!isPlainObject(candidate)) {
			return [];
		}

		return Object.keys(candidate).map((key) => {
			const next = [...segments, { type: 'key' as const, key }];
			const keys = toKeys(next);
			return {
				label: key,
				...keys,
				children: buildTree(candidate[key], next)
			};
		});
	}

	const rootSegments: YamlPathSegment[] = [{ type: 'key', key: 'external' }];
	const rootKeys = $derived(toKeys(rootSegments));
	const nodes = $derived(buildTree(value, rootSegments));
</script>

{#if value !== undefined}
	<div class="flex flex-col gap-1 text-sm">
		<div class="flex items-center gap-2">
			<span class="font-medium text-gray-700 dark:text-gray-200">external</span>
			<YamlCommentButton
				ownerKey={rootKeys.ownerKey}
				title={rootKeys.title}
				ariaLabel="external の運用コメント"
			/>
		</div>
		{#if nodes.length > 0}
			<ul class="ml-3 border-l border-gray-200 pl-3 dark:border-gray-600">
				{#each nodes as node (node.ownerKey)}
					{@render treeItem(node)}
				{/each}
			</ul>
		{/if}
	</div>
{/if}

{#snippet treeItem(node: TreeNode)}
	<li class="py-0.5">
		<div class="flex items-center gap-2">
			<span class="font-mono text-xs text-gray-600 dark:text-gray-300">{node.label}</span>
			<YamlCommentButton ownerKey={node.ownerKey} title={node.title} ariaLabel="{node.title} の運用コメント" />
		</div>
		{#if node.children.length > 0}
			<ul class="ml-3 border-l border-gray-200 pl-3 dark:border-gray-600">
				{#each node.children as child (child.ownerKey)}
					{@render treeItem(child)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}
