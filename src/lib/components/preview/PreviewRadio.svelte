<script lang="ts">
	import {
		PREVIEW_CONTROL,
		PREVIEW_DISP_ONLY,
		previewFieldClass
	} from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();

	/** プレビュー入力値（IR には反映しない） */
	let value = $state<string | null>(null);

	const items = $derived(component.items);
	const defaultValue = $derived(component.defaultValue);
</script>

<div class={previewFieldClass('radio')}>
	{#if component.readonly ?? false}
		<p class={PREVIEW_DISP_ONLY}>{value ?? ''}</p>
	{:else}
	{#each items as item, index}
		<div class="flex items-center">
			<input
				id={`${component.id}-${index}`}
				class="{PREVIEW_CONTROL} {previewFieldClass('radio')}"
				type="radio"
				bind:value
				autocomplete="off"
				disabled={component.disabled}
				readonly={component.readonly}
				checked={defaultValue === item?.value}
				aria-required={component.validation?.required ?? false}
				aria-label={item?.label ?? ''}
			/>
			<label for={`${component.id}-${index}`}>{item?.label ?? ''}</label>
		</div>
	{/each}
	{/if}
</div>