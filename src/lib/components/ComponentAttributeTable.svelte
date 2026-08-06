<script lang="ts">
	import {
		Badge,
		Input,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Toggle
	} from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';

	/** 画面定義の状態は Context API 経由でのみ参照する */
	const uiDefinition = getUIDefinitionContext();

	// 入力行を詰めて一覧性を上げる（Flowbite 既定の px-6 py-4 は広すぎる）
	const cellClass = 'px-3 py-2';
</script>

<Table hoverable shadow data-arrow-nav-root>
	<TableHead>
		<TableHeadCell class="{cellClass} w-56">id</TableHeadCell>
		<TableHeadCell class="{cellClass} w-28">type</TableHeadCell>
		<TableHeadCell class={cellClass}>label</TableHeadCell>
		<TableHeadCell class={cellClass}>hint</TableHeadCell>
		<TableHeadCell class="{cellClass} w-24 text-center">required</TableHeadCell>
	</TableHead>
	<TableBody>
		{#if uiDefinition.components.length === 0}
			<TableBodyRow>
				<TableBodyCell colspan={5} class="{cellClass} text-center text-gray-500 dark:text-gray-400">
					コンポーネントがありません。ツールパレットから追加してください。
				</TableBodyCell>
			</TableBodyRow>
		{:else}
			<!-- WARN: key は編集対象の logicalId ではなく内部 id。key を変えると入力中に再マウントされフォーカスが飛ぶ。 -->
			{#each uiDefinition.components as component, rowIndex (component.id)}
				<TableBodyRow>
					<TableBodyCell class={cellClass}>
						<span class="contents" use:arrowNavigation={{ field: 'logicalId', row: rowIndex }}>
							<Input
								size="sm"
								placeholder="logicalId"
								aria-label="{component.type} の論理ID"
								bind:value={component.logicalId}
							/>
						</span>
					</TableBodyCell>
					<TableBodyCell class={cellClass}>
						<Badge color="gray">{component.type}</Badge>
					</TableBodyCell>
					<TableBodyCell class={cellClass}>
						<span class="contents" use:arrowNavigation={{ field: 'label', row: rowIndex }}>
							<Input
								size="sm"
								placeholder="表示ラベル"
								aria-label="{component.type} のラベル"
								bind:value={component.label}
							/>
						</span>
					</TableBodyCell>
					<TableBodyCell class={cellClass}>
						<span class="contents" use:arrowNavigation={{ field: 'hint', row: rowIndex }}>
							<Input
								size="sm"
								placeholder="補足説明"
								aria-label="{component.type} のヒント"
								bind:value={component.hint}
							/>
						</span>
					</TableBodyCell>
					<TableBodyCell class="{cellClass} text-center">
						<span class="contents" use:arrowNavigation={{ field: 'required', row: rowIndex }}>
							<Toggle
								class="justify-center"
								aria-label="{component.type} の必須指定"
								bind:checked={component.validation.required}
							/>
						</span>
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		{/if}
	</TableBody>
</Table>
