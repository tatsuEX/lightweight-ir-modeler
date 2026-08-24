<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';
	import CommentTargetTree from '$lib/components/CommentTargetTree.svelte';
	import MonacoMarkdownEditor from '$lib/components/MonacoMarkdownEditor.svelte';
	import {
		buildComponentCommentTree,
		buildUiDefinitionCommentTree,
		type CommentTreeNode
	} from '$lib/ir/comment-target-tree';
	import {
		isUiDefinitionOwnerKey,
		parseComponentIdFromOwnerKey
	} from '$lib/ir/snapshot-comment-map';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';

	const comments = getSnapshotCommentsContext();
	const uiDefinition = getUIDefinitionContext();

	/**
	 * 現在の編集対象に応じたコメント対象ツリーを作る
	 */
	function buildEditorTree(): CommentTreeNode | null {
		const editor = comments.editor;
		if (!editor) {
			return null;
		}
		if (isUiDefinitionOwnerKey(editor.ownerKey)) {
			return buildUiDefinitionCommentTree({
				logicalId: uiDefinition.logicalId,
				name: uiDefinition.name,
				description: uiDefinition.description,
				version: uiDefinition.version,
				...(uiDefinition.external ? { external: uiDefinition.external } : {})
			});
		}
		const componentId = parseComponentIdFromOwnerKey(editor.ownerKey);
		if (componentId == null) {
			return null;
		}
		const component = uiDefinition.components.find((item) => item.id === componentId);
		if (!component) {
			return null;
		}
		return buildComponentCommentTree(component);
	}

	const tree = $derived(buildEditorTree());
</script>

<Modal
	title={comments.editor?.title ?? '運用コメント'}
	bind:open={() => comments.editor !== null, (next) => {
		if (!next) {
			comments.cancelEditor();
		}
	}}
	size="xl"
	outsideclose
	class="w-full max-w-5xl"
>
	{#if comments.editor}
		<div class="flex min-h-[20rem] gap-3">
			{#if tree}
				<div class="w-56 shrink-0 border-r border-gray-200 pr-2 dark:border-gray-600">
					<CommentTargetTree
						root={tree}
						selectedOwnerKey={comments.editor.ownerKey}
						onSelect={(ownerKey, title) => comments.selectEditor(ownerKey, title)}
					/>
				</div>
			{/if}
			<div class="min-w-0 flex-1">
				<p class="mb-2 font-mono text-xs break-all text-gray-500 dark:text-gray-400">
					{comments.editor.title}
				</p>
				<MonacoMarkdownEditor
					bind:value={() => comments.editor?.draft ?? '', (next) => comments.setEditorDraft(next)}
				/>
			</div>
		</div>
	{/if}

	<div class="mt-4 flex justify-end gap-2">
		<Button color="alternative" onclick={() => comments.cancelEditor()}>キャンセル</Button>
		<Button color="primary" onclick={() => comments.commitEditor()}>保存</Button>
	</div>
</Modal>
