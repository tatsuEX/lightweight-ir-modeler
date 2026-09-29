<script lang="ts">
	import { Button, ButtonGroup } from 'flowbite-svelte';
	import { page } from '$app/state';
	import { getLayoutColumnsContext } from '$lib/store/layout-editor/layout-columns.svelte';

	const columns = getLayoutColumnsContext();

	const tabs = [
		{ href: '/layout-editor/property', label: 'Property' },
		{ href: '/layout-editor/layout', label: 'Layout' },
		{ href: '/layout-editor/preview', label: 'Preview' }
	] as const;

	const layoutTabHref = '/layout-editor/layout';

	/**
	 * 指定タブのパスが現在のルートと一致するか判定する
	 */
	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}

	/**
	 * 退避が残っている Layout タブはエラー色にする
	 */
	function tabColor(href: string): 'primary' | 'alternative' | 'red' {
		if (href === layoutTabHref && columns.parked.length > 0) {
			return 'red';
		}
		return isActive(href) ? 'primary' : 'alternative';
	}
</script>

<ButtonGroup size="sm">
	{#each tabs as tab (tab.href)}
		<Button
			href={tab.href}
			color={tabColor(tab.href)}
			class="px-3 py-1"
			outline={!isActive(tab.href)}
		>
			{tab.label}
		</Button>
	{/each}
</ButtonGroup>
