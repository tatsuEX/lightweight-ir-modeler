<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';
	import MonacoMarkdownEditor from '$lib/components/MonacoMarkdownEditor.svelte';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';

	const comments = getSnapshotCommentsContext();

	let open = $state(false);

	$effect(() => {
		open = comments.editor !== null;
	});

	/**
	 * モーダルの開閉を store と同期する
	 */
	function setOpen(next: boolean): void {
		open = next;
		if (!next) {
			comments.cancelEditor();
		}
	}
</script>

<Modal
	title={comments.editor?.title ?? '運用コメント'}
	bind:open={() => open, (next) => setOpen(next)}
	size="lg"
	outsideclose
>
	{#if comments.editor}
		<p class="mb-2 font-mono text-xs break-all text-gray-500 dark:text-gray-400">
			{comments.editor.title}
		</p>
		<MonacoMarkdownEditor
			bind:value={() => comments.editor?.draft ?? '', (next) => comments.setEditorDraft(next)}
		/>
	{/if}

	<div class="mt-4 flex justify-end gap-2">
		<Button color="alternative" onclick={() => comments.cancelEditor()}>キャンセル</Button>
		<Button color="primary" onclick={() => comments.commitEditor()}>保存</Button>
	</div>
</Modal>
