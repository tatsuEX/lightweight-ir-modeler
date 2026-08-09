<script lang="ts">
	import type { Component } from 'svelte';

	/* === ▽▽▽ PREVIEW COMPONENT REGISTRY ▽▽▽ === */
	import PreviewTextbox from './PreviewTextbox.svelte';
	import PreviewTextarea from './PreviewTextarea.svelte';
	import PreviewNumber from './PreviewNumber.svelte';
	import PreviewCheckbox from './PreviewCheckbox.svelte';
	import PreviewRadio from './PreviewRadio.svelte';
	import PreviewDropdown from './PreviewDropdown.svelte';
	import PreviewDropdownMulti from './PreviewDropdownMulti.svelte';
	// import PreviewDatepicker from './PreviewDatepicker.svelte';
	// import PreviewDateSpan from './PreviewDateSpan.svelte';
	// import PreviewDatetimepicker from './PreviewDatetimepicker.svelte';
	import PreviewLabel from './PreviewLabel.svelte';
	import PreviewUnknown from './PreviewUnknown.svelte';
	import type { PreviewComponentType, PreviewRendererProps } from '$lib/preview/preview-types';

	const PREVIEW_COMPONENT_REGISTRY = {
		textbox: PreviewTextbox,
		textarea: PreviewTextarea,
		number: PreviewNumber,
		checkbox: PreviewCheckbox,
		radio: PreviewRadio,
		dropdown: PreviewDropdown,
		'dropdown-multi': PreviewDropdownMulti,
		// datepicker: PreviewDatepicker,
		// date-span: PreviewDateSpan,
		// datetimepicker: PreviewDatetimepicker,
		// timepicker: PreviewTimepicker,
		label: PreviewLabel,
		unknown: PreviewUnknown,
	} satisfies Record<PreviewComponentType, Component<PreviewRendererProps>>;
	/* === △△△ PREVIEW COMPONENT REGISTRY △△△ === */

	/**
	 * component.type からプレビューレンダラを解決する
	 */
	function resolvePreviewRenderer(type: string): Component<PreviewRendererProps> {
		return (
			(PREVIEW_COMPONENT_REGISTRY as Record<string, Component<PreviewRendererProps>>)[type] ??
			PreviewUnknown
		);
	}

	let { component }: PreviewRendererProps = $props();

	const Renderer = $derived(resolvePreviewRenderer(component.type));
</script>

{#key component.id}
	<Renderer {component} />
{/key}
