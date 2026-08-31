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

<Modal title="確定の系統" bind:open size="md" classes={{ header: "py-2 md:py-2", body: "p-4" }}>
	<div class="flex flex-col gap-4">
		<p class="text-sm text-gray-700 dark:text-gray-300">
			{#if publishContext === 'past'}
				最新版より古い版を編集しています。<br>
				メタの修正などはパッチ、この内容を正本にする場合は新たな正本を選んでください。
			{:else}
				メタの修正などはパッチ（同一 main の sub を進める）、大きな変更は改版（main を進める）を選んでください。
			{/if}
		</p>
		<div class="flex flex-col gap-2 sm:flex-row sm:justify-center text-center">
			<Button size="xs" color="alternative" disabled={busy} onclick={onCancel}>キャンセル</Button>
			<Button size="xs" color="alternative" disabled={busy} onclick={() => onConfirm('patch')}>
				修正版更新<br>({formatPublishedVersionLabel(patchVersion, changeReason)})
			</Button>
			{#if publishContext === 'past'}
				<Button size="xs" color="primary" disabled={busy} onclick={() => onConfirm('new-head')}>
					新たな正本として確定<br>({formatPublishedVersionLabel(newHeadVersion, changeReason)})
				</Button>
			{:else}
				<Button size="xs" color="primary" disabled={busy} onclick={() => onConfirm('revision')}>
					改版として確定<br>({formatPublishedVersionLabel(revisionVersion, changeReason)})
				</Button>
			{/if}
		</div>
	</div>
</Modal>
