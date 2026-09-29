<script lang="ts">
	import { untrack } from 'svelte';
	import LayoutEditorNav from '$lib/components/LayoutEditorNav.svelte';
	import LayoutEditorSessionScope from '$lib/components/LayoutEditorSessionScope.svelte';
	import {
		activeLayoutEditorSession,
		ensureActiveLayoutEditorSession
	} from '$lib/store/layout-editor/layout-editor-session.svelte';

	let { data, children } = $props();

	/**
	 * 初回だけ種から作り、HMR ではアクティブな session を返す。
	 * 画面の切り替えは module の active が変わるので、表示はそちらを優先する。
	 * フルリロードでは種から作り直す。
	 */
	const initialSession = untrack(() =>
		ensureActiveLayoutEditorSession({
			maxLifetimeMs: data.layoutEditor.clientSession.maxLifetimeMs,
			logicalId: data.uiDefinition.logicalId,
			name: data.uiDefinition.name,
			description: data.uiDefinition.description,
			version: data.uiDefinition.version,
			preview: data.preview,
			initialSnapshot: data.initialSnapshot,
			initialUiDefinition: data.initialUiDefinition,
			initialComments: data.initialComments,
			schemaBlock: data.schemaBlock
		})
	);
	const session = $derived(activeLayoutEditorSession() ?? initialSession);
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-6">
	{#key session}
		<LayoutEditorSessionScope
			{session}
			autoSave={data.autoSave}
			layoutEditor={data.layoutEditor}
			uiDefinitionValidation={data.uiDefinitionValidation}
			schemaBlock={data.schemaBlock}
		>
			<div class="mb-4 shrink-0">
				<LayoutEditorNav />
			</div>
			<div class="min-h-0 flex-1 overflow-hidden">
				{@render children()}
			</div>
		</LayoutEditorSessionScope>
	{/key}
</div>
