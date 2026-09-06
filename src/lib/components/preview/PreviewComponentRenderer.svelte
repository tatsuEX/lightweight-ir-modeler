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
	import PreviewLabel from './PreviewLabel.svelte';
	import PreviewUnknown from './PreviewUnknown.svelte';
	import { isComponentType, type ComponentType } from '$lib/ir/elements/component-schema';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	const PREVIEW_COMPONENT_REGISTRY = {
		textbox: PreviewTextbox,
		textarea: PreviewTextarea,
		number: PreviewNumber,
		checkbox: PreviewCheckbox,
		radio: PreviewRadio,
		dropdown: PreviewDropdown,
		'dropdown-multi': PreviewDropdownMulti,
		datepicker: PreviewUnknown,
		'date-span': PreviewUnknown,
		datetimepicker: PreviewUnknown,
		timepicker: PreviewUnknown,
		label: PreviewLabel,
		unsupported: PreviewUnknown
	} satisfies Record<ComponentType, Component<PreviewRendererProps>>;
	/* === △△△ PREVIEW COMPONENT REGISTRY △△△ === */

	/**
	 * component.type からプレビューレンダラを解決する
	 *
	 * WARN: 未実装 type（date/time 系）と `unsupported` は PreviewUnknown。
	 */
	function resolvePreviewRenderer(type: string): Component<PreviewRendererProps> {
		return isComponentType(type) ? PREVIEW_COMPONENT_REGISTRY[type] : PreviewUnknown;
	}

	let { component }: PreviewRendererProps = $props();

	const Renderer = $derived(resolvePreviewRenderer(component.type));
</script>

{#key component.id}
	<Renderer {component} />
{/key}
