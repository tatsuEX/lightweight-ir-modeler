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

<Navbar>
	<NavBrand href="/">
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white"
			>Lightweight IR Modeler</span
		>
	</NavBrand>
	<NavHamburger />
	<NavUl {activeUrl}>
		<NavLi href="/">TOP</NavLi>
		<NavLi href="/layout-editor">Layout Editor</NavLi>
	</NavUl>
</Navbar>
