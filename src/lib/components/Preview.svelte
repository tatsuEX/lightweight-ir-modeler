<script lang="ts">
    import { Label, Select, type SelectOptionType } from 'flowbite-svelte';

    import PreviewComponentRenderer from '$lib/components/preview/PreviewComponentRenderer.svelte';
    import { PREVIEW_ROOT, previewThemeClass } from '$lib/preview/preview-classes';
    import '$lib/preview/preview-theme-styles';
    import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
    import { getPreviewThemeContext } from '$lib/store/layout-editor/preview-theme.svelte';
    import { getTransformTargetContext } from '$lib/store/layout-editor/transform-target.svelte';

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
                        <td class="p-2 border-collapse border border-gray-300 w-1/4 align-top">{component.label}</td>
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

    <div class="flex flex-row items-end justify-end gap-2 items-center justify-center">
        <button class="w-50 p-2 m-2 bg-blue-500 text-white rounded-md">出力</button>
        <button class="w-50 p-2 m-2 bg-red-500 text-white rounded-md">キャンセル</button>
    </div>
</div>
