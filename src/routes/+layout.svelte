<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import './layout.css';
	import {
		UIDefinition,
		setUIDefinitionContext
	} from '$lib/store/layout-editor/layout-editor.svelte';

	let { children } = $props();

	/** layout-editor の状態は Context API 経由でのみ参照する */
	const uiDefinition = new UIDefinition();
	setUIDefinitionContext(uiDefinition);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
