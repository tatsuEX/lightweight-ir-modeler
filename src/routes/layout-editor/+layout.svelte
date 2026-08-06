<script lang="ts">
	import LayoutEditorNav from '$lib/components/LayoutEditorNav.svelte';
	import {
		UIDefinition,
		setUIDefinitionContext
	} from '$lib/store/layout-editor/layout-editor.svelte';

	let { children } = $props();

	/** layout-editor の状態は Context API 経由でのみ参照する */
	const uiDefinition = new UIDefinition();
	setUIDefinitionContext(uiDefinition);
</script>

<div class="p-6">
	<div class="mb-4">
		<LayoutEditorNav />
	</div>
	{@render children()}
</div>
