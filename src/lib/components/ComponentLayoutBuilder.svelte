<script lang="ts">
    import { onMount } from 'svelte';
    import { Card } from 'flowbite-svelte';
    import { dndzone } from 'svelte-dnd-action';

    import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';

    const uiDefinition = getUIDefinitionContext();
    let components = $state<any[]>([]);

    // 初期化
    onMount(() => {
        components = [...uiDefinition.components];
    });

    // ドラッグ&ドロップ
    function handleDnD(e: CustomEvent, filalized: boolean = false) {
        components = [...e.detail.items];

        // ドロップが完了したら、コンポーネントを更新
        if (filalized) {
            uiDefinition.replaceComponents(components as any[]);
        }
    }
</script>

<!-- DnD action : コンポーネントをDrag&Dropで並べ替える -->
<div class="w-1/2 mx-auto flex flex-col gap-2 items-center justify-center"
    use:dndzone={{
        items: components as any[],
        flipDurationMs: 200,
        dropTargetStyle: {
            backgroundColor: 'rgba(120, 90, 30, 0.1)',
        }
    }}
    onconsider={(event) => handleDnD(event, false)}
    onfinalize={(event) => handleDnD(event, true)}
>
    {#each components as component, index (component.id)}
        <Card href="javascript:void(0)" class="p-1 sm:p-1 md:p-2 flex flex-row items-center justify-center">
            <div class="w-10 h-10 flex items-center justify-center">{index + 1}</div>
            <div class="w-1/2 text-bold mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{component.label}</div>
            <div class="w-1/2 leading-tight font-normal text-gray-700 dark:text-gray-400">{component.logicalId}</div>
        </Card>
    {/each}
</div>