<script lang="ts">
	import { Button, ButtonGroup } from 'flowbite-svelte';
	import { page } from '$app/state';

	const tabs = [
		{ href: '/layout-editor/property', label: 'Property' },
		{ href: '/layout-editor/layout', label: 'Layout' },
		{ href: '/layout-editor/preview', label: 'Preview' }
	] as const;

	/**
	 * 指定タブのパスが現在のルートと一致するか判定する
	 */
	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}
</script>

<ButtonGroup size="sm">
	{#each tabs as tab (tab.href)}
		<Button
			href={tab.href}
			color={isActive(tab.href) ? 'primary' : 'alternative'}
			class="px-3 py-1"
			outline={!isActive(tab.href)}
		>
			{tab.label}
		</Button>
	{/each}
</ButtonGroup>
