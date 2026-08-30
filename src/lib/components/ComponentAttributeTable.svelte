<script lang="ts">
	import {
		Badge,
		Button,
		ButtonGroup,
		Checkbox,
		Dropdown,
		DropdownItem,
		Input,
		Select,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Toggle,
		Tooltip,
		type SelectOptionType
	} from 'flowbite-svelte';
	import { arrowNavigation } from '$lib/action/arrowNavigation';
	import ComponentDetailsCell, {
		type DetailsSlot
	} from '$lib/components/ComponentDetailsCell.svelte';
	import ComponentValidationCell, {
		type ValidationSlot
	} from '$lib/components/ComponentValidationCell.svelte';
	import UiDefinitionMetaAccordion from '$lib/components/UiDefinitionMetaAccordion.svelte';
	import YamlCommentButton from '$lib/components/YamlCommentButton.svelte';
	import { componentCommentKey } from '$lib/ir/snapshot-comment-map';
	import { DEFAULT_ITEM_DELIMITER } from '$lib/config/layout-editor-config';
	import {
		getUIDefinitionContext,
		isPropertyEditableType
	} from '$lib/store/layout-editor/layout-editor.svelte';
	import { matchesText, type TextMatchMode } from '$lib/utils/text-match';

	let {
		selectedCount = $bindable(0),
		/** items タグの区切り（`${value}${itemDelimiter}${label}`）。未指定時は DEFAULT_ITEM_DELIMITER */
		itemDelimiter = DEFAULT_ITEM_DELIMITER
	}: {
		selectedCount?: number;
		itemDelimiter?: string;
	} = $props();

	/**
	 * 選択項目のvalue/label 区切り文字を解決する
	 */
	const resolvedItemDelimiter = $derived(
		itemDelimiter !== '' ? itemDelimiter : DEFAULT_ITEM_DELIMITER
	);

	/** 画面定義の状態は Context API 経由でのみ参照する */
	const uiDefinition = getUIDefinitionContext();

	/** 行選択は Property 画面内の presentation state（domain / snapshot には載せない） */
	let selectedIds = $state<Set<string>>(new Set());

	/** 編集可能な項目のみ表示（既定 ON。presentation state） */
	let showEditableOnly = $state(true);

	/** 属性列グループ（presentation state。IR / snapshot には載せない） */
	type ColumnGroupId = 'basic' | 'details' | 'validation';
	let columnGroup = $state<ColumnGroupId>('basic');

	const columnGroups = [
		{ id: 'basic' as const, label: 'Basic' },
		{ id: 'details' as const, label: 'Details' },
		{ id: 'validation' as const, label: 'Validation' }
	];

	/** Details 固定スロット（列位置に type 別フィールドを載せる。Validation と同方針） */
	const DETAILS_SLOTS: DetailsSlot[] = [0, 1, 2];

	/** Validation 固定スロット */
	const VALIDATION_SLOTS: ValidationSlot[] = [0, 1, 2];

	/** boolean 列フィルタ（すべて / ON / OFF） */
	type BooleanFilterValue = 'all' | 'on' | 'off';

	/** boolean 列フィルタ（すべて / ON / OFF）の選択肢 */
	const BOOLEAN_FILTER_ITEMS: SelectOptionType<BooleanFilterValue>[] = [
		{ name: 'すべて', value: 'all' },
		{ name: 'ON', value: 'on' },
		{ name: 'OFF', value: 'off' }
	];

	/** 文字列一致モード（startsWith / contains / endsWith）の選択肢 */
	const TEXT_MATCH_MODE_ITEMS: { id: TextMatchMode; label: string; shortLabel: string }[] = [
		{ id: 'startsWith', label: '前方一致', shortLabel: '前方' },
		{ id: 'contains', label: '部分一致', shortLabel: '部分' },
		{ id: 'endsWith', label: '後方一致', shortLabel: '後方' }
	];

	/** 列ヘッダフィルタ（presentation state。IR / snapshot には載せない） */
	let logicalIdQuery = $state('');
	let logicalIdMode = $state<TextMatchMode>('contains');
	let selectedTypes = $state<Set<string>>(new Set());
	let labelQuery = $state('');
	let hintQuery = $state('');
	let requiredFilter = $state<BooleanFilterValue>('all');
	let readonlyFilter = $state<BooleanFilterValue>('all');
	let disabledFilter = $state<BooleanFilterValue>('all');
	let idModeOpen = $state(false);
	let typeFilterOpen = $state(false);

	const ID_MODE_TRIGGER_ID = 'property-col-filter-id-mode';
	const TYPE_FILTER_TRIGGER_ID = 'property-col-filter-type';

	/** 表示対象コンポーネント（Toggle で編集可能のみに絞る） */
	const visibleComponents = $derived(
		showEditableOnly
			? uiDefinition.components.filter((component) => isPropertyEditableType(component.type))
			: uiDefinition.components
	);

	/** 列フィルタ適用後の表示行 */
	const displayedComponents = $derived(
		visibleComponents.filter((component) => matchesColumnFilters(component))
	);

	/** 表示対象コンポーネントの ID リスト */
	const componentIds = $derived(displayedComponents.map((component) => component.id));

	/** すべて選択されているか判定する */
	const allSelected = $derived(
		componentIds.length > 0 && componentIds.every((id) => selectedIds.has(id))
	);

	/** 一部選択されているか判定する */
	const someSelected = $derived(
		componentIds.length > 0 && componentIds.some((id) => selectedIds.has(id)) && !allSelected
	);

	/** type 複数選択フィルタの選択肢 */
	const typeFilterOptions = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const component of visibleComponents) {
			const type = String(component.type ?? '');
			counts.set(type, (counts.get(type) ?? 0) + 1);
		}
		return [...counts.entries()]
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => a.type.localeCompare(b.type));
	});

	/** 列フィルタが適用されているか判定する */
	const hasActiveColumnFilters = $derived(
		logicalIdQuery.trim() !== '' ||
			selectedTypes.size > 0 ||
			labelQuery.trim() !== '' ||
			hintQuery.trim() !== '' ||
			requiredFilter !== 'all' ||
			readonlyFilter !== 'all' ||
			disabledFilter !== 'all'
	);

	/** ID 一致モードの短縮ラベル */
	const logicalIdModeShortLabel = $derived(
		TEXT_MATCH_MODE_ITEMS.find((item) => item.id === logicalIdMode)?.shortLabel ?? '部分'
	);

	/** 空行の colspan（固定 4 + コメント + グループ列） */
	const totalColCount = $derived(
		columnGroup === 'basic' ? 9 : columnGroup === 'details' ? 8 : 8
	);

	// 入力行を詰めて一覧性を上げる（Flowbite 既定の px-6 py-4 は広すぎる）
	const cellClass = 'px-3 py-2';
	const headCellClass = `${cellClass} sticky top-0 z-10 bg-gray-50 dark:bg-gray-700 align-top`;
	const detailsCellClass = '';
	const validationCellClass = '';
	const notSupportedClass = 'text-gray-300 dark:text-gray-700';
	const filterLabelClass = 'text-xs font-medium text-gray-700 dark:text-gray-200';
	const activeFilterClass = 'ring-1 ring-primary-500 dark:ring-primary-400';

	/**
	 * 選択行数 を更新する
	 */
	$effect(() => {
		selectedCount = selectedIds.size;
	});

	/**
	 * selectedIds を更新する
	 */
	$effect(() => {
		const alive = new Set(componentIds);
		const next = new Set([...selectedIds].filter((id) => alive.has(id)));

		/** 選択行数が変化した場合、selectedIds を更新する */
		if (next.size !== selectedIds.size) {
			selectedIds = next;
		}
	});

	/**
	 * selectedTypes を更新する
	 */
	$effect(() => {
		const alive = new Set(typeFilterOptions.map((option) => option.type));
		const next = new Set([...selectedTypes].filter((type) => alive.has(type)));

		/** type 複数選択フィルタの選択数が変化した場合、selectedTypes を更新する */
		if (next.size !== selectedTypes.size) {
			selectedTypes = next;
		}
	});

	/**
	 * 3 値フィルタと boolean 属性を照合する
	 *
	 * WARN: undefined（非対応）は ON / OFF どちらにも一致しない
	 */
	function matchesBooleanFilter(value: unknown, filter: BooleanFilterValue): boolean {
		if (filter === 'all') {
			return true;
		}
		if (filter === 'on') {
			return value === true;
		}
		return value === false;
	}

	/**
	 * 列フィルタをすべて満たすか判定する（列横断 AND、type は選択 OR）
	 */
	function matchesColumnFilters(component: {
		logicalId?: unknown;
		type?: unknown;
		label?: unknown;
		hint?: unknown;
		readonly?: unknown;
		disabled?: unknown;
		validation?: { required?: unknown };
	}): boolean {
		if (!matchesText(component.logicalId, logicalIdQuery, logicalIdMode)) {
			return false;
		}
		if (selectedTypes.size > 0 && !selectedTypes.has(String(component.type ?? ''))) {
			return false;
		}
		if (!matchesText(component.label, labelQuery, 'contains')) {
			return false;
		}
		if (!matchesText(component.hint, hintQuery, 'contains')) {
			return false;
		}
		if (!matchesBooleanFilter(component.validation?.required, requiredFilter)) {
			return false;
		}
		if (!matchesBooleanFilter(component.readonly, readonlyFilter)) {
			return false;
		}
		if (!matchesBooleanFilter(component.disabled, disabledFilter)) {
			return false;
		}
		return true;
	}

	/**
	 * 行が選択されているか判定する
	 */
	function isSelected(id: string): boolean {
		return selectedIds.has(id);
	}

	/**
	 * 行の選択状態を切り替える
	 */
	function toggleSelected(id: string, checked: boolean): void {
		const next = new Set(selectedIds);

		if (checked) {
			next.add(id);
		} else {
			next.delete(id);
		}

		selectedIds = next;
	}

	/**
	 * 表示中の全行の選択状態を切り替える
	 */
	function toggleSelectAll(): void {
		if (allSelected || someSelected) {
			selectedIds = new Set();
			return;
		}

		selectedIds = new Set(componentIds);
	}

	/**
	 * 選択中の行を削除する
	 */
	export function removeSelected(): void {
		uiDefinition.removeByIds(selectedIds);
		selectedIds = new Set();
	}

	/**
	 * type が複数選択フィルタに含まれるか判定する
	 */
	function isTypeFilterSelected(type: string): boolean {
		return selectedTypes.has(type);
	}

	/**
	 * type 複数選択フィルタを切り替える
	 */
	function toggleTypeFilter(type: string, checked: boolean): void {
		const next = new Set(selectedTypes);
		if (checked) {
			next.add(type);
		} else {
			next.delete(type);
		}
		selectedTypes = next;
	}

	/**
	 * type 複数選択を解除する
	 */
	function clearTypeFilter(): void {
		selectedTypes = new Set();
		typeFilterOpen = false;
	}

	/**
	 * id 列の一致モードを設定する
	 */
	function setLogicalIdMode(mode: TextMatchMode): void {
		logicalIdMode = mode;
		idModeOpen = false;
	}

	/**
	 * 列ヘッダフィルタをすべて初期状態に戻す
	 */
	function clearColumnFilters(): void {
		logicalIdQuery = '';
		logicalIdMode = 'contains';
		selectedTypes = new Set();
		labelQuery = '';
		hintQuery = '';
		requiredFilter = 'all';
		readonlyFilter = 'all';
		disabledFilter = 'all';
		idModeOpen = false;
		typeFilterOpen = false;
	}
