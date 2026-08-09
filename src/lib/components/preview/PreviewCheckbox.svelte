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

<div class={previewFieldClass('checkbox')}>
	{#if component.readonly ?? false}
		<p class={PREVIEW_DISP_ONLY}>{values.join(', ') ?? ''}</p>
	{:else}
		<div class="flex items-center">
			{#each items as item, index}
				<input
					id={`${component.id}-${index}`}
					class="{PREVIEW_CONTROL} {previewFieldClass('checkbox')}"
					type="checkbox"
					autocomplete="off"
					disabled={component.disabled}
					readonly={component.readonly}
					aria-required={component.validation?.required ?? false}
					aria-label={item?.label ?? ''}
					onchange={(e) => {
						if ((e.target as HTMLInputElement).checked) {
							values.push(item?.value ?? '');
						} else {
							values = values.filter(value => value !== item?.value);
						}
					}}
				/>
				<label for={`${component.id}-${index}`}>{item?.label ?? ''}</label>
			{/each}
		</div>
	{/if}
</div>
