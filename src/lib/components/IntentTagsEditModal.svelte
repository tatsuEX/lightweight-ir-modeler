<script lang="ts" module>
	/** 操作対象の範囲 */
	export type IntentTagsScope = 'selected' | 'all';

	/** 反映 / 削除 */
	export type IntentTagsMode = 'add' | 'remove';

	/** ダイアログから親へ渡す操作 */
	export type IntentTagsApplyRequest = {
		scope: IntentTagsScope;
		mode: IntentTagsMode;
		tags: string[];
	};
</script>

<script lang="ts">
	import { Badge, Button, Modal, Textarea, Tooltip } from 'flowbite-svelte';
	import IntentTagsSharedWarningModal from '$lib/components/IntentTagsSharedWarningModal.svelte';
	import TagsInput, { type TagSuggestion } from '$lib/components/TagsInput.svelte';
	import {
		DEFAULT_INTENT_TAG_ALIAS,
		formatIntentTagIrTypeLabel,
		isValidIntentTagId,
		normalizeIntentTags
	} from '$lib/ir/intent-tags';
	import { getIntentTagCatalogContext } from '$lib/store/layout-editor/intent-tag-catalog.svelte';
	import { getToastContext } from '$lib/store/toast/toast.svelte';

	type Props = {
		open?: boolean;
		/** 選択中の対象が持つタグ（対象ごと） */
		selectedTagSets: readonly (readonly string[] | undefined)[];
		/** 全対象が持つタグ（対象ごと） */
		allTagSets: readonly (readonly string[] | undefined)[];
		/** `{logicalId}` 付きマスタの展開に使う logicalId */
		logicalIds?: readonly string[];
		/** 出す操作範囲（meta のように単一対象なら `['all']` など） */
		scopes?: readonly IntentTagsScope[];
		/**
		 * 操作を反映する
		 *
		 * @returns タグが変化した対象の数
		 */
		onapply: (request: IntentTagsApplyRequest) => number;
	};

	let {
		open = $bindable(false),
		selectedTagSets,
		allTagSets,
		logicalIds = [],
		scopes = ['selected', 'all'],
		onapply
	}: Props = $props();

	const catalog = getIntentTagCatalogContext();
	const toast = getToastContext();

	/** 操作するタグ（presentation state） */
	let workingTags = $state<string[]>([]);
	/** 新規タグの説明（id → 説明） */
	let descriptions = $state<Record<string, string>>({});
	let busy = $state(false);
	let warningOpen = $state(false);
	let pendingRequest = $state<{ scope: IntentTagsScope; mode: IntentTagsMode } | null>(null);

	$effect(() => {
		if (open) {
			workingTags = [];
			descriptions = {};
			pendingRequest = null;
		}
	});

	const selectedCount = $derived(selectedTagSets.length);
	const allCount = $derived(allTagSets.length);

	/** 付与状況を集計する対象（選択があれば選択、無ければ全件） */
	const statsBase = $derived(selectedCount > 0 ? selectedTagSets : allTagSets);

	/** タグごとの付与数（出現順） */
	const tagStats = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const tags of statsBase) {
			for (const tag of normalizeIntentTags(tags)) {
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
		return [...counts.entries()].map(([tag, count]) => ({ tag, count }));
	});

	/** マスタ未登録の操作タグ */
	const unregisteredTags = $derived(workingTags.filter((tag) => !catalog.find(tag)));

	const sharedLabel = $derived(
		catalog.sharedWithIrTypes.map(formatIntentTagIrTypeLabel).join(', ')
	);

	/**
	 * TagsInput へ渡す候補
	 */
	function suggest(query: string): TagSuggestion[] {
		return catalog
			.suggest(query, { logicalIds, exclude: workingTags })
			.map((item) => ({ value: item.value, description: item.description, badge: item.source }));
	}

	/**
	 * 付与状況チップから操作タグへ追加する
	 */
	function pickTag(tag: string): void {
		if (!workingTags.includes(tag)) {
			workingTags = [...workingTags, tag];
		}
	}

	/**
	 * 未登録タグを default マスタへ登録する
	 *
	 * @returns すべて登録できたか
	 */
	async function registerUnregistered(): Promise<boolean> {
		for (const tag of unregisteredTags) {
			try {
				await catalog.register(tag, descriptions[tag] ?? '');
			} catch (error) {
				toast.error(
					`Intent Tag「${tag}」を登録できませんでした`,
					error instanceof Error ? error.message : String(error)
				);
				return false;
			}
		}
		return true;
	}

	/**
	 * 登録（必要なら）と反映を行い、ダイアログを閉じる
	 */
	async function commit(scope: IntentTagsScope, mode: IntentTagsMode): Promise<void> {
		busy = true;
		try {
			if (mode === 'add' && catalog.canRegister && unregisteredTags.length > 0) {
				if (!(await registerUnregistered())) {
					return;
				}
			}
			const tags = [...workingTags];
			const changed = onapply({ scope, mode, tags });
			toast.info(
				mode === 'add' ? 'Intent Tags を反映しました' : 'Intent Tags を削除しました',
				`${changed} 件のコンポーネントを更新（${tags.join(', ')}）`
			);
			open = false;
		} finally {
			busy = false;
		}
	}

	/**
	 * 操作ボタンの処理。共有マスタへ登録するときは先に確認する
	 */
	function run(scope: IntentTagsScope, mode: IntentTagsMode): void {
		if (busy || workingTags.length === 0) {
			return;
		}
		const registers = mode === 'add' && catalog.canRegister && unregisteredTags.length > 0;
		if (registers && catalog.shouldWarnShared()) {
			pendingRequest = { scope, mode };
			warningOpen = true;
			return;
		}
		void commit(scope, mode);
	}

	/**
	 * 共有マスタ警告で続行する
	 */
	function confirmShared(dontShowAgain: boolean): void {
		const request = pendingRequest;
		warningOpen = false;
		pendingRequest = null;
		if (dontShowAgain) {
			catalog.dismissSharedWarning();
		}
		if (request) {
			void commit(request.scope, request.mode);
		}
	}

	/**
	 * 共有マスタ警告でキャンセルする（登録も反映もしない）
	 */
	function cancelShared(): void {
		warningOpen = false;
		pendingRequest = null;
	}
