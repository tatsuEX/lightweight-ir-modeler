<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Dropdown, DropdownItem, Input } from 'flowbite-svelte';
	import type { InputProps, InputValue } from 'flowbite-svelte';
	import { debounce } from '$lib/utils/debounce';

	/** 選択肢の供給元（固定配列またはクエリ文字列から配列を返す関数） */
	export type AutocompleteOptionsSource = string[] | ((query: string) => string[]);

	type Props = {
		value?: string;
		options: AutocompleteOptionsSource;
		/** 入力変更から Dropdown 選択肢を更新するまでの遅延（ミリ秒） */
		debounceMs?: number;
		/** 表示する選択肢の上限 */
		maxOptions?: number;
		onselect?: (option: string) => void;
		onblur?: () => void;
	} & Omit<InputProps<InputValue>, 'value' | 'data' | 'onSelect' | 'onblur'>;

	let {
		value = $bindable(''),
		options,
		debounceMs = 300,
		maxOptions = 20,
		id,
		size = 'sm',
		onselect,
		onblur,
		...inputProps
	}: Props = $props();

	let filteredOptions = $state<string[]>([]);
	let isOpen = $state(false);
	let isFocused = $state(false);
	let activeOptionIndex = $state(-1);
	let rootElement = $state<HTMLDivElement | undefined>(undefined);
	let inputElementRef = $state<HTMLInputElement | undefined>(undefined);

	const inputId = $derived(id ?? `autocomplete-${crypto.randomUUID()}`);
	const triggerSelector = $derived(`#${CSS.escape(inputId)}`);

	// svelte-ignore state_referenced_locally
	const debouncedRefresh = debounce((query: string) => {
		filteredOptions = resolveOptions(query);
		activeOptionIndex = -1;
		syncDropdownOpen();
	}, debounceMs);

	onDestroy(() => {
		debouncedRefresh.cancel();
	});

	/**
	 * 選択肢ソースからクエリに一致する候補一覧を解決する
	 */
	function resolveOptions(query: string): string[] {
		const resolved =
			typeof options === 'function' ? options(query) : filterStaticOptions(options, query);

		return resolved.slice(0, maxOptions);
	}

	/**
	 * 固定配列をクエリ文字列で部分一致フィルタする
	 */
	function filterStaticOptions(source: string[], query: string): string[] {
		const normalized = query.trim().toLowerCase();
		if (!normalized) {
			return source;
		}

		return source.filter((item) => item.toLowerCase().includes(normalized));
	}

	/**
	 * Dropdown 表示用の選択肢を即時更新する
	 */
	function refreshOptionsImmediate(query: string): void {
		filteredOptions = resolveOptions(query);
		activeOptionIndex = -1;
		syncDropdownOpen();
	}

	/**
	 * フォーカス状態と候補数に応じて Dropdown の開閉を同期する
	 */
	function syncDropdownOpen(): void {
		isOpen = isFocused && filteredOptions.length > 0;
	}

	/**
	 * 指定インデックスの Dropdown 選択肢へフォーカスを移す
	 */
	function focusOption(index: number): void {
		if (index < 0 || index >= filteredOptions.length) {
			return;
		}

		const button = rootElement?.querySelector<HTMLButtonElement>(
			`[data-autocomplete-option="${index}"]`
		);
		button?.focus();
		activeOptionIndex = index;
	}

	/**
	 * 入力フォーカス時の処理
	 */
	function handleFocus(): void {
		isFocused = true;
		activeOptionIndex = -1;
		refreshOptionsImmediate(value);
	}

	/**
	 * 入力変更時の処理（選択肢更新は debounce する）
	 */
	function handleInput(): void {
		isFocused = true;
		isOpen = true;
		activeOptionIndex = -1;
		debouncedRefresh(value);
	}

	/**
	 * コンポーネント外へフォーカスが移ったときの処理
	 */
	function handleFocusOut(event: FocusEvent): void {
		const next = event.relatedTarget as Node | null;
		if (next && rootElement?.contains(next)) {
			return;
		}

		// WARN: クリック選択が focusout より先に処理されるよう短い遅延を入れる
		setTimeout(() => {
			if (rootElement?.contains(document.activeElement)) {
				return;
			}

			isFocused = false;
			isOpen = false;
			activeOptionIndex = -1;
			onblur?.();
		}, 150);
	}

	/**
	 * Input 上のキーボード操作
	 */
	function handleInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!isOpen || filteredOptions.length === 0) {
				refreshOptionsImmediate(value);
			}
			if (filteredOptions.length === 0) {
				return;
			}

			event.preventDefault();
			isOpen = true;
			focusOption(event.key === 'ArrowDown' ? 0 : filteredOptions.length - 1);
			return;
		}

		if (event.key === 'Escape' && isOpen) {
			event.preventDefault();
			isOpen = false;
			activeOptionIndex = -1;
		}
	}

	/**
	 * Dropdown 選択肢上のキーボード操作
	 */
	function handleOptionKeydown(event: KeyboardEvent, index: number): void {
		switch (event.key) {
			case 'Enter':
			case ' ':
				event.preventDefault();
				selectOption(filteredOptions[index]);
				return;
			case 'ArrowDown':
				event.preventDefault();
				focusOption(index < filteredOptions.length - 1 ? index + 1 : 0);
				return;
			case 'ArrowUp':
				event.preventDefault();
				if (index === 0) {
					activeOptionIndex = -1;
					inputElementRef?.focus();
					return;
				}
				focusOption(index - 1);
				return;
			case 'Escape':
				event.preventDefault();
				isOpen = false;
				activeOptionIndex = -1;
				inputElementRef?.focus();
		}
	}

	/**
	 * 候補選択時の処理
	 */
	function selectOption(option: string): void {
		value = option;
		isOpen = false;
		activeOptionIndex = -1;
		onselect?.(option);
		inputElementRef?.focus();
		isFocused = true;
	}
</script>

<div class="relative w-full" bind:this={rootElement} onfocusout={handleFocusOut}>
	<Input
		{...inputProps}
		id={inputId}
		{size}
		bind:value
		bind:elementRef={inputElementRef}
		onfocus={handleFocus}
		oninput={handleInput}
		onkeydown={handleInputKeydown}
	/>
	<Dropdown
		simple
		placement="bottom-start"
		offset={4}
		triggeredBy={triggerSelector}
		bind:isOpen
		class="max-h-48 overflow-y-auto"
	>
		{#each filteredOptions as option, index (option)}
			<DropdownItem
				class="text-sm {index === activeOptionIndex
					? 'bg-gray-100 dark:bg-gray-700'
					: ''}"
				data-autocomplete-option={index}
				onmousedown={(event: MouseEvent) => event.preventDefault()}
				onclick={() => selectOption(option)}
				onkeydown={(event: KeyboardEvent) => handleOptionKeydown(event, index)}
			>
				{option}
			</DropdownItem>
		{/each}
	</Dropdown>
</div>
