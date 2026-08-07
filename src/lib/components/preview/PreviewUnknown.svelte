<script lang="ts">
	import {
		PREVIEW_UNKNOWN,
		previewFieldClass
	} from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();
</script>

<div class={previewFieldClass('unknown')}>
	<p class={PREVIEW_UNKNOWN}>未対応: {component.type}</p>
</div>
