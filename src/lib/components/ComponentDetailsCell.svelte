<script lang="ts">
	import { Checkbox, Datepicker, Input, Radio, Textarea, Timepicker, Tooltip } from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';
	import TagsInput from '$lib/components/TagsInput.svelte';
	import { DEFAULT_ITEM_DELIMITER } from '$lib/config/layout-editor-config';
	import {
		isSelectEditorComponent,
		toSelectItems,
		type EditorComponent,
		type SelectItem
	} from '$lib/ir/elements/component-schema';
	import {
		closeDatepickerOnFocusOut,
		formatDateString,
		normalizeTimeString,
		parseDateString,
		parseDateTimeParts,
		parseOptionalNumber
	} from '$lib/utils/date-time-ir';

	/** Details 固定スロット（Validation と同様、列位置に type 別フィールドを載せる） */
	export type DetailsSlot = 0 | 1 | 2;

	type Props = {
		component: EditorComponent;
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

	const notSupportedClass = 'text-gray-300 dark:text-gray-700';
	const fieldLabelClass = 'text-xs text-gray-500 dark:text-gray-400';

	const FIELD_GROUP = 'details';

	/**
	 * IR items を TagsInput 用の string[] へ変換する
	 *
	 * WARN: label と value が異なるときだけ `${value}${delimiter}${label}` 形式にする。
	 */
	function itemsToTags(items: ReadonlyArray<string | SelectItem>, delimiter: string): string[] {
		const tags: string[] = [];
		for (const entry of toSelectItems(items)) {
			if (!entry.label && !entry.value) {
				continue;
			}
			if (entry.label === entry.value || !entry.value || !entry.label) {
				tags.push(entry.label || entry.value);
			} else {
				tags.push(`${entry.value}${delimiter}${entry.label}`);
			}
		}
		return tags;
	}

	/**
	 * TagsInput の string[] を IR items（{ label, value }[]）へ変換する
	 *
	 * WARN: 区切りは先頭一致のみ（value / label 自体に delimiter を含めない前提）。
	 */
	function tagsToItems(tags: string[], delimiter: string): SelectItem[] {
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

	/**
	 * multiSelect の defaultValue（string[]）に値が含まれるか判定する
	 */
	function isMultiSelected(itemValue: string): boolean {
		if (component.type !== 'checkbox' && component.type !== 'dropdown-multi') {
			return false;
		}
		return component.defaultValue.includes(itemValue);
	}

	/**
	 * multiSelect の defaultValue（string[]）を更新する
	 */
	function toggleMultiValue(itemValue: string, checked: boolean): void {
		if (component.type !== 'checkbox' && component.type !== 'dropdown-multi') {
			return;
		}
		const current = [...component.defaultValue];
		if (checked) {
			if (!current.includes(itemValue)) {
				current.push(itemValue);
			}
			component.defaultValue = current;
			return;
		}
		component.defaultValue = current.filter((value) => value !== itemValue);
	}

	/**
	 * datetime 初期値の日付部分を更新する
	 */
	function setDefaultDateTimeDate(date: Date | undefined): void {
		if (component.type !== 'datetimepicker') {
			return;
		}
		if (!date) {
			component.defaultValue = null;
			return;
		}
		const prev = parseDateTimeParts(component.defaultValue);
		const dateStr = formatDateString(date);
		if (!dateStr) {
			component.defaultValue = null;
			return;
		}
		component.defaultValue = `${dateStr} ${prev.time ?? '00:00'}`;
	}

	/**
	 * datetime 初期値の時刻部分を更新する
	 *
	 * WARN: 日付未設定のときは IR に書かない（日付が SSOT の先頭）。
	 */
	function setDefaultDateTimeTime(time: string): void {
		if (component.type !== 'datetimepicker') {
			return;
		}
		const prev = parseDateTimeParts(component.defaultValue);
		const dateStr = formatDateString(prev.date);
		if (!dateStr) {
			return;
		}
		component.defaultValue = `${dateStr} ${normalizeTimeString(time) ?? '00:00'}`;
	}

	const fieldName = $derived(`details-${slotId}`);
	const timeFieldName = $derived(`${fieldName}-time`);
	const dateSpanToFieldName = $derived(`${fieldName}-to`);

	const showDefaultValue = $derived(slotId === 0 && component.type !== 'unsupported');
	const showItems = $derived(slotId === 1 && isSelectEditorComponent(component));
	const showFormat = $derived(
		slotId === 1 &&
			(component.type === 'datepicker' ||
				component.type === 'date-span' ||
				component.type === 'timepicker' ||
				component.type === 'datetimepicker')
	);
	const showCols = $derived(slotId === 1 && component.type === 'textarea');
	const showRows = $derived(slotId === 2 && component.type === 'textarea');
	const supported = $derived(showDefaultValue || showItems || showFormat || showCols || showRows);
	const selectItems = $derived(isSelectEditorComponent(component) ? toSelectItems(component.items) : []);
</script>

{#if !supported}
	<span class={notSupportedClass}>- not supported -</span>
{:else if showDefaultValue && component.type === 'textbox'}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				size="sm"
				placeholder="初期値"
				aria-label="{component.type} のデフォルト値"
				bind:value={component.defaultValue}
			/>
		</span>
	</div>
{:else if showDefaultValue && component.type === 'number'}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				placeholder="初期値"
				pattern="-?[0-9]+(\.[0-9]+)?"
				aria-label="{component.type} のデフォルト値"
				bind:value={
					() => component.defaultValue ?? '',
					(value) => {
						if (component.type === 'number') {
							component.defaultValue = parseOptionalNumber(value) ?? null;
						}
					}
				}
			/>
		</span>
	</div>
{:else if showDefaultValue && (component.type === 'textarea' || component.type === 'label')}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Textarea
				placeholder="初期値"
				aria-label="{component.type} のデフォルト値"
				class="w-full"
				rows={3}
				bind:value={component.defaultValue}
			/>
			<Tooltip>
				{component.defaultValue}
			</Tooltip>
		</span>
	</div>
{:else if showDefaultValue && component.type === 'datepicker'}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div onfocusout={closeDatepickerOnFocusOut}>
			<span
				class="contents"
				use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
			>
				<Datepicker
					placeholder="初期値"
					inputClass="text-sm"
					showActionButtons
					aria-label="{component.type} のデフォルト値"
					bind:value={
						() => parseDateString(component.defaultValue),
						(date) => {
							if (component.type === 'datepicker') {
								component.defaultValue = formatDateString(date) ?? null;
							}
						}
					}
					onclear={() => {
						if (component.type === 'datepicker') {
							component.defaultValue = null;
						}
					}}
				/>
			</span>
		</div>
	</div>
{:else if showDefaultValue && component.type === 'date-span'}
	<div class="flex flex-col gap-2">
		<div>
			<p class={fieldLabelClass}>defaultValueFrom</p>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div onfocusout={closeDatepickerOnFocusOut}>
				<span
					class="contents"
					use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
				>
					<Datepicker
						placeholder="開始日"
						inputClass="text-sm"
						showActionButtons
						aria-label="{component.type} の開始日初期値"
						bind:value={
							() => parseDateString(component.defaultValueFrom),
							(date) => {
								if (component.type === 'date-span') {
									component.defaultValueFrom = formatDateString(date) ?? null;
								}
							}
						}
						onclear={() => {
							if (component.type === 'date-span') {
								component.defaultValueFrom = null;
							}
						}}
					/>
				</span>
			</div>
		</div>
		<div>
			<p class={fieldLabelClass}>defaultValueTo</p>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div onfocusout={closeDatepickerOnFocusOut}>
				<span
					class="contents"
					use:arrowNavigation={{
						field: dateSpanToFieldName,
						row: rowIndex,
						fieldGroup: FIELD_GROUP
					}}
				>
					<Datepicker
						placeholder="終了日"
						inputClass="text-sm"
						showActionButtons
						aria-label="{component.type} の終了日初期値"
						bind:value={
							() => parseDateString(component.defaultValueTo),
							(date) => {
								if (component.type === 'date-span') {
									component.defaultValueTo = formatDateString(date) ?? null;
								}
							}
						}
						onclear={() => {
							if (component.type === 'date-span') {
								component.defaultValueTo = null;
							}
						}}
					/>
				</span>
			</div>
		</div>
	</div>
{:else if showDefaultValue && component.type === 'timepicker'}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Timepicker
				id="default-time-{component.id}"
				size="sm"
				required={false}
				aria-label="{component.type} のデフォルト値"
				bind:value={
					() => normalizeTimeString(component.defaultValue) ?? '',
					(time) => {
						if (component.type === 'timepicker') {
							component.defaultValue = normalizeTimeString(time) ?? null;
						}
					}
				}
			/>
		</span>
	</div>
{:else if showDefaultValue && component.type === 'datetimepicker'}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		<div class="flex items-start gap-2">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="min-w-0 flex-1" onfocusout={closeDatepickerOnFocusOut}>
				<span
					class="contents"
					use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
				>
					<Datepicker
						placeholder="date"
						inputClass="text-sm"
						showActionButtons
						aria-label="{component.type} の日付初期値"
						bind:value={
							() => parseDateTimeParts(component.defaultValue).date,
							(date) => {
								setDefaultDateTimeDate(date);
							}
						}
						onclear={() => {
							if (component.type === 'datetimepicker') {
								component.defaultValue = null;
							}
						}}
					/>
				</span>
			</div>
			<span
				class="contents w-28 shrink-0"
				use:arrowNavigation={{ field: timeFieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
			>
				<Timepicker
					id="default-datetime-time-{component.id}"
					size="sm"
					required={false}
					aria-label="{component.type} の時刻初期値"
					bind:value={
						() => parseDateTimeParts(component.defaultValue).time ?? '',
						(time) => {
							setDefaultDateTimeTime(time);
						}
					}
				/>
			</span>
		</div>
	</div>
{:else if showDefaultValue && (component.type === 'radio' || component.type === 'dropdown')}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		{#if selectItems.length > 0}
			<span
				class="contents"
				use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
			>
				{#each selectItems as item (item.value)}
					<Radio
						aria-label="{component.type} のデフォルト値: {item.label}"
						value={item.value}
						bind:group={component.defaultValue}
						onclick={() => {
							if (
								(component.type === 'radio' || component.type === 'dropdown') &&
								component.defaultValue === item.value
							) {
								component.defaultValue = '';
							}
						}}
					>
						{item.label}
					</Radio>
				{/each}
			</span>
		{:else}
			<span class={notSupportedClass}>- no items -</span>
		{/if}
	</div>
{:else if showDefaultValue && (component.type === 'checkbox' || component.type === 'dropdown-multi')}
	<div>
		<p class={fieldLabelClass}>defaultValue</p>
		{#if selectItems.length > 0}
			<span
				class="contents"
				use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
			>
				{#each selectItems as item (item.value)}
					<Checkbox
						aria-label="{component.type} のデフォルト値: {item.label}"
						checked={isMultiSelected(item.value)}
						onchange={(e: Event) => {
							if (e.target instanceof HTMLInputElement) {
								toggleMultiValue(item.value, e.target.checked);
							}
						}}
					>
						{item.label}
					</Checkbox>
				{/each}
			</span>
		{:else}
			<span class={notSupportedClass}>- no items -</span>
		{/if}
	</div>
{:else if showDefaultValue}
	<span class={notSupportedClass}>- not supported -</span>
{:else if showItems && isSelectEditorComponent(component)}
	<div class="w-full">
		<p class={fieldLabelClass}>items</p>
		<div
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<TagsInput
				size="sm"
				placeholder="value または value{resolvedDelimiter}label (or paste CSV/TSV)"
				aria-label="{component.type} の選択肢"
				class="w-full"
				bind:value={
					() => itemsToTags(component.items, resolvedDelimiter),
					(tags) => {
						if (isSelectEditorComponent(component)) {
							component.items = tagsToItems(tags, resolvedDelimiter);
						}
					}
				}
			/>
		</div>
	</div>
{:else if showFormat && (component.type === 'datepicker' || component.type === 'date-span' || component.type === 'timepicker' || component.type === 'datetimepicker')}
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
{:else if showCols && component.type === 'textarea'}
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
				bind:value={
					() => component.cols,
					(value) => {
						if (component.type === 'textarea') {
							component.cols = parseOptionalNumber(value) ?? 30;
						}
					}
				}
			/>
		</span>
	</div>
{:else if showRows && component.type === 'textarea'}
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
				bind:value={
					() => component.rows,
					(value) => {
						if (component.type === 'textarea') {
							component.rows = parseOptionalNumber(value) ?? 3;
						}
					}
				}
			/>
		</span>
	</div>
{/if}
