<script lang="ts">
	import { Button, Label, Select, type SelectOptionType } from 'flowbite-svelte';
	import ConfirmPublishKindModal from '$lib/components/ConfirmPublishKindModal.svelte';
	import { isUiDefinitionMetaReady, isValidLogicalId, toEditorMeta } from '$lib/ir/ui-definition-meta';
	import {
		EMPTY_PUBLISHED_VERSIONS_LISTING,
		findPublishedChangeReason,
		formatPublishedVersionLabel,
		getPublishContext,
		resolveNextPublishedVersion,
		type PublishKind
	} from '$lib/ir/snapshot-version';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';
	import { getToastContext } from '$lib/store/toast/toast.svelte';
	import {
		fetchPublishedVersions,
		loadWorkingSnapshotFromVersion,
		publishWorkingSnapshot,
		type LoadedWorkingSnapshot,
		type PublishedVersionsListing
	} from '$lib/store/layout-editor/snapshot-version-client';

	const uiDefinition = getUIDefinitionContext();
	const snapshotComments = getSnapshotCommentsContext();
	const toast = getToastContext();

	let listing = $state<PublishedVersionsListing>({ ...EMPTY_PUBLISHED_VERSIONS_LISTING });
	let selectedVersion = $state('');
	let busy = $state(false);
	let kindModalOpen = $state(false);
	let listingReady = $state(false);

	const canMutate = $derived(
		listingReady && isUiDefinitionMetaReady(uiDefinition) && isValidLogicalId(uiDefinition.logicalId)
	);
	const publishContext = $derived(getPublishContext(listing.versions, uiDefinition.basedOn));
	const workingChangeReason = $derived(uiDefinition.changeReason);
	const patchVersion = $derived(
		publishContext === 'first'
			? ''
			: resolveNextPublishedVersion(listing.versions, uiDefinition.basedOn, 'patch')
	);
	const newHeadVersion = $derived(
		publishContext === 'past'
			? resolveNextPublishedVersion(listing.versions, uiDefinition.basedOn, 'new-head')
			: ''
	);
	const revisionVersion = $derived(
		publishContext === 'past'
			? ''
			: resolveNextPublishedVersion(listing.versions, uiDefinition.basedOn, 'revision')
	);
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
	const headLabel = $derived(
		listing.head
			? formatPublishedVersionLabel(
					listing.head,
					findPublishedChangeReason(listing.summaries, listing.head)
				)
			: ''
	);
	const basedOnLabel = $derived(
		uiDefinition.basedOn
			? formatPublishedVersionLabel(
					uiDefinition.basedOn,
					findPublishedChangeReason(listing.summaries, uiDefinition.basedOn)
				)
			: ''
	);

	$effect(() => {
		const logicalId = uiDefinition.logicalId;
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
	 * 確定版一覧を再取得する
	 */
	async function refreshListing(logicalId: string): Promise<void> {
		try {
			listing = await fetchPublishedVersions(logicalId);
			if (!listing.selectable.includes(selectedVersion)) {
				selectedVersion = listing.head ?? listing.selectable.at(-1) ?? '';
			}
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
		uiDefinition.loadSnapshot(
			snapshot.components ?? [],
			snapshot.uiDefinition ? toEditorMeta(snapshot.uiDefinition) : undefined
		);
		snapshotComments.loadFromYamlMap(
			snapshot.comments ?? {},
			uiDefinition.components.map((component) => component.id)
		);
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
			const result = await publishWorkingSnapshot(uiDefinition.logicalId, kind);
			const publishedLabel = formatPublishedVersionLabel(result.version, workingChangeReason);
			applyLoadedSnapshot(result.snapshot);
			await refreshListing(uiDefinition.logicalId);
			toast.info('確定しました', publishedLabel);
		} catch (error) {
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
			const snapshot = await loadWorkingSnapshotFromVersion(uiDefinition.logicalId, selectedVersion);
			applyLoadedSnapshot(snapshot);
			await refreshListing(uiDefinition.logicalId);
			toast.info('過去版を読み込みました', `${loadedLabel}（history をリセット）`);
		} catch (error) {
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
		<div class="w-44 min-w-0">
			<Label for="published-version-select">過去版</Label>
			<Select
				id="published-version-select"
				size="sm"
				items={versionItems}
				bind:value={selectedVersion}
				disabled={!canMutate || busy || versionItems.length === 0}
				placeholder="確定版がありません"
			/>
		</div>
		<Button
			size="sm"
			color="alternative"
			disabled={!canMutate || busy || selectedVersion === ''}
			onclick={() => void handleLoadVersion()}
		>
			読込
		</Button>
	</div>
	{#if listing.head}
		<p class="text-xs text-gray-500 dark:text-gray-400">HEAD: {headLabel}</p>
	{/if}
	{#if uiDefinition.basedOn}
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
