<script lang="ts">
	import { Button, Drawer, Drawerhead, Listgroup, ListgroupItem } from 'flowbite-svelte';
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
	<Drawerhead class="mb-4" onclick={closePalette}>
		<h5 class="text-base font-semibold text-gray-500 dark:text-gray-400">コンポーネントを追加</h5>
	</Drawerhead>
	<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
		選択した型の編集行をテーブル末尾に追加します。
	</p>
	<!-- WARN: ListgroupItem は各項目に active を付けないと <li> のまま（button にならない） -->
	<Listgroup active class="w-full">
		<ListgroupItem active onclick={addTextbox}>Textbox</ListgroupItem>
		<ListgroupItem active onclick={addTextarea}>Textarea</ListgroupItem>
		<ListgroupItem active onclick={addNumber}>Number</ListgroupItem>
	</Listgroup>
</Drawer>
