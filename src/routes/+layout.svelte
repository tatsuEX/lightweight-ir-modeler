<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	<div class="shrink-0">
		<AppHeader />
	</div>
	<div class="min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</div>
</div>
