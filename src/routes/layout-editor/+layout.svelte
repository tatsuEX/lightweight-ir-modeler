<script lang="ts">
	import LayoutEditorNav from '$lib/components/LayoutEditorNav.svelte';
	import { attachIrAutoSave } from '$lib/store/layout-editor/ir-auto-save.svelte';
	import {
		UIDefinition,
		setUIDefinitionContext
	} from '$lib/store/layout-editor/layout-editor.svelte';

	let { data, children } = $props();

	/** layout-editor の状態は Context API 経由でのみ参照する */
	const uiDefinition = new UIDefinition();
	setUIDefinitionContext(uiDefinition);

	if (data.initialSnapshot) {
		uiDefinition.loadSnapshot(data.initialSnapshot);
	}

	attachIrAutoSave(uiDefinition, data.autoSave);
</script>

<div class="p-6">
	<div class="mb-4">
		<LayoutEditorNav />
	</div>
	{@render children()}
</div>
