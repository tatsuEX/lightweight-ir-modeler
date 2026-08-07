<script lang="ts">
	import type { Component } from 'svelte';

	/* === ▽▽▽ PREVIEW COMPONENT REGISTRY ▽▽▽ === */
	import PreviewNumber from './PreviewNumber.svelte';
	import PreviewTextarea from './PreviewTextarea.svelte';
	import PreviewTextbox from './PreviewTextbox.svelte';
	import PreviewUnknown from './PreviewUnknown.svelte';
	import type { PreviewComponentType, PreviewRendererProps } from '$lib/preview/preview-types';

	const PREVIEW_COMPONENT_REGISTRY = {
		textbox: PreviewTextbox,
		textarea: PreviewTextarea,
		number: PreviewNumber
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
