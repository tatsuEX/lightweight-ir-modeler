<script lang="ts" module>
	/** 入力候補 1 件 */
	export type TagSuggestion = {
		value: string;
		/** 候補行の 2 行目に出す説明 */
		description?: string;
		/** 候補行の右端に出す短い補足（定義元など） */
		badge?: string;
	};
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { nanoid } from 'nanoid';
	import { Badge, Dropdown, DropdownItem, Input, type BadgeProps } from 'flowbite-svelte';
	import { debounce } from '$lib/utils/debounce';
	import { escapeCss } from '$lib/utils/escape-css';

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
		/** 入力候補（未指定なら候補を出さない） */
		suggestions?: (query: string) => TagSuggestion[];
		/** false を返したタグは追加せず、下書きに残す */
		accept?: (tag: string) => boolean;
		/** タグごとの Badge 色 */
		tagColor?: (tag: string) => BadgeProps['color'];
	};

	let {
		value = $bindable<string[]>([]),
		placeholder = 'タグを追加',
		unique = true,
		disabled = false,
		size = 'sm',
		class: className = '',
		'aria-label': ariaLabel = 'タグ入力',
		suggestions,
		accept,
		tagColor
	}: Props = $props();

	/** 入力中の下書き文字列 */
	let draft = $state('');
	/** 下書きが accept に弾かれたか */
	let rejected = $state(false);

	/** 候補 Dropdown の状態 */
	let filteredSuggestions = $state<TagSuggestion[]>([]);
	let suggestionsOpen = $state(false);
	let activeIndex = $state(-1);
	let focused = $state(false);

	const inputId = `tags-input-${nanoid(8)}`;
	const triggerSelector = `#${escapeCss(inputId)}`;

	/**
	 * 下書きから候補を作り直し、開閉を同期する
	 */
	function refreshSuggestions(): void {
		if (!suggestions) {
			return;
		}
		filteredSuggestions = suggestions(draft).filter(
			(item) => !(unique && value.includes(item.value))
		);
		activeIndex = -1;
		suggestionsOpen = focused && filteredSuggestions.length > 0;
	}

	const refreshLater = debounce(refreshSuggestions, 120);

	onDestroy(() => {
		refreshLater.cancel();
	});

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
			rejected = false;
			return;
		}
		if (accept && !accept(tag)) {
			draft = tag;
			rejected = true;
			return;
		}
		value = [...value, tag];
		draft = '';
		rejected = false;
		refreshSuggestions();
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
	 * Enter / カンマで追加、空入力時 Backspace で末尾削除、矢印で候補を選ぶ
	 */
	function onKeydown(event: KeyboardEvent): void {
		if (suggestionsOpen && filteredSuggestions.length > 0) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const last = filteredSuggestions.length - 1;
				if (event.key === 'ArrowDown') {
					activeIndex = activeIndex >= last ? 0 : activeIndex + 1;
				} else {
					activeIndex = activeIndex <= 0 ? last : activeIndex - 1;
				}
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				suggestionsOpen = false;
				activeIndex = -1;
				return;
			}
			if (event.key === 'Enter' && activeIndex >= 0) {
				event.preventDefault();
				addTag(filteredSuggestions[activeIndex].value);
				return;
			}
		} else if (suggestions && event.key === 'ArrowDown') {
			event.preventDefault();
			refreshSuggestions();
			return;
		}

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
	 * 入力変更時に候補を更新する
	 */
	function onInput(): void {
		rejected = false;
		refreshLater();
	}

	/**
	 * フォーカス時に候補を出す
	 */
	function onFocus(): void {
		focused = true;
		refreshSuggestions();
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
	 *
	 * WARN: 候補クリックは mousedown で blur を止めているので、ここには来ない。
	 */
	function onBlur(): void {
		focused = false;
		suggestionsOpen = false;
		activeIndex = -1;
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
	class="flex min-w-[12rem] flex-wrap items-center gap-1 rounded-lg border bg-gray-50 p-1 dark:bg-gray-700 {rejected
		? 'border-red-500 dark:border-red-400'
		: 'border-gray-300 dark:border-gray-600'} {className}"
	class:opacity-60={disabled}
	class:pointer-events-none={disabled}
>
	{#each value as tag, index (`${index}:${tag}`)}
		<Badge
			color={tagColor?.(tag) ?? 'gray'}
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
		id={inputId}
		bind:elementRef={inputElement}
		{size}
		{disabled}
		{placeholder}
		aria-label={ariaLabel}
		aria-invalid={rejected}
		autocomplete="off"
		data-arrow-nav-focus
		class="min-w-[6rem] flex-1 border-0 bg-transparent py-1 shadow-none focus:border-0 focus:ring-0 dark:bg-transparent"
		bind:value={draft}
		oninput={onInput}
		onfocus={onFocus}
		onkeydown={onKeydown}
		onblur={onBlur}
	/>
</div>
{#if suggestions}
	<Dropdown
		simple
		placement="bottom-start"
		offset={4}
		triggeredBy={triggerSelector}
		bind:isOpen={suggestionsOpen}
		class="max-h-64 min-w-[16rem] overflow-y-auto"
	>
		{#each filteredSuggestions as item, index (item.value)}
			<DropdownItem
				class="text-sm {index === activeIndex ? 'bg-gray-100 dark:bg-gray-600' : ''}"
				onmousedown={(event: MouseEvent) => event.preventDefault()}
				onclick={() => addTag(item.value)}
			>
				<span class="flex items-start justify-between gap-3">
					<span class="flex min-w-0 flex-col">
						<span class="font-mono">{item.value}</span>
						{#if item.description}
							<span class="truncate text-xs text-gray-500 dark:text-gray-400">
								{item.description.split('\n')[0]}
							</span>
						{/if}
					</span>
					{#if item.badge}
						<Badge color="indigo" class="shrink-0">{item.badge}</Badge>
					{/if}
				</span>
			</DropdownItem>
		{/each}
	</Dropdown>
{/if}
