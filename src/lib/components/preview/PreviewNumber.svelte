<script lang="ts">
	import {
		PREVIEW_CONTROL,
		previewFieldClass
	} from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();

	/** プレビュー入力値（IR には反映しない） */
	let value = $state('');

	const min = $derived(component.validation?.min);
	const max = $derived(component.validation?.max);
	const step = $derived(component.validation?.step ?? 1);
</script>

<div class={previewFieldClass('number')}>
	<input
		class={PREVIEW_CONTROL}
		type="number"
		bind:value
		autocomplete="off"
		placeholder={component.hint ?? component.label ?? ''}
		disabled={component.disabled}
		readonly={component.readonly}
		min={min}
		max={max}
		{step}
		aria-label={component.label || 'number'}
	/>
</div>
