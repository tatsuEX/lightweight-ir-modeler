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

<!-- WARN: ボタンは footer snippet。body に置くとツリーと一緒にスクロールする。 -->
<!-- WARN: 既定 body の overflow-y-auto を hidden に上書きし、左右ペインだけスクロールさせる。 -->
<Modal
	title={comments.editor?.title ?? '運用コメント'}
	bind:open={() => comments.editor !== null, (next) => {
		if (!next) {
			comments.cancelEditor();
		}
	}}
	size="xl"
	outsideclose
	class="h-[min(90vh,42rem)] max-h-[90vh] w-full max-w-5xl overflow-hidden"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden"
	footerClass="justify-end"
>
	{#if comments.editor}
		<div class="flex h-full min-h-0 flex-1 gap-3">
			{#if tree}
				<div
					class="flex h-full min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-gray-200 pr-2 dark:border-gray-600"
				>
					<CommentTargetTree
						root={tree}
						selectedOwnerKey={comments.editor.ownerKey}
						onSelect={(ownerKey, title) => comments.selectEditor(ownerKey, title)}
					/>
				</div>
			{/if}
			<div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
			<!-- ヘッダにオーナキーを表示しているため、Editor上部には表示しない
				<p class="mb-2 shrink-0 font-mono text-xs break-all text-gray-500 dark:text-gray-400">
					{comments.editor.title}
				</p>
				-->
				<div class="min-h-0 flex-1">
					<MonacoMarkdownEditor
						bind:value={() => comments.editor?.draft ?? '', (next) => comments.setEditorDraft(next)}
					/>
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<Button color="alternative" onclick={() => comments.cancelEditor()}>キャンセル</Button>
		<Button color="primary" onclick={() => comments.commitEditor()}>保存</Button>
	{/snippet}
</Modal>
