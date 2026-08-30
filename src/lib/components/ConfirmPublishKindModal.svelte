<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';

	let {
		open = $bindable(false),
		patchVersion = '',
		newHeadVersion = '',
		busy = false,
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		patchVersion?: string;
		newHeadVersion?: string;
		busy?: boolean;
		onConfirm: (kind: 'patch' | 'new-head') => void;
		onCancel: () => void;
	} = $props();
</script>

<Modal title="確定の系統" bind:open size="sm">
	<div class="flex flex-col gap-4">
		<p class="text-sm text-gray-700 dark:text-gray-300">
			HEAD より古い版を編集しています。確定方法を選んでください。
		</p>
		<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
			<Button color="alternative" disabled={busy} onclick={onCancel}>キャンセル</Button>
			<Button color="alternative" disabled={busy} onclick={() => onConfirm('patch')}>
				パッチとして確定（{patchVersion}）
			</Button>
			<Button color="primary" disabled={busy} onclick={() => onConfirm('new-head')}>
				新たな正本として確定（{newHeadVersion}）
			</Button>
		</div>
	</div>
</Modal>
