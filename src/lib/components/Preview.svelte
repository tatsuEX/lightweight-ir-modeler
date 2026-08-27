<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Label, Select, type SelectOptionType } from 'flowbite-svelte';

	import PreviewComponentRenderer from '$lib/components/preview/PreviewComponentRenderer.svelte';
	import { isUiDefinitionMetaReady } from '$lib/ir/ui-definition-meta';
	import { PREVIEW_ROOT, previewThemeClass, PREVIEW_ROW, PREVIEW_ROW_HEADER, PREVIEW_ROW_INPUT } from '$lib/preview/preview-classes';
	import '$lib/preview/preview-theme-styles';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { getPreviewThemeContext } from '$lib/store/layout-editor/preview-theme.svelte';
	import { getTransformTargetContext } from '$lib/store/layout-editor/transform-target.svelte';
	import {
		resolveUiExportClient,
		saveBlobAsFile
	} from '$lib/store/layout-editor/ui-export-client';
	import { getToastContext } from '$lib/store/toast/toast.svelte';

	const uiDefinition = getUIDefinitionContext();
	const toast = getToastContext();

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
		try {
			const result = await exportClient.export(uiDefinition);
			toast.info('出力しました', result.relativePath);
		} catch (error) {
			const detail = error instanceof Error ? error.message : '出力に失敗しました';
			toast.error('出力に失敗しました', detail);
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
		try {
			const result = await exportClient.download(uiDefinition.logicalId);
			saveBlobAsFile(result.blob, result.filename);
			if (result.autoExported) {
				toast.info(
					'未出力のため snapshot から出力してダウンロードしました',
					result.filename
				);
			} else {
				toast.info('ダウンロードしました', result.filename);
			}
		} catch (error) {
			const detail = error instanceof Error ? error.message : 'ダウンロードに失敗しました';
			toast.error('ダウンロードに失敗しました', detail);
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

<!-- WARN: .preview-root に min-h-0 が無いと overflow が発火せず、出力 chrome が画面外へ押し出される。 -->
<div class="mx-auto flex h-full min-h-0 w-1/2 flex-col">
	<div class="shrink-0 py-2">
		<Label class="w-full">
			プレビューテーマ
			<Select class="mt-2" items={themeItems} bind:value={selectedTheme} />
		</Label>
	</div>
	<div class="{previewRootClass} min-h-0 w-full flex-1 overflow-y-auto">
		<table class="w-full table-fixed border-collapse border border-gray-300">
			<tbody class="border-collapse border border-gray-300 divide-y divide-gray-300">
				{#each uiDefinition.components as component (component.id)}
					<tr class="{PREVIEW_ROW} border-collapse border border-gray-300">
						<td class="{PREVIEW_ROW_HEADER} p-2 border-collapse border border-gray-300 w-1/4 align-top font-bold">
							{component.label}
							{#if component.validation?.required ?? false}
								<span class="text-red-500"> *</span>
							{/if}
						</td>
						<td class="{PREVIEW_ROW_INPUT} p-2 border-collapse border border-gray-300 w-3/4 align-top">
							<PreviewComponentRenderer {component} />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="shrink-0 space-y-2 py-2">
		<Label class="w-full">
			出力先
			<Select class="mt-2" items={targetItems} bind:value={selectedTarget} />
		</Label>
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
</div>
