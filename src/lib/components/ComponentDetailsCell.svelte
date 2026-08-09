<script lang="ts">
	import { Input } from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';
	import TagsInput from '$lib/components/TagsInput.svelte';
	import { DEFAULT_ITEM_DELIMITER } from '$lib/config/layout-editor-config';

	/** Details 固定スロット（Validation と同様、列位置に type 別フィールドを載せる） */
	export type DetailsSlot = 0 | 1;

	type Props = {
		component: any;
		rowIndex: number;
		/** 固定スロット index（HTML slot とは別） */
		slotId: DetailsSlot;
		itemDelimiter?: string;
	};

	let {
		component,
		rowIndex,
		slotId,
		itemDelimiter = DEFAULT_ITEM_DELIMITER
	}: Props = $props();

	const resolvedDelimiter = $derived(
		itemDelimiter !== '' ? itemDelimiter : DEFAULT_ITEM_DELIMITER
	);

	const ITEMS_TYPES = new Set(['radio', 'checkbox', 'dropdown', 'dropdown-multi']);
	const FORMAT_TYPES = new Set(['datepicker', 'date-span', 'timepicker', 'datetimepicker']);

	const notSupportedClass = 'text-gray-400 dark:text-gray-400';
	const fieldLabelClass = 'text-xs text-gray-500 dark:text-gray-400';

	const FIELD_GROUP = 'details';

	/**
	 * IR items を TagsInput 用の string[] へ変換する
	 *
	 * WARN: label と value が異なるときだけ `${value}${delimiter}${label}` 形式にする。
	 */
	function itemsToTags(items: unknown, delimiter: string): string[] {
		if (!Array.isArray(items)) {
			return [];
		}

		const tags: string[] = [];
		for (const entry of items) {
			if (typeof entry === 'string') {
				if (entry) {
					tags.push(entry);
				}
				continue;
			}
			if (entry && typeof entry === 'object') {
				const label = String((entry as { label?: unknown }).label ?? '');
				const value = String((entry as { value?: unknown }).value ?? '');
				if (!label && !value) {
					continue;
				}
				if (label === value || !value || !label) {
					tags.push(label || value);
				} else {
					tags.push(`${value}${delimiter}${label}`);
				}
			}
		}
		return tags;
	}

	/**
	 * TagsInput の string[] を IR items（{ label, value }[]）へ変換する
	 *
	 * WARN: 区切りは先頭一致のみ（value / label 自体に delimiter を含めない前提）。
	 */
	function tagsToItems(tags: string[], delimiter: string): { label: string; value: string }[] {
		return tags.map((tag) => {
			const sep = tag.indexOf(delimiter);
			if (sep === -1) {
				return { label: tag, value: tag };
			}
			const value = tag.slice(0, sep);
			const label = tag.slice(sep + delimiter.length);
			return {
				label: label !== '' ? label : value,
				value: value !== '' ? value : label
			};
		});
	}

	const fieldName = $derived(`details-${slotId}`);

	// 列位置に混ぜる: 0 = items | format | cols、1 = rows
	const showItems = $derived(slotId === 0 && ITEMS_TYPES.has(component.type));
	const showFormat = $derived(slotId === 0 && FORMAT_TYPES.has(component.type));
	const showCols = $derived(slotId === 0 && component.type === 'textarea');
	const showRows = $derived(slotId === 1 && component.type === 'textarea');
	const supported = $derived(showItems || showFormat || showCols || showRows);
</script>

{#if !supported}
	<span class={notSupportedClass}>- not supported -</span>
{:else if showItems}
	<div>
		<p class={fieldLabelClass}>items</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<TagsInput
				size="sm"
				placeholder="value または value{resolvedDelimiter}label"
				aria-label="{component.type} の選択肢"
				bind:value={
					() => itemsToTags(component.items, resolvedDelimiter),
					(tags) => {
						component.items = tagsToItems(tags, resolvedDelimiter);
					}
				}
			/>
		</span>
	</div>
{:else if showFormat}
	<div>
		<p class={fieldLabelClass}>format</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				size="sm"
				placeholder="yyyy-MM-dd"
				aria-label="{component.type} の書式"
				bind:value={component.format}
			/>
		</span>
	</div>
{:else if showCols}
	<div>
		<p class={fieldLabelClass}>cols</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="[1-9]\d+"
				aria-label="{component.type} の列数"
				bind:value={component.cols}
			/>
		</span>
	</div>
{:else if showRows}
	<div>
		<p class={fieldLabelClass}>rows</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="[1-9]\d+"
				aria-label="{component.type} の行数"
				bind:value={component.rows}
			/>
		</span>
	</div>
{/if}
