<script lang="ts">
	import { Input } from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';
	import TagsInput from '$lib/components/TagsInput.svelte';
	import { DEFAULT_ITEM_DELIMITER } from '$lib/config/layout-editor-config';

	type Props = {
		component: any;
		rowIndex: number;
		itemDelimiter?: string;
	};

	let {
		component,
		rowIndex,
		itemDelimiter = DEFAULT_ITEM_DELIMITER
	}: Props = $props();

	const resolvedDelimiter = $derived(
		itemDelimiter !== '' ? itemDelimiter : DEFAULT_ITEM_DELIMITER
	);

	const ITEMS_TYPES = new Set(['radio', 'checkbox', 'dropdown', 'dropdown-multi']);
	const FORMAT_TYPES = new Set(['datepicker', 'date-span', 'timepicker', 'datetimepicker']);

	const notSupportedClass = 'text-gray-400 dark:text-gray-400';
	const fieldLabelClass = 'text-xs text-gray-500 dark:text-gray-400';

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

	const supportsItems = $derived(ITEMS_TYPES.has(component.type));
	const supportsFormat = $derived(FORMAT_TYPES.has(component.type));
	const supportsTextareaLayout = $derived(component.type === 'textarea');
	const supported = $derived(supportsItems || supportsFormat || supportsTextareaLayout);
</script>

{#if !supported}
	<span class={notSupportedClass}>- not supported -</span>
{:else}
	<div class="flex min-w-[14rem] flex-col gap-1.5">
		{#if supportsItems}
			<div>
				<p class={fieldLabelClass}>items</p>
				<span class="contents" use:arrowNavigation={{ field: 'details-items', row: rowIndex }}>
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
		{/if}

		{#if supportsFormat}
			<div>
				<p class={fieldLabelClass}>format</p>
				<span class="contents" use:arrowNavigation={{ field: 'details-format', row: rowIndex }}>
					<Input
						size="sm"
						placeholder="yyyy-MM-dd"
						aria-label="{component.type} の書式"
						bind:value={component.format}
					/>
				</span>
			</div>
		{/if}

		{#if supportsTextareaLayout}
			<div>
				<p class={fieldLabelClass}>cols</p>
				<span class="contents" use:arrowNavigation={{ field: 'details-cols', row: rowIndex }}>
					<Input
						type="text"
						size="sm"
						pattern="[1-9]\d+"
						aria-label="{component.type} の列数"
						bind:value={component.cols}
					/>
				</span>
			</div>
			<div>
				<p class={fieldLabelClass}>rows</p>
				<span class="contents" use:arrowNavigation={{ field: 'details-rows', row: rowIndex }}>
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
	</div>
{/if}