</script>

<!-- WARN: 親 flex の残り高さを使うには min-h-0 が必要。無いと内容高で viewport を突き抜ける。 -->
<div class="flex h-full min-h-0 flex-col">
	<div class="shrink-0">
		<UiDefinitionMetaAccordion />
	</div>

	<div class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
		<ButtonGroup>
			{#each columnGroups as group (group.id)}
				<Button
					type="button"
					color={columnGroup === group.id ? 'primary' : 'alternative'}
					class="px-3 py-1"
					outline={columnGroup !== group.id}
					onclick={() => {
						columnGroup = group.id;
					}}
				>
					{group.label}
				</Button>
			{/each}
		</ButtonGroup>

		<div class="flex flex-wrap items-center gap-3">
			{#if visibleComponents.length > 0}
				<span class="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
					{displayedComponents.length} / {visibleComponents.length}
				</span>
			{/if}
			{#if hasActiveColumnFilters}
				<Button type="button" size="xs" color="alternative" onclick={clearColumnFilters}>
					フィルタをクリア
				</Button>
			{/if}
			<Toggle bind:checked={showEditableOnly}>編集可能な項目のみ</Toggle>
		</div>
	</div>

	<!-- WARN: Flowbite Table 既定の overflow-x-auto は縦スクロール祖先を奪うため外す。 -->
	<div class="min-h-0 flex-1 overflow-auto shadow-md sm:rounded-lg">
		<Table
			hoverable
			data-arrow-nav-root
			classes={{ div: 'relative !overflow-visible' }}
			class={columnGroup === 'basic' ? 'table-auto' : ''}
		>
		<TableHead class="sticky top-0 z-10">
			<!-- 行選択 -->
			<TableHeadCell class="{headCellClass} w-12">
				<Checkbox
					class="h-6 w-6 focus:ring-0"
					checked={allSelected}
					aria-label="すべて選択"
					onclick={toggleSelectAll}
				/>
			</TableHeadCell>
			<!-- 運用コメント 列 -->
			<TableHeadCell class="{headCellClass} w-14">
				<span class="text-xs font-medium text-gray-500 dark:text-gray-400">#</span>
			</TableHeadCell>
			<!-- ID (論理:logicalId) 列 -->
			<TableHeadCell class="{headCellClass} w-56">
				<!-- WARN: ヘッダのフィルタ入力は arrowNavigation 対象外。将来ヘッダ ↔ 行の遷移を足す余地がある。 -->
				<div class="flex min-w-0 flex-col gap-1">
					<span class={filterLabelClass}>id</span>
					<!-- ID 一致モード ボタン -->
					<div class="flex min-w-0 items-center gap-1">
						<Button
							id={ID_MODE_TRIGGER_ID}
							type="button"
							size="xs"
							color="alternative"
							class="shrink-0 px-2 h-[2em]"
							aria-label="ID の一致モード"
							aria-haspopup="menu"
							aria-expanded={idModeOpen}
						>
							{logicalIdModeShortLabel}
						</Button>
						<Dropdown
							simple
							placement="bottom-start"
							offset={4}
							triggeredBy={`#${ID_MODE_TRIGGER_ID}`}
							bind:isOpen={idModeOpen}
						>
							{#each TEXT_MATCH_MODE_ITEMS as item (item.id)}
								<DropdownItem
									onclick={() => setLogicalIdMode(item.id)}
									class={item.id === logicalIdMode ? 'font-semibold' : ''}
								>
									{item.label}
								</DropdownItem>
							{/each}
						</Dropdown>
						<!-- ID 一致モード フィルタ入力 -->
						<Input
							size="sm"
							class="min-w-0 {logicalIdQuery.trim() !== '' ? activeFilterClass : ''}"
							placeholder="ID で絞り込み"
							aria-label="ID で絞り込み"
							autocomplete="off"
							bind:value={logicalIdQuery}
						/>
					</div>
				</div>
			</TableHeadCell>
			<!-- UIコンポーネント種別 列 -->
			<TableHeadCell class="{headCellClass} w-36">
				<div class="flex min-w-0 flex-col gap-1">
					<span class={filterLabelClass}>type</span>
					<!-- type 複数選択フィルタ ボタン -->
					<Button
						id={TYPE_FILTER_TRIGGER_ID}
						type="button"
						size="xs"
						color={selectedTypes.size > 0 ? 'primary' : 'alternative'}
						outline={selectedTypes.size === 0}
						class="w-full px-2 h-[2em]"
						aria-label="type で絞り込み"
						aria-haspopup="true"
						aria-expanded={typeFilterOpen}
					>
						<Tooltip>
							<pre>{[...selectedTypes].join('\n')}</pre>
						</Tooltip>
						{#if selectedTypes.size > 0}
							{selectedTypes.size} 種選択中
						{:else}
							種類選択
						{/if}
					</Button>
					<Dropdown
						simple
						placement="bottom-start"
						offset={4}
						triggeredBy={`#${TYPE_FILTER_TRIGGER_ID}`}
						bind:isOpen={typeFilterOpen}
						class="max-h-64 overflow-y-auto"
					>
						{#if typeFilterOptions.length === 0}
							<DropdownItem class="text-sm text-gray-400">type がありません</DropdownItem>
						{:else}
							{#each typeFilterOptions as option (option.type)}
								<DropdownItem>
									<Checkbox
										aria-label="type {option.type} で絞り込み"
										checked={isTypeFilterSelected(option.type)}
										onchange={(event: Event) => {
											if (event.target instanceof HTMLInputElement) {
												toggleTypeFilter(option.type, event.target.checked);
											}
										}}
									>
										{option.type}
										<span class="text-gray-400">({option.count})</span>
									</Checkbox>
								</DropdownItem>
							{/each}
							{#if selectedTypes.size > 0}
								<DropdownItem onclick={clearTypeFilter}>すべて解除</DropdownItem>
							{/if}
						{/if}
					</Dropdown>
				</div>
			</TableHeadCell>
			<!-- 表示ラベル 列 -->
			<TableHeadCell class={headCellClass}>
				<div class="flex min-w-0 flex-col gap-1">
					<span class={filterLabelClass}>label</span>
					<Input
						size="sm"
						class="min-w-0 {labelQuery.trim() !== '' ? activeFilterClass : ''}"
						placeholder="ラベルで絞り込み"
						aria-label="label で絞り込み"
						autocomplete="off"
						bind:value={labelQuery}
					/>
				</div>
			</TableHeadCell>
			{#if columnGroup === 'basic'}
				<!-- ヒント (placeholderなど) 列 -->
				<TableHeadCell class={headCellClass}>
					<div class="flex min-w-0 flex-col gap-1">
						<span class={filterLabelClass}>hint</span>
						<Input
							size="sm"
							class="min-w-0 {hintQuery.trim() !== '' ? activeFilterClass : ''}"
							placeholder="ヒントで絞り込み"
							aria-label="hint で絞り込み"
							autocomplete="off"
							bind:value={hintQuery}
						/>
					</div>
				</TableHeadCell>
				<!-- 必須 列 -->
				<TableHeadCell class="{headCellClass} w-28">
					<div class="flex min-w-0 flex-col gap-1">
						<span class={filterLabelClass}>required</span>
						<Select
							size="sm"
							placeholder=""
							items={BOOLEAN_FILTER_ITEMS}
							bind:value={requiredFilter}
							aria-label="required で絞り込み"
							class="{requiredFilter !== 'all' ? activeFilterClass : ''}"
							selectClass="px-1 py-1"
						/>
					</div>
				</TableHeadCell>
				<!-- readonly 列 -->
				<TableHeadCell class="{headCellClass} w-28">
					<div class="flex min-w-0 flex-col gap-1">
						<span class={filterLabelClass}>readonly</span>
						<Select
							size="sm"
							placeholder=""
							items={BOOLEAN_FILTER_ITEMS}
							bind:value={readonlyFilter}
							aria-label="readonly で絞り込み"
							class={readonlyFilter !== 'all' ? activeFilterClass : ''}
							selectClass="px-1 py-1"
						/>
					</div>
				</TableHeadCell>
				<!-- disabled 列 -->
				<TableHeadCell class="{headCellClass} w-28">
					<div class="flex min-w-0 flex-col gap-1">
						<span class={filterLabelClass}>disabled</span>
						<Select
							size="sm"
							placeholder=""
							items={BOOLEAN_FILTER_ITEMS}
							bind:value={disabledFilter}
							aria-label="disabled で絞り込み"
							class={disabledFilter !== 'all' ? activeFilterClass : ''}
							selectClass="px-1 py-1"
						/>
					</div>
				</TableHeadCell>
			{:else if columnGroup === 'details'}
				<!-- UIコンポーネントの詳細情報 列 -->
				<TableHeadCell class="{headCellClass} {detailsCellClass} w-1/{2 * DETAILS_SLOTS.length}" colspan={DETAILS_SLOTS.length}>Details</TableHeadCell>
			{:else}
				<!-- UIコンポーネントの入力チェック情報 列 -->
				<TableHeadCell class="{headCellClass} {validationCellClass} w-1/{2 * VALIDATION_SLOTS.length}" colspan={VALIDATION_SLOTS.length}>Validation</TableHeadCell>
			{/if}
		</TableHead>
		<TableBody>
			{#if visibleComponents.length === 0}
				<!-- コンポーネントがない場合 -->
				<TableBodyRow>
					<TableBodyCell
						colspan={totalColCount}
						class="{cellClass} text-center text-gray-500 dark:text-gray-400"
					>
						{#if uiDefinition.components.length === 0}
							コンポーネントがありません。ツールパレットから追加してください。
						{:else}
							編集可能な項目がありません。「編集可能な項目のみ」をオフにするとすべて表示されます。
						{/if}
					</TableBodyCell>
				</TableBodyRow>
			{:else if displayedComponents.length === 0}
				<!-- フィルタに一致する行がない場合 -->
				<TableBodyRow>
					<TableBodyCell
						colspan={totalColCount}
						class="{cellClass} text-center text-gray-500 dark:text-gray-400"
					>
						<div class="flex flex-col items-center gap-2">
							<span>フィルタに一致する行がありません。</span>
							<Button type="button" size="xs" color="alternative" onclick={clearColumnFilters}>
								フィルタをクリア
							</Button>
						</div>
					</TableBodyCell>
				</TableBodyRow>
			{:else}
				<!-- WARN: key は編集対象の logicalId ではなく内部 id。key を変えると入力中に再マウントされフォーカスが飛ぶ。 -->
				{#each displayedComponents as component, rowIndex (component.id)}
					<!-- 行 -->
					<TableBodyRow>
						<!-- 行選択 -->
						<TableBodyCell class={cellClass}>
							<span class="contents" use:arrowNavigation={{ field: 'selected', row: rowIndex }}>
								<Checkbox
									class="h-6 w-6"
									checked={isSelected(component.id)}
									aria-label="{component.type} の選択"
									onchange={(event) =>
										toggleSelected(component.id, event.currentTarget.checked)}
								/>
							</span>
						</TableBodyCell>
						<!-- 運用コメント 列 -->
						<TableBodyCell class={cellClass}>
							<YamlCommentButton
								ownerKey={componentCommentKey(component.id)}
								title={component.logicalId ? `components[${component.logicalId}]` : 'component'}
								ariaLabel="{component.type} の運用コメント"
							/>
						</TableBodyCell>
						<!-- ID (論理:logicalId) 列 -->
						<TableBodyCell class={cellClass}>
							<span class="contents" use:arrowNavigation={{ field: 'logicalId', row: rowIndex }}>
								<Input
									size="sm"
									placeholder="ID"
									aria-label="{component.type} のID"
									bind:value={component.logicalId}
								/>
							</span>
						</TableBodyCell>
						<!-- UIコンポーネント種別 列 -->
						<TableBodyCell class={cellClass}>
							<Badge color="gray">{component.type}</Badge>
						</TableBodyCell>
						<!-- 表示ラベル 列 -->
						<TableBodyCell class={cellClass}>
							<span class="contents" use:arrowNavigation={{ field: 'label', row: rowIndex }}>
								<Input
									size="sm"
									placeholder="表示ラベル"
									aria-label="{component.type} のラベル"
									bind:value={component.label}
								/>
							</span>
						</TableBodyCell>

						{#if columnGroup === 'basic'}
							<!-- ヒント (placeholderなど) 列 -->
							<TableBodyCell class={cellClass}>
								{#if component.hint !== undefined}
									<span class="contents" use:arrowNavigation={{ field: 'hint', row: rowIndex }}>
										<Input
											size="sm"
											placeholder="補足説明"
											aria-label="{component.type} のヒント"
											bind:value={component.hint}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
							<!-- 必須 列 -->
							<TableBodyCell class={cellClass}>
								{#if component.validation?.required !== undefined}
									<span
										class="contents"
										use:arrowNavigation={{ field: 'validation-required', row: rowIndex }}
									>
										<Toggle
											aria-label="{component.type} の必須指定"
											bind:checked={component.validation.required}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
							<!-- readonly 列 -->
							<TableBodyCell class={cellClass}>
								{#if component.readonly !== undefined}
									<span class="contents" use:arrowNavigation={{ field: 'readonly', row: rowIndex }}>
										<Toggle
											aria-label="{component.type} の読み取り専用指定"
											bind:checked={component.readonly}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
							<!-- disabled 列 -->
							<TableBodyCell class={cellClass}>
								{#if component.disabled !== undefined}
									<span class="contents" use:arrowNavigation={{ field: 'disabled', row: rowIndex }}>
										<Toggle
											aria-label="{component.type} の無効化指定"
											bind:checked={component.disabled}
										/>
									</span>
								{:else}
									<span class={notSupportedClass}>- not supported -</span>
								{/if}
							</TableBodyCell>
						{:else if columnGroup === 'details'}
							<!-- UIコンポーネントの詳細情報 列 -->
							{#each DETAILS_SLOTS as detailsSlot (detailsSlot)}
								<TableBodyCell class="{cellClass} {detailsCellClass} w-1/{2 * DETAILS_SLOTS.length}">
									<ComponentDetailsCell
										{component}
										{rowIndex}
										slotId={detailsSlot}
										itemDelimiter={resolvedItemDelimiter}
									/>
								</TableBodyCell>
							{/each}
						{:else}
							<!-- UIコンポーネントの入力チェック情報 列 -->
							{#each VALIDATION_SLOTS as validationSlot (validationSlot)}
								<TableBodyCell class="{cellClass} {validationCellClass} w-1/{2 * VALIDATION_SLOTS.length}">
									<ComponentValidationCell
										{component}
										{rowIndex}
										slotId={validationSlot}
									/>
								</TableBodyCell>
							{/each}
						{/if}
					</TableBodyRow>
				{/each}
			{/if}
		</TableBody>
		</Table>
	</div>
</div>
