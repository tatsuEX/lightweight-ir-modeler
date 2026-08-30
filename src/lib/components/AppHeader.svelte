<script lang="ts">
	import { Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { page } from '$app/state';

	/**
	 * ヘッダーメニューのアクティブ URL を解決する
	 * Layout Editor 配下は親パス `/layout-editor` をアクティブ扱いする
	 */
	const activeUrl = $derived(
		page.url.pathname.startsWith('/layout-editor') ? '/layout-editor' : page.url.pathname
	);
</script>

<Navbar class="py-0" navContainerClass="py-0 pt-[0.5em] h-[3em] items-start">
	<NavBrand href="/">
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white"
			>Lightweight IR Modeler</span
		>
	</NavBrand>
	<NavHamburger />
	<NavUl {activeUrl} class="items-start" ulClass="py-0">
		<NavLi href="/">TOP</NavLi>
		<NavLi href="/layout-editor">Layout Editor</NavLi>
	</NavUl>
</Navbar>

<hr class="mt-[0.5em] border-gray-200 dark:border-gray-600">
