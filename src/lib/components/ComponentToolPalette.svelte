<script lang="ts">
	import {
		Button,
		Drawer, Drawerhead,
		Sidebar, SidebarWrapper, SidebarGroup, SidebarItem,
	} from 'flowbite-svelte';
	import {
	createCheckbox,
		createDatepicker,
		createDateSpan,
		createDatetimepicker,
		createDropdown,
		createDropdownMulti,
		createLabel,
		createNumber,
		createRadio,
		createTextarea,
		createTextbox,
		createTimepicker,
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

	/**
	 * チェックボックス行を追加する
	 */
	function addCheckbox() {
		uiDefinition.append(createCheckbox({}));
	}

	/**
	 * ラジオボタン行を追加する
	 */
	function addRadio() {
		uiDefinition.append(createRadio({}));
	}

	/**
	 * ドロップダウン行を追加する
	 */
	function addDropdown() {
		uiDefinition.append(createDropdown({}));
	}

	/**
	 * ドロップダウンマルチ行を追加する
	 */
	function addDropdownMulti() {
		uiDefinition.append(createDropdownMulti({}));
	}

	/**
	 * 日付ピッカー行を追加する
	 */
	function addDatepicker() {
		uiDefinition.append(createDatepicker({}));
	}

	/**
	 * 日付範囲ピッカー行を追加する
	 */
	function addDateSpan() {
		uiDefinition.append(createDateSpan({}));
	}

	/**
	 * 時刻ピッカー行を追加する
	 */
	function addTimepicker() {
		uiDefinition.append(createTimepicker({}));
	}

	/**
	 * 時間ピッカー行を追加する
	 */
	function addDatetimepicker() {
		uiDefinition.append(createDatetimepicker({}));
	}

	/**
	 * ラベル行を追加する
	 */
	function addLabel() {
		uiDefinition.append(createLabel({}));
	}
</script>

<Button size="xs" color="primary" onclick={openPalette}>ツールパレット</Button>

<Drawer bind:open placement="right" outsideclose class="lim-componet-tool-palette">
	<Drawerhead class="mb-4" onclick={closePalette} title="選択した種類の行をテーブル末尾に追加します。">
		<h5 class="text-base font-semibold text-gray-500 dark:text-gray-400">コンポーネントを追加</h5>
	</Drawerhead>
	<Sidebar disableBreakpoints={true} class="top-16 w-full">
		<SidebarWrapper>
			<SidebarGroup>
				<SidebarItem class="lim-clickable" label="Textbox" onclick={addTextbox} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=input
							vaadin:input
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16">
							<path d="M0 0h16v16H0z" fill="none" />
							<path fill="currentColor" d="M16 5c0-.6-.4-1-1-1H1c-.6 0-1 .4-1 1v6c0 .6.4 1 1 1h14c.6 0 1-.4 1-1zm-1 6H1V5h14z" />
							<path fill="currentColor" d="M2 6h1v4H2z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Textarea" onclick={addTextarea} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=input
							vaadin:text-input
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16">
							<path d="M0 0h16v16H0z" fill="none" />
							<path fill="currentColor" d="M2 2h1v4H2z" />
							<path fill="currentColor" d="M1 0C.4 0 0 .4 0 1v14c0 .6.4 1 1 1h15V0zm12 15H1V1h12zm2 0h-1v-1h1zm0-2h-1V3h1zm0-11h-1V1h1z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Number" onclick={addNumber} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=number&search-page=2
							fluent-mdl2:number-field
							license: MIT (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
							<path d="M0 0h24v24H0z" fill="none" />
							<path fill="currentColor" d="M4 17V9H2V7h4v10zm18-2a2 2 0 0 1-2 2h-4v-2h4v-2h-2v-2h2V9h-4V7h4a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 1-1.5 1.5a1.5 1.5 0 0 1 1.5 1.5zm-8 0v2H8v-4a2 2 0 0 1 2-2h2V9H8V7h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v2z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Checkbox" onclick={addCheckbox} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=checkbox
							ri:checkbox-line
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
							<path d="M0 0h24v24H0z" fill="none" />
							<path fill="currentColor" d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m1 2v14h14V5zm6.003 11L6.76 11.757l1.414-1.414l2.829 2.829l5.657-5.657l1.414 1.414z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Radio" onclick={addRadio} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=radio&search-page=1
							ri:radio-button-line
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
							<path d="M0 0h24v24H0z" fill="none" />
							<path fill="currentColor" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m0-2a8 8 0 1 0 0-16a8 8 0 0 0 0 16m0-3a5 5 0 1 1 0-10a5 5 0 0 1 0 10" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Dropdown" onclick={addDropdown} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=dropdown
							fluent-mdl2:dropdown
							license: MIT
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 2048 2048">
							<path d="M0 0h2048v2048H0z" fill="none" />
							<path fill="currentColor" d="M0 256h2048v1408H0zm1920 1280V384H128v1152zm-128-640l-256 256l-256-256z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Dropdown Multi" onclick={addDropdownMulti} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=dropdown
							fluent-mdl2:dropdown
							license: MIT
						-->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 2048 2048">
							<path d="M0 0h2048v2048H0z" fill="none" />
							<path fill="currentColor" d="M0 256h2048v1408H0zm1920 1280V384H128v1152zm-128-640l-256 256l-256-256z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Datepicker" onclick={addDatepicker} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=calendar&search-page=1
							pajamas:calendar
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16">
							<path d="M0 0h16v16H0z" fill="none" />
							<path fill="currentColor" fill-rule="evenodd" d="M4.75 1a.75.75 0 0 1 .75.75V3h5V1.75a.75.75 0 0 1 1.5 0V3h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2V1.75A.75.75 0 0 1 4.75 1M2.5 4.5V6h11V4.5zm0 9v-6h11v6zM11 11a1 1 0 1 0 0-2a1 1 0 0 0 0 2" clip-rule="evenodd" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="DateSpan" onclick={addDateSpan} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=date+range
							material-symbols-light:date-range-outline-sharp
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
							<path d="M0 0h24v24H0z" fill="none" />
							<path fill="currentColor" d="M7.46 13.655q-.23-.23-.23-.54t.23-.539t.54-.23t.54.23t.23.54t-.23.539t-.54.23t-.54-.23m4 0q-.23-.23-.23-.54t.23-.539t.54-.23t.54.23t.23.54t-.23.539t-.54.23t-.54-.23m4 0q-.23-.23-.23-.54t.23-.539t.54-.23t.54.23t.23.54t-.23.539t-.54.23t-.54-.23M4 21V5h3.385V2.77h1.077V5h7.154V2.77h1V5H20v16zm1-1h14v-9.384H5zM5 9.615h14V6H5zm0 0V6z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Timepicker" onclick={addTimepicker} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=time
							formkit:time
							license: MIT (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16">
							<path d="M0 0h16v16H0z" fill="none" />
							<path fill="currentColor" d="M8 15c-3.86 0-7-3.14-7-7s3.14-7 7-7s7 3.14 7 7s-3.14 7-7 7M8 2C4.69 2 2 4.69 2 8s2.69 6 6 6s6-2.69 6-6s-2.69-6-6-6" />
							<path fill="currentColor" d="M10 10.5c-.09 0-.18-.02-.26-.07l-2.5-1.5A.5.5 0 0 1 7 8.5v-4c0-.28.22-.5.5-.5s.5.22.5.5v3.72l2.26 1.35a.502.502 0 0 1-.26.93" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Datetimepicker" onclick={addDatetimepicker} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=calendar&search-page=8
							material-symbols-light:calendar-clock-outline-sharp
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
							<path d="M0 0h24v24H0z" fill="none" />
							<path fill="currentColor" d="M5 9.615h14V6H5zm0 0V6zM4 21V5h3.385V2.77h1.077V5h7.154V2.77h1V5H20v6.867q-.244-.09-.494-.134T19 11.652v-1.036H5V20h7.32q.078.28.2.521q.122.24.255.479zm11.549-.164Q14.385 19.67 14.385 18t1.164-2.835T18.384 14q1.672 0 2.836 1.165q1.165 1.164 1.165 2.835t-1.165 2.836T18.385 22t-2.836-1.164m4.492-.634l.546-.546l-1.818-1.818v-2.722H18v3.046z" />
						</svg>
					{/snippet}
				</SidebarItem>
				<SidebarItem class="lim-clickable" label="Label" onclick={addLabel} >
					{#snippet icon()}
						<!--
							@see https://icon-sets.iconify.design/?query=label
							vaadin:text-label
							license: Apache 2.0 (No attribution required, commercial use is allowed)
						  -->
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16">
							<path d="M0 0h16v16H0z" fill="none" />
							<path fill="currentColor" d="M12.5 4.9c-1.4 0-2.5.8-2.6.9l1.2 1.6s.7-.5 1.4-.5c1.4 0 1.5 1.2 1.5 1.6c-.4-.1-1.1-.3-2-.1c-1.4.3-2.8 2-2.1 3.9c.7 1.8 3.1 2.1 4.1.6v1h2V8.6c0-2.7-1.9-3.7-3.5-3.7m-1 6.5C11.4 9.5 13 9.5 14 9.6v1c0 1.2-2.3 2.3-2.5.8M6.9 14H9L5.8 2H3.1L0 14h2.1l1-4h2.7zM3.6 8l.8-3.2l.9 3.2z" />
						</svg>
					{/snippet}
				</SidebarItem>
			</SidebarGroup>
		</SidebarWrapper>
	</Sidebar>
</Drawer>

<style>
	:global(.lim-componet-tool-palette .lim-clickable) {
		position: relative;
		cursor: pointer;
		background: #eee;
		overflow-x: hidden;
	}
	:global(.lim-componet-tool-palette .lim-clickable)::before {
		content: "click to add";
		position: absolute;
		display: inline-block;
		color: #333;
		font-size: 0.8em;
		top: 50%;
		right: 0;
		transform: translateX(100%) translateY(-50%);
		opacity: 0;
		transition: transform 0.5s, opacity 0.5s;
	}
	:global(.lim-componet-tool-palette .lim-clickable:hover)::before {
		transform: translateX(-25%) translateY(-50%);
		opacity: 0.7;
		transition: transform 0.5s, opacity 0.5s;
	}
</style>
