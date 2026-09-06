<script lang="ts">
	import { PREVIEW_CONTROL, previewFieldClass } from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();

	/** プレビュー入力値（IR には反映しない） */
	let value = $state('');

	const maxlength = $derived(component.type === 'textbox' ? component.validation.maxlength : undefined);
	const pattern = $derived(component.type === 'textbox' ? component.validation.pattern : undefined);
</script>

<div class={previewFieldClass('textbox')}>
	<input
		class="{PREVIEW_CONTROL} {previewFieldClass('textbox')}"
		type="text"
		bind:value
		autocomplete="off"
		placeholder={component.hint || component.label}
		disabled={component.disabled}
		readonly={component.readonly}
		maxlength={maxlength}
		pattern={pattern || undefined}
		aria-required={component.validation.required}
		aria-label={component.label || 'textbox'}
	/>
</div>
