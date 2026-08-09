<script lang="ts">
	import { 
		Button, 
		Drawer, Drawerhead, 
		Listgroup, ListgroupItem, 
		Sidebar, SidebarWrapper, SidebarGroup, SidebarItem,
	} from 'flowbite-svelte';
	import {
		createNumber,
		createTextarea,
		createTextbox,
		getUIDefinitionContext
	} from '$lib/store/layout-editor/layout-editor.svelte';

	/** 画面定義の状態は Context API 経由でのみ参照する */
	const uiDefinition = getUIDefinitionContext();

	let open = $state(false);

	/**
	 * ツールパレットを開く
	 */
	function openPalette() {
		open = true;
	}

	/**
	 * ツールパレットを閉じる
	 */
	function closePalette() {
		open = false;
	}

	/**
	 * テキストボックス行を追加する
	 */
	function addTextbox() {
		uiDefinition.append(createTextbox({}));
	}

	/**
	 * テキストエリア行を追加する
	 */
	function addTextarea() {
		uiDefinition.append(createTextarea({}));
	}

	/**
	 * 数値入力行を追加する
	 */
	function addNumber() {
		uiDefinition.append(createNumber({}));
	}
</script>

<Button color="primary" onclick={openPalette}>ツールパレット</Button>

<Drawer bind:open placement="right" outsideclose>
	<Drawerhead class="mb-4" onclick={closePalette} title="選択した種類の行をテーブル末尾に追加します。">
		<h5 class="text-base font-semibold text-gray-500 dark:text-gray-400">コンポーネントを追加</h5>
	</Drawerhead>
	<Sidebar disableBreakpoints={true} class="top-16 w-full">
		<SidebarWrapper>
			<SidebarGroup>
				<SidebarItem label="Textbox" onclick={addTextbox} >
					{#snippet icon()}
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
							<path d="M0 0h24v24H0z" fill="none" />
							<path fill="none" stroke="currentColor" stroke-width="1.5" d="M6 3h8M6 21h8m-4 0V3m3 4h9v10h-9M7 7H2v10h5" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem label="Textarea" onclick={addTextarea} >
					{#snippet icon()}
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16">
							<path d="M0 0h16v16H0z" fill="none" />
							<path fill="currentColor" d="M2 2h1v4H2z" />
							<path fill="currentColor" d="M1 0C.4 0 0 .4 0 1v14c0 .6.4 1 1 1h15V0zm12 15H1V1h12zm2 0h-1v-1h1zm0-2h-1V3h1zm0-11h-1V1h1z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem label="Number" onclick={addNumber} >
					{#snippet icon()}
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
							<path d="M0 0h24v24H0z" fill="none" />
							<path fill="currentColor" d="M4 17V9H2V7h4v10zm18-2a2 2 0 0 1-2 2h-4v-2h4v-2h-2v-2h2V9h-4V7h4a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 1-1.5 1.5a1.5 1.5 0 0 1 1.5 1.5zm-8 0v2H8v-4a2 2 0 0 1 2-2h2V9H8V7h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v2z" />
						</svg>
					{/snippet}
				</SidebarItem>
			</SidebarGroup>
		</SidebarWrapper>
	</Sidebar>
</Drawer>
