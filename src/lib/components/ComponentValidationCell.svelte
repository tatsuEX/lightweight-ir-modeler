<script lang="ts">
	import { Datepicker, Input, Timepicker } from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';

	/** Validation 固定スロット（0..2） */
	export type ValidationSlot = 0 | 1 | 2;

	type Props = {
		component: any;
		rowIndex: number;
		/** 固定スロット index（HTML slot とは別） */
		slotId: ValidationSlot;
	};

	let { component, rowIndex, slotId }: Props = $props();

	const DATE_BOUNDS_TYPES = new Set(['datepicker', 'date-span']);
	const TIME_BOUNDS_TYPES = new Set(['timepicker']);
	const DATETIME_BOUNDS_TYPES = new Set(['datetimepicker']);

	const notSupportedClass = 'text-gray-400 dark:text-gray-400';
	const fieldLabelClass = 'text-xs text-gray-500 dark:text-gray-400';
	const FIELD_GROUP = 'validation';

	const isTextbox = $derived(component.type === 'textbox');
	const isTextarea = $derived(component.type === 'textarea');
	const isNumber = $derived(component.type === 'number');
	const hasDateBounds = $derived(DATE_BOUNDS_TYPES.has(component.type));
	const hasTimeBounds = $derived(TIME_BOUNDS_TYPES.has(component.type));
	const hasDateTimeBounds = $derived(DATETIME_BOUNDS_TYPES.has(component.type));

	/**
	 * yyyy-MM-dd 文字列を Date に変換する（不正・空は undefined）
	 */
	function parseDateString(value: unknown): Date | undefined {
		if (typeof value !== 'string' || value === '') {
			return undefined;
		}
		const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
		if (!matched) {
			return undefined;
		}
		return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
	}

	/**
	 * Date を yyyy-MM-dd 文字列へ変換する（未設定は undefined）
	 */
	function formatDateString(value: Date | undefined): string | undefined {
		if (!value || Number.isNaN(value.getTime())) {
			return undefined;
		}
		const year = value.getFullYear();
		const month = String(value.getMonth() + 1).padStart(2, '0');
		const day = String(value.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/**
	 * HH:mm 文字列を正規化する（空は undefined）
	 */
	function normalizeTimeString(value: unknown): string | undefined {
		if (typeof value !== 'string' || value === '') {
			return undefined;
		}
		const matched = /^(\d{2}):(\d{2})/.exec(value);
		return matched ? `${matched[1]}:${matched[2]}` : undefined;
	}

	/**
	 * IR の日時文字列を datetime-local 用へ変換する
	 */
	function toDatetimeLocalValue(value: unknown): string {
		if (typeof value !== 'string' || value === '') {
			return '';
		}
		return value.replace(' ', 'T').slice(0, 16);
	}

	/**
	 * datetime-local 値を IR の yyyy-MM-dd HH:mm へ変換する
	 */
	function fromDatetimeLocalValue(value: string): string | undefined {
		if (!value) {
			return undefined;
		}
		return value.replace('T', ' ').slice(0, 16);
	}

	/**
	 * number 用: 空入力を undefined に戻す
	 */
	function parseOptionalNumber(value: number | string | null | undefined): number | undefined {
		if (value === '' || value === null || value === undefined) {
			return undefined;
		}
		const parsed = typeof value === 'number' ? value : Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	const fieldName = $derived(`validation-${slotId}`);

	const showTextboxPattern = $derived(slotId === 0 && isTextbox);
	const showTextboxMinlength = $derived(slotId === 1 && isTextbox);
	const showTextboxMaxlength = $derived(slotId === 2 && isTextbox);
	const showTextareaMaxlength = $derived(slotId === 0 && isTextarea);
	const showNumberMin = $derived(slotId === 0 && isNumber);
	const showNumberMax = $derived(slotId === 1 && isNumber);
	const showDateMin = $derived(slotId === 0 && hasDateBounds);
	const showDateMax = $derived(slotId === 1 && hasDateBounds);
	const showTimeMin = $derived(slotId === 0 && hasTimeBounds);
	const showTimeMax = $derived(slotId === 1 && hasTimeBounds);
	const showDateTimeMin = $derived(slotId === 0 && hasDateTimeBounds);
	const showDateTimeMax = $derived(slotId === 1 && hasDateTimeBounds);

	const supported = $derived(
		showTextboxPattern ||
			showTextboxMinlength ||
			showTextboxMaxlength ||
			showTextareaMaxlength ||
			showNumberMin ||
			showNumberMax ||
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
{:else if showTextboxPattern}
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
{:else if showTextboxMinlength}
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
{:else if showTextboxMaxlength || showTextareaMaxlength}
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
{:else if showNumberMin}
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
						component.validation.min = parseOptionalNumber(value);
					}
				}
			/>
		</span>
	</div>
{:else if showNumberMax}
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
						component.validation.max = parseOptionalNumber(value);
					}
				}
			/>
		</span>
	</div>
{:else if showDateMin}
	<div>
		<p class={fieldLabelClass}>minDate</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Datepicker
				placeholder="minDate"
				inputClass="text-sm"
				showActionButtons
				bind:value={
					() => parseDateString(component.validation?.minDate),
					(date) => {
						component.validation.minDate = formatDateString(date);
					}
				}
				onclear={() => {
					component.validation.minDate = undefined;
				}}
			/>
		</span>
	</div>
{:else if showDateMax}
	<div>
		<p class={fieldLabelClass}>maxDate</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Datepicker
				placeholder="maxDate"
				inputClass="text-sm"
				showActionButtons
				bind:value={
					() => parseDateString(component.validation?.maxDate),
					(date) => {
						component.validation.maxDate = formatDateString(date);
					}
				}
				onclear={() => {
					component.validation.maxDate = undefined;
				}}
			/>
		</span>
	</div>
{:else if showTimeMin}
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
					() => normalizeTimeString(component.validation?.minTime) ?? '',
					(time) => {
						component.validation.minTime = normalizeTimeString(time);
					}
				}
			/>
		</span>
	</div>
{:else if showTimeMax}
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
					() => normalizeTimeString(component.validation?.maxTime) ?? '',
					(time) => {
						component.validation.maxTime = normalizeTimeString(time);
					}
				}
			/>
		</span>
	</div>
{:else if showDateTimeMin}
	<div>
		<p class={fieldLabelClass}>minDateTime</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="datetime-local"
				size="sm"
				aria-label="{component.type} の最小日時"
				bind:value={
					() => toDatetimeLocalValue(component.validation?.minDateTime),
					(value) => {
						component.validation.minDateTime = fromDatetimeLocalValue(value);
					}
				}
			/>
		</span>
	</div>
{:else if showDateTimeMax}
	<div>
		<p class={fieldLabelClass}>maxDateTime</p>
		<span
			class="contents"
			use:arrowNavigation={{ field: fieldName, row: rowIndex, fieldGroup: FIELD_GROUP }}
		>
			<Input
				type="datetime-local"
				size="sm"
				aria-label="{component.type} の最大日時"
				bind:value={
					() => toDatetimeLocalValue(component.validation?.maxDateTime),
					(value) => {
						component.validation.maxDateTime = fromDatetimeLocalValue(value);
					}
				}
			/>
		</span>
	</div>
{/if}
