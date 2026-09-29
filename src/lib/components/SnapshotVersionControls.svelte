<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, Label, Select, type SelectOptionType } from 'flowbite-svelte';
	import ConfirmPublishKindModal from '$lib/components/ConfirmPublishKindModal.svelte';
	import { isUiDefinitionMetaReady, isValidLogicalId } from '$lib/ir/ui-definition-meta';
	import {
		EMPTY_PUBLISHED_VERSIONS_LISTING,
		findPublishedChangeReason,
		formatPublishedVersionLabel,
		getPublishContext,
		resolveNextPublishedVersion,
		type PublishKind
	} from '$lib/ir/snapshot-version';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { activateLayoutEditorDiskSnapshot } from '$lib/store/layout-editor/layout-editor-session.svelte';
	import { getToastContext } from '$lib/store/toast/toast.svelte';
	import { requestSchemaConsent } from '$lib/store/layout-editor/schema-migration-consent.svelte';
	import {
		fetchPublishedVersions,
		loadWorkingSnapshotFromVersion,
		publishWorkingSnapshot,
		SnapshotSchemaRequestError,
		type LoadedWorkingSnapshot,
		type PublishedVersionsListing
	} from '$lib/store/layout-editor/snapshot-version-client';

	let {
		showBasedOn = false
	}: {
		/** true のときだけ読込元（basedOn）を出す。既定は出さない */
		showBasedOn?: boolean;
	} = $props();

	const uiDefinition = getUIDefinitionContext();
	const toast = getToastContext();

	let listing = $state<PublishedVersionsListing>({ ...EMPTY_PUBLISHED_VERSIONS_LISTING });
	let selectedVersion = $state('');
	let busy = $state(false);
	let kindModalOpen = $state(false);
	let listingReady = $state(false);

	const canMutate = $derived(
		listingReady && isUiDefinitionMetaReady(uiDefinition.meta) && isValidLogicalId(uiDefinition.meta.logicalId)
	);
	const publishContext = $derived(getPublishContext(listing.versions, uiDefinition.meta.basedOn));
	const workingChangeReason = $derived(uiDefinition.meta.changeReason);
	/**
	 * パッチ版を取得する
	 */
	const patchVersion = $derived(
		publishContext === 'first'
			? ''
			: resolveNextPublishedVersion(listing.versions, uiDefinition.meta.basedOn, 'patch')
	);
	/**
	 * 新たな正本版を取得する
	 */
	const newHeadVersion = $derived(
		publishContext === 'past'
			? resolveNextPublishedVersion(listing.versions, uiDefinition.meta.basedOn, 'new-head')
			: ''
	);
	/**
	 * 通常の改版版を取得する
	 */
	const revisionVersion = $derived(
		publishContext === 'past'
			? ''
			: resolveNextPublishedVersion(listing.versions, uiDefinition.meta.basedOn, 'revision')
	);
	/**
	 * 過去版一覧を取得する
	 */
	const versionItems = $derived<SelectOptionType<string>[]>(
		listing.selectable.map((version) => ({
			value: version,
			name: formatPublishedVersionLabel(
				version,
				findPublishedChangeReason(listing.summaries, version),
				{ head: version === listing.head }
			)
		}))
	);
	/**
	 * 作業中の版として Select に載せる version を返す
	 */
	function resolveLoadedSelectableVersion(
		currentListing: PublishedVersionsListing,
		basedOn: string | undefined,
		version: string
	): string {
		if (basedOn && currentListing.selectable.includes(basedOn)) {
			return basedOn;
		}
		if (currentListing.selectable.includes(version)) {
			return version;
		}

		return currentListing.head ?? currentListing.selectable.at(-1) ?? '';
	}

	const loadedSelectableVersion = $derived(
		resolveLoadedSelectableVersion(listing, uiDefinition.meta.basedOn, uiDefinition.meta.version)
	);
	/**
	 * Select が作業中の版と違い、まだ読込していない
	 */
	const selectionPending = $derived(
		selectedVersion !== '' && selectedVersion !== loadedSelectableVersion
	);
	/**
	 * 最新版のラベルを取得する
	 */
	const latestLabel = $derived(
		listing.head
			? formatPublishedVersionLabel(
					listing.head,
					findPublishedChangeReason(listing.summaries, listing.head)
				)
			: ''
	);
	/**
	 * 読込元版のラベルを取得する
	 */
	const basedOnLabel = $derived(
		uiDefinition.meta.basedOn
			? formatPublishedVersionLabel(
					uiDefinition.meta.basedOn,
					findPublishedChangeReason(listing.summaries, uiDefinition.meta.basedOn)
				)
			: ''
	);

	/**
	 * UI 定義の logicalId が変更されたら確定版一覧を再取得する
	 */
	$effect(() => {
		const logicalId = uiDefinition.meta.logicalId;
		if (!isValidLogicalId(logicalId)) {
			listing = { ...EMPTY_PUBLISHED_VERSIONS_LISTING };
			selectedVersion = '';
			listingReady = true;
			return;
		}

		listingReady = false;
		void refreshListing(logicalId);
	});

	/**
	 * 作業中メタが変わったら Select を作業中の版へ合わせる（ユーザの未読込選択は basedOn が変わらない限り維持する）
	 */
	$effect(() => {
		const basedOn = uiDefinition.meta.basedOn;
		const version = uiDefinition.meta.version;
		const preferred = untrack(() =>
			resolveLoadedSelectableVersion(listing, basedOn, version)
		);
		if (preferred !== '') {
			selectedVersion = preferred;
		}
	});

	/**
	 * 確定版一覧を再取得する
	 */
	async function refreshListing(logicalId: string, nextSelected?: string): Promise<void> {
		try {
			listing = await fetchPublishedVersions(logicalId);
			if (nextSelected && listing.selectable.includes(nextSelected)) {
				selectedVersion = nextSelected;
				return;
			}

			// WARN: logicalId 切替時は作業中の版へ合わせる。未読込の Select 操作は一覧再取得より前だけ有効。
			selectedVersion = resolveLoadedSelectableVersion(
				listing,
				uiDefinition.meta.basedOn,
				uiDefinition.meta.version
			);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			toast.warn('確定版一覧を取得できませんでした', detail);
		} finally {
			listingReady = true;
		}
	}

	/**
	 * API から返った snapshot をエディタへ載せる
	 */
	function applyLoadedSnapshot(snapshot: LoadedWorkingSnapshot): void {
		activateLayoutEditorDiskSnapshot(snapshot);
	}

	/**
	 * 指定系統で確定する
	 */
	async function publishWithKind(kind: PublishKind): Promise<void> {
		if (!canMutate || busy) {
			return;
		}

		busy = true;
		try {
			const result = await publishWorkingSnapshot(uiDefinition.meta.logicalId, kind);
			const publishedLabel = formatPublishedVersionLabel(result.version, workingChangeReason);
			applyLoadedSnapshot(result.snapshot);
			await refreshListing(uiDefinition.meta.logicalId, result.version);
			toast.info('確定しました', publishedLabel);
		} catch (error) {
			if (error instanceof SnapshotSchemaRequestError && error.block.code === 'schema-consent') {
				requestSchemaConsent(
					{
						logicalId: uiDefinition.meta.logicalId,
						rationales: error.block.rationales,
						schemaVersion: error.block.schemaVersion,
						latest: error.block.latest
					},
					() => {
						void publishWithKind(kind);
					}
				);
				return;
			}
			const detail = error instanceof Error ? error.message : String(error);
			toast.error('確定に失敗しました', detail);
		} finally {
			busy = false;
			kindModalOpen = false;
		}
	}

	/**
	 * 確定ボタンを処理する
	 */
	function handlePublish(): void {
		if (publishContext === 'first') {
			void publishWithKind('revision');
			return;
		}

		kindModalOpen = true;
	}

	/**
	 * 選択中の確定版を編集中へ載せる
	 */
	async function handleLoadVersion(): Promise<void> {
		if (!canMutate || busy || selectedVersion === '') {
			return;
		}

		busy = true;
		try {
			const loadedLabel = formatPublishedVersionLabel(
				selectedVersion,
				findPublishedChangeReason(listing.summaries, selectedVersion)
			);
			const snapshot = await loadWorkingSnapshotFromVersion(uiDefinition.meta.logicalId, selectedVersion);
			applyLoadedSnapshot(snapshot);
			await refreshListing(uiDefinition.meta.logicalId, selectedVersion);
			toast.info('過去版を読み込みました', `${loadedLabel}（history をリセット）`);
		} catch (error) {
			if (error instanceof SnapshotSchemaRequestError && error.block.code === 'schema-consent') {
				const version = selectedVersion;
				requestSchemaConsent(
					{
						logicalId: uiDefinition.meta.logicalId,
						rationales: error.block.rationales,
						schemaVersion: error.block.schemaVersion,
						latest: error.block.latest
					},
					() => {
						selectedVersion = version;
						void handleLoadVersion();
					}
				);
				return;
			}
			const detail = error instanceof Error ? error.message : String(error);
			toast.error('過去版の読込に失敗しました', detail);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-1">
	<div class="flex flex-wrap items-end gap-2">
		<Button size="sm" color="primary" disabled={!canMutate || busy} onclick={handlePublish}>
			{publishContext === 'first' && revisionVersion
				? `確定（→ ${formatPublishedVersionLabel(revisionVersion, workingChangeReason)}）`
				: '確定'}
		</Button>
		<div class="min-w-0 flex-1">
			<Label for="published-version-select">
				{selectionPending ? '過去版（未読込）' : '過去版'}
			</Label>
			<Select
				id="published-version-select"
				size="sm"
				items={versionItems}
				bind:value={selectedVersion}
				disabled={!canMutate || busy || versionItems.length === 0}
				placeholder="確定版がありません"
				aria-label={selectionPending ? '過去版（未読込）' : '過去版'}
				classes={{
					select: selectionPending
						? 'border-amber-500 ring-1 ring-amber-500 dark:border-amber-400 dark:ring-amber-400'
						: ''
				}}
			/>
		</div>
		<Button
			size="sm"
			color={selectionPending ? 'amber' : 'alternative'}
			disabled={!canMutate || busy || selectedVersion === ''}
			onclick={() => void handleLoadVersion()}
		>
			読込
		</Button>
	</div>
	{#if listing.head}
		<p class="text-xs text-gray-500 dark:text-gray-400">最新版: {latestLabel}</p>
	{/if}
	{#if showBasedOn && uiDefinition.meta.basedOn}
		<p class="text-xs text-gray-500 dark:text-gray-400">読込元: {basedOnLabel}</p>
	{/if}
</div>

<ConfirmPublishKindModal
	bind:open={kindModalOpen}
	{publishContext}
	patchVersion={patchVersion}
	revisionVersion={revisionVersion}
	newHeadVersion={newHeadVersion}
	changeReason={workingChangeReason}
	{busy}
	onConfirm={(kind) => void publishWithKind(kind)}
	onCancel={() => {
		kindModalOpen = false;
	}}
/>
