<script lang="ts">
	import {
		PREVIEW_CONTROL,
		previewFieldClass
	} from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();

	/** プレビュー入力値（IR には反映しない） */
	let value = $state('');

	const maxlength = $derived(component.validation?.maxlength);
	const rows = $derived(component.rows ?? 3);
</script>

<div class={previewFieldClass('textarea')}>
	<textarea
		class={PREVIEW_CONTROL}
		bind:value
		autocomplete="off"
		placeholder={component.hint ?? component.label ?? ''}
		disabled={component.disabled}
		readonly={component.readonly}
		maxlength={maxlength}
		{rows}
		aria-label={component.label || 'textarea'}
	></textarea>
</div>
