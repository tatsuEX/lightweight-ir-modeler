<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';
	import { formatPublishedVersionLabel, type PublishContext, type PublishKind } from '$lib/ir/snapshot-version';

	let {
		open = $bindable(false),
		publishContext = 'head',
		patchVersion = '',
		revisionVersion = '',
		newHeadVersion = '',
		changeReason = '',
		busy = false,
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		publishContext?: PublishContext;
		patchVersion?: string;
		revisionVersion?: string;
		newHeadVersion?: string;
		changeReason?: string;
		busy?: boolean;
		onConfirm: (kind: PublishKind) => void;
		onCancel: () => void;
	} = $props();
</script>

<Modal title="確定の系統" bind:open size="sm">
	<div class="flex flex-col gap-4">
		<p class="text-sm text-gray-700 dark:text-gray-300">
			{#if publishContext === 'past'}
				HEAD より古い版を編集しています。メタの修正などはパッチ、この内容を正本にする場合は新たな正本を選んでください。
			{:else}
				メタの修正などはパッチ（同一 main の sub を進める）、大きな変更は改版（main を進める）を選んでください。
			{/if}
		</p>
		<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
			<Button color="alternative" disabled={busy} onclick={onCancel}>キャンセル</Button>
			<Button color="alternative" disabled={busy} onclick={() => onConfirm('patch')}>
				パッチとして確定（{formatPublishedVersionLabel(patchVersion, changeReason)}）
			</Button>
			{#if publishContext === 'past'}
				<Button color="primary" disabled={busy} onclick={() => onConfirm('new-head')}>
					新たな正本として確定（{formatPublishedVersionLabel(newHeadVersion, changeReason)}）
				</Button>
			{:else}
				<Button color="primary" disabled={busy} onclick={() => onConfirm('revision')}>
					改版として確定（{formatPublishedVersionLabel(revisionVersion, changeReason)}）
				</Button>
			{/if}
		</div>
	</div>
</Modal>
