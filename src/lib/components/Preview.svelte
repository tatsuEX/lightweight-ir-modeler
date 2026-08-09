<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Label, Select, type SelectOptionType } from 'flowbite-svelte';

	import PreviewComponentRenderer from '$lib/components/preview/PreviewComponentRenderer.svelte';
	import { isUiDefinitionMetaReady } from '$lib/ir/ui-definition-meta';
	import { PREVIEW_ROOT, previewThemeClass } from '$lib/preview/preview-classes';
	import '$lib/preview/preview-theme-styles';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { getPreviewThemeContext } from '$lib/store/layout-editor/preview-theme.svelte';
	import { getTransformTargetContext } from '$lib/store/layout-editor/transform-target.svelte';
	import {
		resolveUiExportClient,
		saveBlobAsFile
	} from '$lib/store/layout-editor/ui-export-client';

	const uiDefinition = getUIDefinitionContext();

	/**
	 * テーマのリストを取得する
	 */
	const previewTheme = getPreviewThemeContext();
	const themeItems: SelectOptionType<string>[] = previewTheme.theme;
	let selectedTheme = $state<string>(previewTheme.selected.value);

	/**
	 * 変換対象のリストを取得する
	 */
	const transformTarget = getTransformTargetContext();
	const targetItems: SelectOptionType<string>[] = transformTarget.target;
	let selectedTarget = $state<string>(transformTarget.selected.value);

	const previewRootClass = $derived(`${PREVIEW_ROOT} ${previewThemeClass(selectedTheme)}`);
	const metaReady = $derived(isUiDefinitionMetaReady(uiDefinition));
	const exportClient = $derived(resolveUiExportClient(selectedTarget));

	let statusMessage = $state('');
	let busy = $state(false);

	$effect(() => {
		const matched = transformTarget.target.find((item) => item.value === selectedTarget);
		if (matched && transformTarget.selected.value !== matched.value) {
			transformTarget.selected = matched;
		}
	});

	/**
	 * 編集中 IR を exportDir へ出力する
	 */
	async function handleExport(): Promise<void> {
		if (!exportClient || !metaReady || busy) {
			return;
		}

		busy = true;
		statusMessage = '';
		try {
			const result = await exportClient.export(uiDefinition);
			statusMessage = `出力しました: ${result.relativePath}`;
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : '出力に失敗しました';
		} finally {
			busy = false;
		}
	}

	/**
	 * 成果物をダウンロードする（未出力時はサーバ側で snapshot から export）
	 */
	async function handleDownload(): Promise<void> {
		if (!exportClient || !metaReady || busy) {
			return;
		}

		busy = true;
		statusMessage = '';
		try {
			const result = await exportClient.download(uiDefinition.logicalId);
			saveBlobAsFile(result.blob, result.filename);
			statusMessage = result.autoExported
				? `未出力のため snapshot から出力してダウンロードしました: ${result.filename}`
				: `ダウンロードしました: ${result.filename}`;
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'ダウンロードに失敗しました';
		} finally {
			busy = false;
		}
	}

	/**
	 * Layout 画面へ戻る
	 */
	function handleCancel(): void {
		void goto('/layout-editor/layout');
	}
</script>

<!-- styleを選択し、表示確認 -->
<div class="w-1/2 p-2 m-2 mx-auto flex flex-col gap-2 items-center justify-center">
	<Label class="w-full m-2">
		プレビューテーマ
		<Select class="mt-2" items={themeItems} bind:value={selectedTheme} />
	</Label>
	<div class="{previewRootClass} w-full mt-4 mb-4">
		<table class="w-full table-fixed border-collapse border border-gray-300">
			<tbody class="border-collapse border border-gray-300 divide-y divide-gray-300">
				{#each uiDefinition.components as component (component.id)}
					<tr class="border-collapse border border-gray-300">
						<td class="p-2 border-collapse border border-gray-300 w-1/4 align-top font-bold">
							{component.label}
							{#if component.validation?.required ?? false}
								<span class="text-red-500"> *</span>
							{/if}
						</td>
						<td class="p-2 border-collapse border border-gray-300 w-3/4 align-top">
							<PreviewComponentRenderer {component} />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<Label class="w-full m-2">
		出力先
		<Select class="mt-2" items={targetItems} bind:value={selectedTarget} />
	</Label>

	{#if statusMessage}
		<p class="w-full text-sm text-gray-600 dark:text-gray-300" role="status">{statusMessage}</p>
	{/if}

	<div class="flex w-full flex-row flex-wrap items-center justify-end gap-2">
		<Button color="blue" disabled={!metaReady || !exportClient || busy} onclick={handleExport}>
			出力
		</Button>
		<Button
			color="alternative"
			disabled={!metaReady || !exportClient || busy}
			onclick={handleDownload}
		>
			ダウンロード
		</Button>
		<Button color="red" disabled={busy} onclick={handleCancel}>キャンセル</Button>
	</div>
</div>
