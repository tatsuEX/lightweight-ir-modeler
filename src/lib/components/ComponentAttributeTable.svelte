<script lang="ts">
	import {
		Badge,
		Button,
		ButtonGroup,
		Checkbox,
		Input,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Toggle
	} from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';
	import ComponentDetailsCell, {
		type DetailsSlot
	} from '$lib/components/ComponentDetailsCell.svelte';
	import ComponentValidationCell, {
		type ValidationSlot
	} from '$lib/components/ComponentValidationCell.svelte';
	import UiDefinitionMetaAccordion from '$lib/components/UiDefinitionMetaAccordion.svelte';
	import { DEFAULT_ITEM_DELIMITER } from '$lib/config/layout-editor-config';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';

	let {
		selectedCount = $bindable(0),
		/** items タグの区切り（`${value}${itemDelimiter}${label}`）。未指定時は DEFAULT_ITEM_DELIMITER */
		itemDelimiter = DEFAULT_ITEM_DELIMITER
	}: {
		selectedCount?: number;
		itemDelimiter?: string;
	} = $props();

	const resolvedItemDelimiter = $derived(
		itemDelimiter !== '' ? itemDelimiter : DEFAULT_ITEM_DELIMITER
	);

	/** 画面定義の状態は Context API 経由でのみ参照する */
	const uiDefinition = getUIDefinitionContext();

	/** 行選択は Property 画面内の presentation state（domain / snapshot には載せない） */
	let selectedIds = $state<Set<string>>(new Set());

	/** 属性列グループ（presentation state。IR / snapshot には載せない） */
	type ColumnGroupId = 'basic' | 'details' | 'validation';
	let columnGroup = $state<ColumnGroupId>('basic');

	const columnGroups = [
		{ id: 'basic' as const, label: 'Basic' },
		{ id: 'details' as const, label: 'Details' },
		{ id: 'validation' as const, label: 'Validation' }
	];

	/** Details 固定スロット（列位置に type 別フィールドを載せる。Validation と同方針） */
	const DETAILS_SLOTS: DetailsSlot[] = [0, 1];

	/** Validation 固定スロット */
	const VALIDATION_SLOTS: ValidationSlot[] = [0, 1, 2];

	const componentIds = $derived(uiDefinition.components.map((component) => component.id));

	const allSelected = $derived(
		componentIds.length > 0 && componentIds.every((id) => selectedIds.has(id))
	);

	const someSelected = $derived(
		componentIds.length > 0 && componentIds.some((id) => selectedIds.has(id)) && !allSelected
	);

	/** 空行の colspan（固定 4 + グループ列） */
	const totalColCount = $derived(
		columnGroup === 'basic' ? 8 : columnGroup === 'details' ? 6 : 7
	);

	// 入力行を詰めて一覧性を上げる（Flowbite 既定の px-6 py-4 は広すぎる）
	const cellClass = 'px-3 py-2';
	const notSupportedClass = 'text-gray-400 dark:text-gray-400';

	$effect(() => {
		selectedCount = selectedIds.size;
	});

	$effect(() => {
		const alive = new Set(componentIds);
		const next = new Set([...selectedIds].filter((id) => alive.has(id)));

		if (next.size !== selectedIds.size) {
			selectedIds = next;
		}
	});

	/**
	 * 行が選択されているか判定する
	 */
	function isSelected(id: string): boolean {
		return selectedIds.has(id);
	}

	/**
	 * 行の選択状態を切り替える
	 */
	function toggleSelected(id: string, checked: boolean): void {
		const next = new Set(selectedIds);

		if (checked) {
			next.add(id);
		} else {
			next.delete(id);
		}

		selectedIds = next;
	}

	/**
	 * 表示中の全行の選択状態を切り替える
	 */
	function toggleSelectAll(): void {
		if (allSelected || someSelected) {
			selectedIds = new Set();
			return;
		}

		selectedIds = new Set(componentIds);
	}

	/**
	 * 選択中の行を削除する
	 */
	export function removeSelected(): void {
		uiDefinition.removeByIds(selectedIds);
		selectedIds = new Set();
	}
</script>

<UiDefinitionMetaAccordion />

