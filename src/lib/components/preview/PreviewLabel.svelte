<script lang="ts">
	import {
		previewFieldClass
	} from '$lib/preview/preview-classes';
	import { PREVIEW_DISP_ONLY } from '$lib/preview/preview-classes';
	import type { PreviewRendererProps } from '$lib/preview/preview-types';

	let { component }: PreviewRendererProps = $props();
</script>

<div class={previewFieldClass('label')}>
	<p class={PREVIEW_DISP_ONLY}>{component.label ?? ''}</p>
</div>