<script lang="ts">
	import {
		PREVIEW_CONTROL,
		PREVIEW_DISP_ONLY,
		previewFieldClass
	} from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();

	/** プレビュー入力値（IR には反映しない） */
	let values = $state<string[]>([]);

	const items = $derived(component.items);
	const defaultValue = $derived(component.defaultValue);
</script>

<div class={previewFieldClass('dropdown')}>
	{#if component.readonly ?? false}
		<p class={PREVIEW_DISP_ONLY}>{values.join(', ') ?? ''}</p>
	{:else}
	<select
		class="{PREVIEW_CONTROL} {previewFieldClass('dropdown-multi')}"
		bind:value={values}
		multiple
		autocomplete="off"
		disabled={component.disabled}
		aria-required={component.validation?.required ?? false}
		aria-label={component.label ?? ''}
	>
		{#each items as item, index}
			<option value={item?.value ?? ''}
				selected={defaultValue?.includes(item?.value ?? '') ?? false}
				data-item-index={index}
			>{item?.label ?? ''}</option>
		{/each}
	</select>
	{/if}
</div>
