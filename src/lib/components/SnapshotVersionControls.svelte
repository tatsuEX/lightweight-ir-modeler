<script lang="ts">
	import { Button, Label, Select, type SelectOptionType } from 'flowbite-svelte';
	import ConfirmPublishKindModal from '$lib/components/ConfirmPublishKindModal.svelte';
	import { isUiDefinitionMetaReady, isValidLogicalId, toEditorMeta } from '$lib/ir/ui-definition-meta';
	import {
		needsPublishKindChoice,
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

	let listing = $state<PublishedVersionsListing>({ versions: [], head: null, selectable: [] });
	let selectedVersion = $state('');
	let busy = $state(false);
	let kindModalOpen = $state(false);

	const canMutate = $derived(isUiDefinitionMetaReady(uiDefinition) && isValidLogicalId(uiDefinition.logicalId));
	const choiceNeeded = $derived(needsPublishKindChoice(listing.versions, uiDefinition.basedOn));
	const patchVersion = $derived(
		choiceNeeded ? resolveNextPublishedVersion(listing.versions, uiDefinition.basedOn, 'patch') : ''
	);
	const newHeadVersion = $derived(
		choiceNeeded ? resolveNextPublishedVersion(listing.versions, uiDefinition.basedOn, 'new-head') : ''
	);
	const revisionVersion = $derived(
		choiceNeeded ? '' : resolveNextPublishedVersion(listing.versions, uiDefinition.basedOn, 'revision')
	);
	const versionItems = $derived<SelectOptionType<string>[]>(
		listing.selectable.map((version) => ({
			value: version,
			name: version === listing.head ? `${version} (HEAD)` : version
		}))
	);

	$effect(() => {
		const logicalId = uiDefinition.logicalId;
		if (!isValidLogicalId(logicalId)) {
			listing = { versions: [], head: null, selectable: [] };
			selectedVersion = '';
			return;
		}

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
			applyLoadedSnapshot(result.snapshot);
			await refreshListing(uiDefinition.logicalId);
			toast.info('確定しました', `v${result.version}`);
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
		if (choiceNeeded) {
			kindModalOpen = true;
			return;
		}

		void publishWithKind('revision');
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
			const snapshot = await loadWorkingSnapshotFromVersion(uiDefinition.logicalId, selectedVersion);
			applyLoadedSnapshot(snapshot);
			await refreshListing(uiDefinition.logicalId);
			toast.info('過去版を読み込みました', `v${selectedVersion}（history をリセット）`);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			toast.error('過去版の読込に失敗しました', detail);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-wrap items-end gap-2">
		<Button size="sm" color="primary" disabled={!canMutate || busy} onclick={handlePublish}>
			{revisionVersion ? `確定（→ ${revisionVersion}）` : '確定'}
		</Button>
	</div>
	<div class="flex flex-wrap items-end gap-2">
		<div class="min-w-40 flex-1">
			<Label for="published-version-select">確定版</Label>
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
		<p class="text-xs text-gray-500 dark:text-gray-400">HEAD: {listing.head}</p>
	{/if}
	{#if uiDefinition.basedOn}
		<p class="text-xs text-gray-500 dark:text-gray-400">basedOn: {uiDefinition.basedOn}</p>
	{/if}
</div>

<ConfirmPublishKindModal
	bind:open={kindModalOpen}
	patchVersion={patchVersion}
	newHeadVersion={newHeadVersion}
	{busy}
	onConfirm={(kind) => void publishWithKind(kind)}
	onCancel={() => {
		kindModalOpen = false;
	}}
/>
