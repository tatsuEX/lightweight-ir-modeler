<script lang="ts">
	import { Badge, Button } from 'flowbite-svelte';
	import { TagOutline } from 'flowbite-svelte-icons';
	import ComponentAttributeTable from '$lib/components/ComponentAttributeTable.svelte';
	import ComponentToolPalette from '$lib/components/ComponentToolPalette.svelte';
	import DefinitionImportModal from '$lib/components/DefinitionImportModal.svelte';
	import IntentTagsEditModal, {
		type IntentTagsApplyRequest
	} from '$lib/components/IntentTagsEditModal.svelte';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const uiDefinition = getUIDefinitionContext();

	let selectedCount = $state(0);
	let selectedIds = $state<Set<string>>(new Set());
	let attributeTable = $state<ComponentAttributeTable | undefined>();
	let intentTagsOpen = $state(false);

	/** 選択中のコンポーネント（表示順） */
	const selectedComponents = $derived(
		uiDefinition.components.filter((component) => selectedIds.has(component.id))
	);

	/** `{logicalId}` 付きマスタの展開に使う logicalId */
	const logicalIds = $derived(
		uiDefinition.components
			.map((component) => component.logicalId.trim())
			.filter((logicalId) => logicalId !== '')
	);

	/**
	 * 選択中の行を削除する
	 */
	function removeSelectedRows(): void {
		attributeTable?.removeSelected();
	}

	/**
	 * Intent Tags ダイアログの操作を UI 定義へ反映する
	 *
	 * WARN: 「すべて」は列フィルタや「編集可能な項目のみ」に関係なく、全コンポーネントが対象。
	 */
	function applyIntentTags(request: IntentTagsApplyRequest): number {
		const ids =
			request.scope === 'selected'
				? selectedComponents.map((component) => component.id)
				: uiDefinition.components.map((component) => component.id);
		return request.mode === 'add'
			? uiDefinition.addIntentTags(ids, request.tags)
			: uiDefinition.removeIntentTags(ids, request.tags);
	}
</script>

<main class="flex h-full min-h-0 flex-col">
	<div class="mb-4 flex shrink-0 items-start justify-between gap-4">
		<div>
			<h1 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">Property</h1>
			<p class="text-gray-600 dark:text-gray-400">
				UI コンポーネントの属性を編集する画面です。Basic / Details / Validation で列を切り替えられます。
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<DefinitionImportModal />
			<Button
				size="xs"
				color="alternative"
				disabled={uiDefinition.components.length === 0}
				onclick={() => (intentTagsOpen = true)}
			>
				<TagOutline size="xs" class="me-1" />
				Intent Tags
				{#if selectedCount > 0}
					<Badge color="indigo" class="ms-1">{selectedCount}</Badge>
				{/if}
			</Button>
			<Button size="xs" color="red" disabled={selectedCount === 0} onclick={removeSelectedRows}>
				選択行を削除
			</Button>
			<ComponentToolPalette />
		</div>
	</div>
	<div class="h-full min-h-0 flex-1">
		<ComponentAttributeTable
			bind:selectedCount
			bind:selectedIds
			bind:this={attributeTable}
			itemDelimiter={data.layoutEditor.property.itemDelimiter}
		/>
	</div>
</main>

<IntentTagsEditModal
	bind:open={intentTagsOpen}
	selectedTagSets={selectedComponents.map((component) => component.intentTags)}
	allTagSets={uiDefinition.components.map((component) => component.intentTags)}
	{logicalIds}
	onapply={applyIntentTags}
/>
