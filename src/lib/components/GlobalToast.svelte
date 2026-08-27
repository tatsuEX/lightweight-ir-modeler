<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Toast, ToastContainer } from 'flowbite-svelte';
	import {
		CheckCircleSolid,
		CloseCircleSolid,
		ExclamationCircleSolid
	} from 'flowbite-svelte-icons';
	import { getToastContext, type ToastSeverity } from '$lib/store/toast/toast.svelte';

	const toast = getToastContext();

	onDestroy(() => {
		toast.clear();
	});

	/**
	 * 重要度を Flowbite Toast の color に変換する
	 */
	function toastColor(severity: ToastSeverity): 'green' | 'yellow' | 'red' {
		if (severity === 'warn') {
			return 'yellow';
		}
		if (severity === 'error') {
			return 'red';
		}
		return 'green';
	}

	/**
	 * 閉じる操作で store からメッセージを削除する
	 */
	function handleClose(id: string): void {
		toast.dismiss(id);
	}
</script>

<ToastContainer position="top-right">
	{#each toast.messages as message (message.id)}
		<Toast
			color={toastColor(message.severity)}
			align={false}
			class="w-80"
			params={{ x: 200, duration: 400 }}
			onclose={() => handleClose(message.id)}
		>
			{#snippet icon()}
				{#if message.severity === 'info'}
					<CheckCircleSolid class="h-5 w-5" />
				{:else if message.severity === 'warn'}
					<ExclamationCircleSolid class="h-5 w-5" />
				{:else}
					<CloseCircleSolid class="h-5 w-5" />
				{/if}
			{/snippet}
			<div class="text-sm font-semibold text-gray-900 dark:text-white">{message.summary}</div>
			{#if message.detail}
				<div class="mt-1 text-sm text-gray-500 dark:text-gray-400">{message.detail}</div>
			{/if}
		</Toast>
	{/each}
</ToastContainer>
