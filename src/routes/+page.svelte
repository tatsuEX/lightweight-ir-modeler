<script lang="ts">
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Input,
		Toggle
	} from 'flowbite-svelte';
	import {
		createTextbox,
		createTextarea,
		createNumber,
		getUIDefinitionContext
	} from '$lib/store/layout-editor/layout-editor.svelte';

	const ui = getUIDefinitionContext();

	// テスト用初期データ（同一ページ内）。再入場時の重複追加を避ける
	if (ui.components.length === 0) {
		ui.append(
			createTextbox({
				logicalId: 'userName',
				label: '氏名',
				hint: 'フルネーム',
				validation: { required: true }
			})
		);
		ui.append(
			createTextarea({
				logicalId: 'note',
				label: '備考',
				hint: '任意入力'
			})
		);
		ui.append(
			createNumber({
				logicalId: 'age',
				label: '年齢',
				hint: '0以上',
				validation: { required: true, min: 0 }
			})
		);
	}
</script>

<main class="p-6">
	<h1 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">UIDefinition 検証</h1>

	<Table hoverable={true}>
		<TableHead>
			<TableHeadCell>logicalId</TableHeadCell>
			<TableHeadCell>type</TableHeadCell>
			<TableHeadCell>label</TableHeadCell>
			<TableHeadCell>hint</TableHeadCell>
			<TableHeadCell>required</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each ui.components as component (component.id)}
				<TableBodyRow>
					<TableBodyCell>
						<Input bind:value={component.logicalId} />
					</TableBodyCell>
					<TableBodyCell>{component.type}</TableBodyCell>
					<TableBodyCell>
						<Input bind:value={component.label} />
					</TableBodyCell>
					<TableBodyCell>
						<Input bind:value={component.hint} />
					</TableBodyCell>
					<TableBodyCell>
						<Toggle bind:checked={component.validation.required} />
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
</main>
