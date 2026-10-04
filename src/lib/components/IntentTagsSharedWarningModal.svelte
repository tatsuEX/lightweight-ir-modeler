<script lang="ts">
	import { Button, Checkbox, Modal } from 'flowbite-svelte';
	import { formatIntentTagIrTypeLabel, type IntentTagIrType } from '$lib/ir/intent-tags';

	type Props = {
		open?: boolean;
		/** 登録先マスタを共有しているほかの IR 種類 */
		sharedWithIrTypes: readonly IntentTagIrType[];
		/** 登録するタグ */
		tags: readonly string[];
		onConfirm: (dontShowAgain: boolean) => void;
		onCancel: () => void;
	};

	let { open = $bindable(false), sharedWithIrTypes, tags, onConfirm, onCancel }: Props = $props();

	let dontShowAgain = $state(false);

	const irTypeLabels = $derived(sharedWithIrTypes.map(formatIntentTagIrTypeLabel).join(', '));

	$effect(() => {
		if (open) {
			dontShowAgain = false;
		}
	});
</script>

<Modal
	title="共有マスタへの登録"
	bind:open={() => open, (next) => {
		if (!next && open) {
			onCancel();
		}
		open = next;
	}}
	size="sm"
>
	<div class="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-300">
		<p>Intent TagsマスタがほかのIR種別 ({irTypeLabels}) からも参照されています。</p>
		<p>登録したタグは、それらの IR 種別の候補にも表示されます。</p>
		<ul class="font-mono text-xs">
			{#each tags as tag (tag)}
				<li>{tag}</li>
			{/each}
		</ul>
		<Checkbox bind:checked={dontShowAgain}>今後このメッセージを表示しない</Checkbox>
	</div>

	{#snippet footer()}
		<div class="flex w-full justify-end gap-2">
			<Button size="xs" color="alternative" onclick={onCancel}>キャンセル</Button>
			<Button size="xs" color="primary" onclick={() => onConfirm(dontShowAgain)}>登録して反映</Button>
		</div>
	{/snippet}
</Modal>
