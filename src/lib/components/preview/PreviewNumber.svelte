<script lang="ts">
	import {
		PREVIEW_CONTROL,
		PREVIEW_DISP_ONLY,
		previewFieldClass
	} from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';
	import { formatNumber } from '$lib/utils/formatter';

	let { component }: PreviewRendererProps = $props();

	/** プレビュー入力値（IR には反映しない） */
	let value = $state<number | null>(null);

	const min = $derived(component.validation?.min);
	const max = $derived(component.validation?.max);
	const step = $derived(component.validation?.step ?? 1);
</script>

<div class={previewFieldClass('number')}>
	{#if component.readonly ?? false}
		<p class={PREVIEW_DISP_ONLY}>{formatNumber(value)}</p>
	{:else}
	<input
		class="{PREVIEW_CONTROL} {previewFieldClass('number')}"
		type="number"
		bind:value
		autocomplete="off"
		placeholder={component.hint ?? component.label ?? ''}
		disabled={component.disabled}
		readonly={component.readonly}
		min={min}
		max={max}
		{step}
		aria-required={component.validation?.required ?? false}
		aria-label={component.label || 'number'}
	/>
	{/if}
</div>