</script>

<Modal title="Intent Tags" bind:open size="lg" classes={{ footer: 'justify-end p-2 md:p-3' }}>
	<div class="flex flex-col gap-4 text-sm">
		<p class="text-gray-600 dark:text-gray-400">
			対象: 選択 {selectedCount} 件 / 全 {allCount} 件
		</p>

		{#if catalog.loadError}
			<p class="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-200">
				マスタを読み込めませんでした: {catalog.loadError}
			</p>
		{/if}

		<section class="flex flex-col gap-2">
			<h3 class="font-medium text-gray-900 dark:text-white">
				現在の付与状況
				<span class="text-xs font-normal text-gray-500 dark:text-gray-400">
					（{selectedCount > 0 ? '選択中' : '全件'}。クリックで操作するタグに追加）
				</span>
			</h3>
			{#if tagStats.length === 0}
				<p class="text-xs text-gray-500 dark:text-gray-400">付与済みのタグはありません。</p>
			{:else}
				<div class="flex flex-wrap gap-1">
					{#each tagStats as stat (stat.tag)}
						{@const definition = catalog.find(stat.tag)}
						<button type="button" onclick={() => pickTag(stat.tag)}>
							<Badge color={definition ? 'indigo' : 'yellow'}>
								<span class="font-mono">{stat.tag}</span>
								<span class="ml-1 opacity-75">{stat.count}/{statsBase.length}</span>
							</Badge>
						</button>
						<Tooltip placement="bottom" class="z-50 max-w-xs whitespace-pre-wrap">
							{definition ? `${definition.description || '（説明なし）'}\n[${definition.source}]` : 'マスタ未登録'}
						</Tooltip>
					{/each}
				</div>
			{/if}
		</section>

		<section class="flex flex-col gap-2">
			<h3 class="font-medium text-gray-900 dark:text-white">操作するタグ</h3>
			<TagsInput
				bind:value={workingTags}
				placeholder="タグを入力（例 auto-layout、validator:email）"
				aria-label="操作する Intent Tags"
				suggestions={suggest}
				accept={isValidIntentTagId}
				tagColor={(tag) => (catalog.find(tag) ? 'gray' : 'yellow')}
			/>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				書式は <code>name</code> または <code>name:arg</code>（小文字・数字・ハイフン）。黄色はマスタ未登録のタグです。
			</p>
		</section>

		{#if unregisteredTags.length > 0}
			<section class="flex flex-col gap-2 rounded-md border border-yellow-300 p-3 dark:border-yellow-600">
				<h3 class="font-medium text-gray-900 dark:text-white">
					新規タグ
					<span class="text-xs font-normal text-gray-500 dark:text-gray-400">
						登録先: {DEFAULT_INTENT_TAG_ALIAS}{#if sharedLabel}（{sharedLabel} と共有）{/if}
					</span>
				</h3>
				{#if catalog.canRegister}
					{#each unregisteredTags as tag (tag)}
						<label class="flex flex-col gap-1">
							<span class="font-mono text-xs">{tag}</span>
							<Textarea
								class="w-full"
								rows={2}
								placeholder="用途の説明（任意。Tooltip に表示されます）"
								value={descriptions[tag] ?? ''}
								oninput={(event: Event) => {
									const target = event.currentTarget as HTMLTextAreaElement;
									descriptions = { ...descriptions, [tag]: target.value };
								}}
							/>
						</label>
					{/each}
					<p class="text-xs text-gray-500 dark:text-gray-400">「反映」を押すと登録してから付与します。</p>
				{:else}
					<p class="text-xs text-gray-600 dark:text-gray-300">
						登録先マスタ（{DEFAULT_INTENT_TAG_ALIAS}）が未設定のため登録できません。未登録のまま付与します。
					</p>
				{/if}
			</section>
		{/if}
	</div>

	{#snippet footer()}
		<div class="flex w-full flex-wrap items-center justify-end gap-2">
			{#if scopes.includes('selected')}
				<Button
					size="xs"
					color="primary"
					disabled={busy || workingTags.length === 0 || selectedCount === 0}
					onclick={() => run('selected', 'add')}
				>
					選択に反映
				</Button>
				<Button
					size="xs"
					color="alternative"
					disabled={busy || workingTags.length === 0 || selectedCount === 0}
					onclick={() => run('selected', 'remove')}
				>
					選択から削除
				</Button>
			{/if}
			{#if scopes.includes('selected') && scopes.includes('all')}
				<span class="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true"></span>
			{/if}
			{#if scopes.includes('all')}
				<Button
					size="xs"
					color="alternative"
					disabled={busy || workingTags.length === 0 || allCount === 0}
					onclick={() => run('all', 'add')}
				>
					すべて ({allCount}) に反映
				</Button>
				<Button
					size="xs"
					color="red"
					outline
					disabled={busy || workingTags.length === 0 || allCount === 0}
					onclick={() => run('all', 'remove')}
				>
					すべて ({allCount}) から削除
				</Button>
			{/if}
		</div>
	{/snippet}
</Modal>

<IntentTagsSharedWarningModal
	bind:open={warningOpen}
	sharedWithIrTypes={catalog.sharedWithIrTypes}
	tags={unregisteredTags}
	onConfirm={confirmShared}
	onCancel={cancelShared}
/>
