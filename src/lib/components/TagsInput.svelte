<script lang="ts">
	import { Badge, Input } from 'flowbite-svelte';

	/** 入力要素 */
	let inputElement: HTMLInputElement | undefined = $state(undefined);

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
		console.log('# tags input onKeydown');
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
	 * TSV or CSV が paste された場合、区切り文字で分割してタグとして追加する
	 */
	function onPaste(event: ClipboardEvent): void {
		// クリップボードから文字列を取得
		const text = event.clipboardData?.getData('text') ?? '';
		const SeparatedType: 'tsv' | 'csv' | 'other' = text.includes('\t') ? 'tsv' : text.includes(',') ? 'csv' : 'other';

		// 区切り文字を含まない場合は、ブラウザ標準の貼り付け動作
		if (SeparatedType === 'other') {
			return;
		}

		// 区切り文字で分割する場合は、分割前の文字列が貼り付けられないようにするため、preventDefault する
		event.preventDefault();
		text.split(/[\t,]/).forEach(tag => {
			const separated = tag.trim();
			switch (SeparatedType) {
				case 'tsv':
					addTag(separated);
					break;
				case 'csv':
					// CSV は、囲み文字および列中のダブルクオーテーションを考慮する
					addTag(separated.replace(/(^"|"$)/g, '').replace(/(""|\\")/g, '"'));
					break;
			}
		});
		return;
	}

	/**
	 * 入力確定（blur）時に下書きが残っていればタグ化する
	 */
	function onBlur(): void {
		if (draft.trim()) {
			addTag(draft);
		}
	}

	/**
	 * 監視対象
	 * - 入力DOM要素
	 */
	$effect(() => {
		if (inputElement instanceof HTMLInputElement) {
			inputElement.addEventListener('paste', onPaste);
		}
		return () => {
			if (inputElement instanceof HTMLInputElement) {
				inputElement.removeEventListener('paste', onPaste);
			}
		};
	});
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
		bind:elementRef={inputElement}
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
