<script lang="ts">
	import { Datepicker, Input, Timepicker, Toggle } from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';
	import type { EditorComponent } from '$lib/ir/elements/component-schema';
	import {
		closeDatepickerOnFocusOut,
		formatDateString,
		normalizeTimeString,
		parseDateString,
		parseDateTimeParts,
		parseOptionalNumber
	} from '$lib/utils/date-time-ir';

	/** Validation 固定スロット（0..3） */
	export type ValidationSlot = 0 | 1 | 2 | 3;

	type Props = {
		component: EditorComponent;
		rowIndex: number;
		/** 固定スロット index（HTML slot とは別） */
		slotId: ValidationSlot;
	};

	let { component, rowIndex, slotId }: Props = $props();

	const notSupportedClass = 'text-gray-300 dark:text-gray-700';
	const fieldLabelClass = 'text-xs text-gray-500 dark:text-gray-400';
	const FIELD_GROUP = 'validation';

	/**
	 * minDateTime / maxDateTime の日付部分を更新する
	 */
	function setDateTimeDate(key: 'minDateTime' | 'maxDateTime', date: Date | undefined): void {
		if (component.type !== 'datetimepicker') {
			return;
		}
		if (!date) {
			component.validation[key] = undefined;
			return;
		}
		const prev = parseDateTimeParts(component.validation[key]);
		const dateStr = formatDateString(date);
		if (!dateStr) {
			component.validation[key] = undefined;
			return;
		}
		component.validation[key] = `${dateStr} ${prev.time ?? '00:00'}`;
	}

	/**
	 * minDateTime / maxDateTime の時刻部分を更新する
	 *
	 * WARN: 日付未設定のときは IR に書かない（日付が SSOT の先頭）。
	 */
	function setDateTimeTime(key: 'minDateTime' | 'maxDateTime', time: string): void {
		if (component.type !== 'datetimepicker') {
			return;
		}
		const prev = parseDateTimeParts(component.validation[key]);
		const dateStr = formatDateString(prev.date);
		if (!dateStr) {
			return;
		}
		component.validation[key] = `${dateStr} ${normalizeTimeString(time) ?? '00:00'}`;
	}

	const fieldName = $derived(`validation-${slotId}`);
	const timeFieldName = $derived(`${fieldName}-time`);

	const showTextboxPattern = $derived(slotId === 0 && component.type === 'textbox');
	const showTextboxMinlength = $derived(slotId === 1 && component.type === 'textbox');
	const showTextboxMaxlength = $derived(slotId === 2 && component.type === 'textbox');
	const showTextareaMinlength = $derived(slotId === 1 && component.type === 'textarea');
	const showTextareaMaxlength = $derived(slotId === 0 && component.type === 'textarea');
	const showNumberMin = $derived(slotId === 0 && component.type === 'number');
	const showNumberMax = $derived(slotId === 1 && component.type === 'number');
	const showNumberScale = $derived(slotId === 2 && component.type === 'number');
	const showNumberStep = $derived(slotId === 3 && component.type === 'number');
	const showDateSpanRequiredFrom = $derived(slotId === 2 && component.type === 'date-span');
	const showDateSpanRequiredTo = $derived(slotId === 3 && component.type === 'date-span');
	const showDateMin = $derived(
		slotId === 0 && (component.type === 'datepicker' || component.type === 'date-span')
	);
	const showDateMax = $derived(
		slotId === 1 && (component.type === 'datepicker' || component.type === 'date-span')
	);
	const showTimeMin = $derived(slotId === 0 && component.type === 'timepicker');
	const showTimeMax = $derived(slotId === 1 && component.type === 'timepicker');
	const showDateTimeMin = $derived(slotId === 0 && component.type === 'datetimepicker');
	const showDateTimeMax = $derived(slotId === 1 && component.type === 'datetimepicker');

	const supported = $derived(
		showTextboxPattern ||
			showTextboxMinlength ||
			showTextboxMaxlength ||
			showTextareaMinlength ||
			showTextareaMaxlength ||
			showNumberMin ||
			showNumberMax ||
			showNumberScale ||
			showNumberStep ||
			showDateSpanRequiredFrom ||
			showDateSpanRequiredTo ||
			showDateMin ||
			showDateMax ||
			showTimeMin ||
			showTimeMax ||
			showDateTimeMin ||
			showDateTimeMax
	);