<div class="mb-3">
	<ButtonGroup>
		{#each columnGroups as group (group.id)}
			<Button
				type="button"
				color={columnGroup === group.id ? 'primary' : 'alternative'}
				outline={columnGroup !== group.id}
				onclick={() => {
					columnGroup = group.id;
				}}
			>
				{group.label}
			</Button>
		{/each}
	</ButtonGroup>
</div>

<div class="overflow-x-auto">
	<Table hoverable shadow data-arrow-nav-root>
		<TableHead>
			<TableHeadCell class="{cellClass} w-12">
				<Checkbox
					class="h-6 w-6 focus:ring-0"
					checked={allSelected}
					aria-label="すべて選択"
					onclick={toggleSelectAll}
				/>
			</TableHeadCell>
			<TableHeadCell class="{cellClass} w-56">id</TableHeadCell>
			<TableHeadCell class="{cellClass} w-28">type</TableHeadCell>
			<TableHeadCell class={cellClass}>label</TableHeadCell>
			{#if columnGroup === 'basic'}
				<TableHeadCell class={cellClass}>hint</TableHeadCell>
				<TableHeadCell class="{cellClass} w-4">required</TableHeadCell>
				<TableHeadCell class="{cellClass} w-4">readonly</TableHeadCell>
				<TableHeadCell class="{cellClass} w-4">disabled</TableHeadCell>
			{:else if columnGroup === 'details'}
				<TableHeadCell class={cellClass} colspan={DETAILS_SLOTS.length}>Details</TableHeadCell>
			{:else}
				<TableHeadCell class={cellClass} colspan={VALIDATION_SLOTS.length}>Validation</TableHeadCell>
			{/if}
		</TableHead>
		<TableBody>
			{#if uiDefinition.components.length === 0}
				<TableBodyRow>
					<TableBodyCell
						colspan={totalColCount}
						class="{cellClass} text-center text-gray-500 dark:text-gray-400"
					>
						コンポーネントがありません。ツールパレットから追加してください。
					</TableBodyCell>
				</TableBodyRow>
			{:else}
				<!-- WARN: key は編集対象の logicalId ではなく内部 id。key を変えると入力中に再マウントされフォーカスが飛ぶ。 -->
				{#each uiDefinition.components as component, rowIndex (component.id)}
					<TableBodyRow>
						<TableBodyCell class={cellClass}>
							<span class="contents" use:arrowNavigation={{ field: 'selected', row: rowIndex }}>
								<Checkbox
									class="h-6 w-6"
									checked={isSelected(component.id)}
									aria-label="{component.type} の選択"
									onchange={(event) =>
										toggleSelected(component.id, event.currentTarget.checked)}
								/>
							</span>
						</TableBodyCell>
						<TableBodyCell class={cellClass}>
							<span class="contents" use:arrowNavigation={{ field: 'logicalId', row: rowIndex }}>
								<Input
									size="sm"
									placeholder="ID"
									aria-label="{component.type} のID"
									bind:value={component.logicalId}
								/>
							</span>
						</TableBodyCell>
						<TableBodyCell class={cellClass}>
							<Badge color="gray">{component.type}</Badge>
						</TableBodyCell>
						<TableBodyCell class={cellClass}>
							<span class="contents" use:arrowNavigation={{ field: 'label', row: rowIndex }}>
								<Input
									size="sm"
									placeholder="表示ラベル"
									aria-label="{component.type} のラベル"
									bind:value={component.label}
								/>
							</span>
						</TableBodyCell>

						{#if columnGroup === 'basic'}
							<TableBodyCell class={cellClass}>
								{#if component.hint !== undefined}
									<span class="contents" use:arrowNavigation={{ field: 'hint', row: rowIndex }}>
										<Input
											size="sm"
											placeholder="補足説明"
											aria-label="{component.type} のヒント"
											bind:value={component.hint}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
							<TableBodyCell class={cellClass}>
								{#if component.validation?.required !== undefined}
									<span
										class="contents"
										use:arrowNavigation={{ field: 'validation-required', row: rowIndex }}
									>
										<Toggle
											aria-label="{component.type} の必須指定"
											bind:checked={component.validation.required}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
							<TableBodyCell class={cellClass}>
								{#if component.readonly !== undefined}
									<span class="contents" use:arrowNavigation={{ field: 'readonly', row: rowIndex }}>
										<Toggle
											aria-label="{component.type} の読み取り専用指定"
											bind:checked={component.readonly}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
							<TableBodyCell class={cellClass}>
								{#if component.disabled !== undefined}
									<span class="contents" use:arrowNavigation={{ field: 'disabled', row: rowIndex }}>
										<Toggle
											aria-label="{component.type} の無効化指定"
											bind:checked={component.disabled}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
						{:else if columnGroup === 'details'}
							{#each DETAILS_SLOTS as detailsSlot (detailsSlot)}
								<TableBodyCell class={cellClass}>
									<ComponentDetailsCell
										{component}
										{rowIndex}
										slotId={detailsSlot}
										itemDelimiter={resolvedItemDelimiter}
									/>
								</TableBodyCell>
							{/each}
						{:else}
							{#each VALIDATION_SLOTS as validationSlot (validationSlot)}
								<TableBodyCell class={cellClass}>
									<ComponentValidationCell
										{component}
										{rowIndex}
										slotId={validationSlot}
									/>
								</TableBodyCell>
							{/each}
						{/if}
					</TableBodyRow>
				{/each}
			{/if}
		</TableBody>
	</Table>
</div>
