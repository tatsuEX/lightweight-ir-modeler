<script lang="ts">
	import { Badge, Input } from 'flowbite-svelte';

	type Size = 'sm' | 'md';

	type Props = {
		/** タグ一覧（IR 非依存の string[]） */
		value?: string[];
		placeholder?: string;
		/** true のとき重複タグを追加しない */
		unique?: boolean;
		disabled?: boolean;
		size?: Size;
		class?: string;
		/** アクセシビリティ用ラベル */
		'aria-label'?: string;
	};

	let {
		value = $bindable<string[]>([]),
		placeholder = 'タグを追加',
		unique = true,
		disabled = false,
		size = 'sm',
		class: className = '',
		'aria-label': ariaLabel = 'タグ入力'
	}: Props = $props();

	/** 入力中の下書き文字列 */
	let draft = $state('');

	/**
	 * 下書きをタグとして追加する
	 */
	function addTag(raw: string): void {
		const tag = raw.trim();
		if (!tag || disabled) {
			return;
		}
		if (unique && value.includes(tag)) {
			draft = '';
			return;
		}
		value = [...value, tag];
		draft = '';
	}

	/**
	 * 指定 index のタグを削除する
	 */
	function removeTag(index: number): void {
		if (disabled) {
			return;
		}
		value = value.filter((_, i) => i !== index);
	}

	/**
	 * Enter / カンマで追加、空入力時 Backspace で末尾削除
	 */
	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addTag(draft.replace(/,$/, ''));
			return;
		}
		if (event.key === 'Backspace' && draft === '' && value.length > 0) {
			event.preventDefault();
			removeTag(value.length - 1);
		}
	}

	/**
	 * 入力確定（blur）時に下書きが残っていればタグ化する
	 */
	function onBlur(): void {
		if (draft.trim()) {
			addTag(draft);
		}
	}
</script>

<div
	class="flex min-w-[12rem] flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-700 {className}"
	class:opacity-60={disabled}
	class:pointer-events-none={disabled}
>
	{#each value as tag, index (`${index}:${tag}`)}
		<Badge
			color="gray"
			dismissable
			large={size === 'md'}
			closeAriaLabel="{tag} を削除"
			onclose={() => removeTag(index)}
		>
			{tag}
		</Badge>
	{/each}
	<!-- WARN: data-arrow-nav-focus は外側 use:arrowNavigation が Badge 削除ボタンではなく本入力を掴むため -->
	<Input
		{size}
		{disabled}
		{placeholder}
		aria-label={ariaLabel}
		data-arrow-nav-focus
		class="min-w-[6rem] flex-1 border-0 bg-transparent py-1 shadow-none focus:border-0 focus:ring-0 dark:bg-transparent"
		bind:value={draft}
		onkeydown={onKeydown}
		onblur={onBlur}
	/>
</div>
