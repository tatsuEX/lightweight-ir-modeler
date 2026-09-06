<script lang="ts">
	import { isSelectEditorComponent, toSelectItems } from '$lib/ir/elements/component-schema';
	import { PREVIEW_CONTROL, PREVIEW_DISP_ONLY, previewFieldClass } from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();

	/** プレビュー入力値（IR には反映しない） */
	let value = $state('');

	const items = $derived(isSelectEditorComponent(component) ? toSelectItems(component.items) : []);
	const defaultValue = $derived(component.type === 'dropdown' ? component.defaultValue : '');
</script>

<div class={previewFieldClass('dropdown')}>
	{#if component.readonly}
		<p class={PREVIEW_DISP_ONLY}>{value}</p>
	{:else}
		<select
			class="{PREVIEW_CONTROL} {previewFieldClass('dropdown')}"
			bind:value
			autocomplete="off"
			disabled={component.disabled}
			aria-required={component.validation.required}
			aria-label={component.label}
		>
			{#each items as item, index}
				<option value={item.value} selected={defaultValue === item.value} data-item-index={index}
					>{item.label}</option
				>
			{/each}
		</select>
	{/if}
</div>