</script>

{#if !supported}
	<span class={notSupportedClass}>- not supported -</span>
{:else if showTextboxPattern && component.type === 'textbox'}
	<div>
		<p class={fieldLabelClass}>pattern</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				size="sm"
				placeholder="正規表現"
				aria-label="{component.type} の pattern"
				bind:value={component.validation.pattern}
			/>
		</span>
	</div>
{:else if showTextboxMinlength && component.type === 'textbox'}
	<div>
		<p class={fieldLabelClass}>minlength</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="(0|[1-9]\d+)"
				aria-label="{component.type} の minlength"
				bind:value={component.validation.minlength}
			/>
		</span>
	</div>
{:else if showTextareaMinlength && component.type === 'textarea'}
	<div>
		<p class={fieldLabelClass}>minlength</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="(0|[1-9]\d+)"
				aria-label="{component.type} の minlength"
				bind:value={component.validation.minlength}
			/>
		</span>
	</div>
{:else if (showTextboxMaxlength || showTextareaMaxlength) && (component.type === 'textbox' || component.type === 'textarea')}
	<div>
		<p class={fieldLabelClass}>maxlength</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="[1-9]\d+"
				aria-label="{component.type} の maxlength"
				bind:value={component.validation.maxlength}
			/>
		</span>
	</div>
{:else if showNumberMin && component.type === 'number'}
	<div>
		<p class={fieldLabelClass}>min</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="[-]?[0-9]+(\.[0-9]+)?"
				aria-label="{component.type} の最小値"
				bind:value={
					() => component.validation.min ?? '',
					(value) => {
						if (component.type === 'number') {
							component.validation.min = parseOptionalNumber(value);
						}
					}
				}
			/>
		</span>
	</div>
{:else if showNumberMax && component.type === 'number'}
	<div>
		<p class={fieldLabelClass}>max</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="[-]?[0-9]+(\.[0-9]+)?"
				aria-label="{component.type} の最大値"
				bind:value={
					() => component.validation.max ?? '',
					(value) => {
						if (component.type === 'number') {
							component.validation.max = parseOptionalNumber(value);
						}
					}
				}
			/>
		</span>
	</div>
{:else if showNumberScale && component.type === 'number'}
	<div>
		<p class={fieldLabelClass}>scale</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="[0-9]+"
				aria-label="{component.type} の小数点以下の桁数"
				bind:value={
					() => component.validation.scale,
					(value) => {
						if (component.type === 'number') {
							component.validation.scale = parseOptionalNumber(value) ?? 0;
						}
					}
				}
			/>
		</span>
	</div>
{:else if showNumberStep && component.type === 'number'}
	<div>
		<p class={fieldLabelClass}>step</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="text"
				size="sm"
				pattern="[0-9]+(\.[0-9]+)?"
				aria-label="{component.type} の step"
				bind:value={
					() => component.validation.step,
					(value) => {
						if (component.type === 'number') {
							component.validation.step = parseOptionalNumber(value) ?? 1;
						}
					}
				}
			/>
		</span>
	</div>
{:else if showDateSpanRequiredFrom && component.type === 'date-span'}
	<div>
		<p class={fieldLabelClass}>requiredFrom</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Toggle
				aria-label="{component.type} の開始日必須"
				bind:checked={component.validation.requiredFrom}
			/>
		</span>
	</div>
{:else if showDateSpanRequiredTo && component.type === 'date-span'}
	<div>
		<p class={fieldLabelClass}>requiredTo</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Toggle
				aria-label="{component.type} の終了日必須"
				bind:checked={component.validation.requiredTo}
			/>
		</span>
	</div>
{:else if showDateMin && (component.type === 'datepicker' || component.type === 'date-span')}
	<div>
		<p class={fieldLabelClass}>minDate</p>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div onfocusout={closeDatepickerOnFocusOut}>
			<span
				class="contents"
				use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
			>
				<Datepicker
					placeholder="minDate"
					inputClass="text-sm"
					showActionButtons
					bind:value={
						() => parseDateString(component.validation.minDate),
						(date) => {
							if (component.type === 'datepicker' || component.type === 'date-span') {
								component.validation.minDate = formatDateString(date);
							}
						}
					}
					onclear={() => {
						if (component.type === 'datepicker' || component.type === 'date-span') {
							component.validation.minDate = undefined;
						}
					}}
				/>
			</span>
		</div>
	</div>
{:else if showDateMax && (component.type === 'datepicker' || component.type === 'date-span')}
	<div>
		<p class={fieldLabelClass}>maxDate</p>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div onfocusout={closeDatepickerOnFocusOut}>
			<span
				class="contents"
				use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
			>
				<Datepicker
					placeholder="maxDate"
					inputClass="text-sm"
					showActionButtons
					bind:value={
						() => parseDateString(component.validation.maxDate),
						(date) => {
							if (component.type === 'datepicker' || component.type === 'date-span') {
								component.validation.maxDate = formatDateString(date);
							}
						}
					}
					onclear={() => {
						if (component.type === 'datepicker' || component.type === 'date-span') {
							component.validation.maxDate = undefined;
						}
					}}
				/>
			</span>
		</div>
	</div>
{:else if showTimeMin && component.type === 'timepicker'}
	<div>
		<p class={fieldLabelClass}>minTime</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Timepicker
				id="min-time-{component.id}"
				size="sm"
				required={false}
				bind:value={
					() => normalizeTimeString(component.validation.minTime) ?? '',
					(time) => {
						if (component.type === 'timepicker') {
							component.validation.minTime = normalizeTimeString(time);
						}
					}
				}
			/>
		</span>
	</div>
{:else if showTimeMax && component.type === 'timepicker'}
	<div>
		<p class={fieldLabelClass}>maxTime</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Timepicker
				id="max-time-{component.id}"
				size="sm"
				required={false}
				bind:value={
					() => normalizeTimeString(component.validation.maxTime) ?? '',
					(time) => {
						if (component.type === 'timepicker') {
							component.validation.maxTime = normalizeTimeString(time);
						}
					}
				}
			/>
		</span>
	</div>
{:else if showDateTimeMin && component.type === 'datetimepicker'}
	<div>
		<p class={fieldLabelClass}>minDateTime</p>
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
						bind:value={
							() => parseDateTimeParts(component.validation.minDateTime).date,
							(date) => {
								setDateTimeDate('minDateTime', date);
							}
						}
						onclear={() => {
							if (component.type === 'datetimepicker') {
								component.validation.minDateTime = undefined;
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
					id="min-datetime-time-{component.id}"
					size="sm"
					required={false}
					bind:value={
						() => parseDateTimeParts(component.validation.minDateTime).time ?? '',
						(time) => {
							setDateTimeTime('minDateTime', time);
						}
					}
				/>
			</span>
		</div>
	</div>
{:else if showDateTimeMax && component.type === 'datetimepicker'}
	<div>
		<p class={fieldLabelClass}>maxDateTime</p>
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
						bind:value={
							() => parseDateTimeParts(component.validation.maxDateTime).date,
							(date) => {
								setDateTimeDate('maxDateTime', date);
							}
						}
						onclear={() => {
							if (component.type === 'datetimepicker') {
								component.validation.maxDateTime = undefined;
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
					id="max-datetime-time-{component.id}"
					size="sm"
					required={false}
					bind:value={
						() => parseDateTimeParts(component.validation.maxDateTime).time ?? '',
						(time) => {
							setDateTimeTime('maxDateTime', time);
						}
					}
				/>
			</span>
		</div>
	</div>
{/if}
