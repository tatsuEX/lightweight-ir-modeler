<script lang="ts">
	import LayoutEditorNav from '$lib/components/LayoutEditorNav.svelte';
	import { attachIrAutoSave } from '$lib/store/layout-editor/ir-auto-save.svelte';
	import {
		UIDefinition,
		setUIDefinitionContext
	} from '$lib/store/layout-editor/layout-editor.svelte';
	import {
		createPreviewTheme,
		setPreviewThemeContext
	} from '$lib/store/layout-editor/preview-theme.svelte';
	import {
		createTransformTarget,
		setTransformTargetContext
	} from '$lib/store/layout-editor/transform-target.svelte';
	import { setLayoutEditorConfigContext } from '$lib/store/layout-editor/layout-editor-config.svelte';

	let { data, children } = $props();

	/** layout-editor の状態は Context API 経由でのみ参照する */
	const uiDefinition = new UIDefinition(data.uiDefinition.logicalId, data.uiDefinition.name, data.uiDefinition.description, data.uiDefinition.version);
	setUIDefinitionContext(uiDefinition);

	const previewTheme = createPreviewTheme(data.preview.theme);
	setPreviewThemeContext(previewTheme);

	const transformTarget = createTransformTarget(data.preview.transformTarget);
	setTransformTargetContext(transformTarget);

	setLayoutEditorConfigContext(data.layoutEditor);

	if (data.initialSnapshot) {
		uiDefinition.loadSnapshot(
			data.initialSnapshot,
			data.initialUiDefinition ?? undefined
		);
	}

	attachIrAutoSave(uiDefinition, data.autoSave);
</script>

<div class="p-6">
	<div class="mb-4">
		<LayoutEditorNav />
	</div>
	{@render children()}
</div>
