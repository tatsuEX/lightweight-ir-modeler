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

	const notSupportedClass = 'text-gray-300 dark:text-gray-700';
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
	 * IR の yyyy-MM-dd HH:mm を日付 / 時刻に分解する
	 */
	function parseDateTimeParts(value: unknown): { date?: Date; time?: string } {
		if (typeof value !== 'string' || value === '') {
			return {};
		}
		const matched = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(value);
		if (matched) {
			return {
				date: parseDateString(matched[1]),
				time: matched[2]
			};
		}
		return { date: parseDateString(value.slice(0, 10)) };
	}

	/**
	 * minDateTime / maxDateTime の日付部分を更新する
	 */
	function setDateTimeDate(key: 'minDateTime' | 'maxDateTime', date: Date | undefined): void {
		if (!date) {
			component.validation[key] = undefined;
			return;
		}
		const prev = parseDateTimeParts(component.validation?.[key]);
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
		const prev = parseDateTimeParts(component.validation?.[key]);
		const dateStr = formatDateString(prev.date);
		if (!dateStr) {
			return;
		}
		component.validation[key] = `${dateStr} ${normalizeTimeString(time) ?? '00:00'}`;
	}

	/**
	 * Flowbite Datepicker のカレンダーを閉じる
	 *
	 * WARN: コンポーネントは input focus で開き、外側 click で閉じるが blur では閉じない。
	 * isOpen を外から触れないため、フォーカス先（または body）への click を合成して
	 * 公式の outside-click 経路を使う。他の Datepicker 上へ移った場合はその入力を
	 * click 対象にし、移り先のカレンダーは閉じない。
	 */
	function closeDatepickerOnFocusOut(event: FocusEvent): void {
		const current = event.currentTarget as HTMLElement;
		const next = event.relatedTarget as Node | null;
		if (next && current.contains(next)) {
			return;
		}

		queueMicrotask(() => {
			const active = current.ownerDocument.activeElement;
			if (active && current.contains(active)) {
				return;
			}
			const clickTarget =
				active instanceof HTMLElement ? active : current.ownerDocument.body;
			clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
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
	const timeFieldName = $derived(`${fieldName}-time`);

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
	</div>
{:else if showDateMax}
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
							() => parseDateTimeParts(component.validation?.minDateTime).date,
							(date) => {
								setDateTimeDate('minDateTime', date);
							}
						}
						onclear={() => {
							component.validation.minDateTime = undefined;
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
						() => parseDateTimeParts(component.validation?.minDateTime).time ?? '',
						(time) => {
							setDateTimeTime('minDateTime', time);
						}
					}
				/>
			</span>
		</div>
	</div>
{:else if showDateTimeMax}
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
							() => parseDateTimeParts(component.validation?.maxDateTime).date,
							(date) => {
								setDateTimeDate('maxDateTime', date);
							}
						}
						onclear={() => {
							component.validation.maxDateTime = undefined;
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
						() => parseDateTimeParts(component.validation?.maxDateTime).time ?? '',
						(time) => {
							setDateTimeTime('maxDateTime', time);
						}
					}
				/>
			</span>
		</div>
	</div>
{/if}
