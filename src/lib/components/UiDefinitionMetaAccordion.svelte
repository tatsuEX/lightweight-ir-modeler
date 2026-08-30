<script lang="ts">
	import { onMount } from 'svelte';
	import { Accordion, AccordionItem, Input, Label, Textarea } from 'flowbite-svelte';
	import Autocomplete from '$lib/components/Autocomplete.svelte';
	import ConfirmNewSnapshotDirModal from '$lib/components/ConfirmNewSnapshotDirModal.svelte';
	import YamlCommentButton from '$lib/components/YamlCommentButton.svelte';
	import { UI_DEFINITION_COMMENT_KEY } from '$lib/ir/snapshot-comment-map';
	import { isUiDefinitionMetaReady, isValidLogicalId, toEditorMeta } from '$lib/ir/ui-definition-meta';
	import { getLayoutEditorConfigContext } from '$lib/store/layout-editor/layout-editor-config.svelte';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';
	import { getSnapshotCommentsContext } from '$lib/store/layout-editor/snapshot-comments.svelte';
	import { getToastContext } from '$lib/store/toast/toast.svelte';
	import {
		setSnapshotDirConfirmSkippedByUser,
		shouldPromptNewSnapshotDir,
		snapshotDirectoryExists
	} from '$lib/store/layout-editor/snapshot-dir-confirm';

	/** 画面定義の状態は Context API 経由でのみ参照する */
	const uiDefinition = getUIDefinitionContext();
	const layoutEditorConfig = getLayoutEditorConfigContext();
	const snapshotComments = getSnapshotCommentsContext();
	const toast = getToastContext();

	let metaOpen = $state(true);
	let logicalIdOptions = $state<string[]>([]);
	/** logicalId 入力中か（true の間だけ draft を表示・編集する） */
	let editingLogicalId = $state(false);
	/** 入力中の logicalId（blur / 候補選択確定時のみ store へ反映する） */
	let logicalIdDraft = $state('');

	let confirmOpen = $state(false);
	let confirmInitialId = $state('');
	/** 確認キャンセル時に戻す画面 ID */
	let confirmPreviousId = $state('');
	let confirmBusy = $state(false);

	/** 非編集中は store を表示し、import / loadSnapshot 後の値をそのまま反映する */
	const logicalIdField = $derived(
		editingLogicalId ? logicalIdDraft : uiDefinition.logicalId
	);

	const accordionHeader = $derived(
		isUiDefinitionMetaReady(uiDefinition)
			? `${uiDefinition.name} (${uiDefinition.logicalId}) - ver. ${uiDefinition.version}`
			: '画面の基本情報を入力'
	);

	const fieldClass = 'flex flex-col gap-1';

	/**
	 * autocomplete 用 logicalId 一覧を取得する
	 */
	async function loadLogicalIdOptions(): Promise<void> {
		try {
			const response = await fetch('/api/ir/snapshot/logical-ids');
			if (!response.ok) {
				toast.warn('画面 ID 一覧を取得できませんでした', `HTTP ${response.status}`);
				return;
			}

			const payload = (await response.json()) as { logicalIds?: string[] };
			logicalIdOptions = payload.logicalIds ?? [];
		} catch (error) {
			console.warn('[UiDefinitionMetaAccordion] failed to load logicalId options:', error);
			const detail = error instanceof Error ? error.message : String(error);
			toast.warn('画面 ID 一覧を取得できませんでした', detail);
		}
	}

	/**
	 * logicalId の編集を開始し、draft を store の現在値で初期化する
	 */
	function beginLogicalIdEdit(): void {
		if (editingLogicalId || confirmOpen) {
			return;
		}
		logicalIdDraft = uiDefinition.logicalId;
		editingLogicalId = true;
	}

	/**
	 * Autocomplete からの入力を draft へ反映する
	 */
	function handleLogicalIdInput(next: string): void {
		if (confirmOpen) {
			return;
		}
		if (!editingLogicalId) {
			editingLogicalId = true;
		}
		logicalIdDraft = next;
	}

	/**
	 * logicalId 変更確定後、当該 snapshot ディレクトリから UI 定義を復元する
	 */
	async function restoreFromSnapshotDirectory(logicalId: string): Promise<void> {
		if (!isValidLogicalId(logicalId)) {
			return;
		}

		try {
			const response = await fetch(`/api/ir/snapshot?logicalId=${encodeURIComponent(logicalId)}`);
			if (response.status === 404) {
				// WARN: 404 時は現状維持（コピー作成ユースケースで中身を引き継ぐ）
				return;
			}
			if (!response.ok) {
				console.warn('[UiDefinitionMetaAccordion] failed to restore snapshot:', response.status);
				toast.error('snapshot の復元に失敗しました', `HTTP ${response.status}`);
				return;
			}

			const snapshot = (await response.json()) as {
				uiDefinition?: {
					logicalId: string;
					name: string;
					description: string;
					version: string;
					createdAt?: string;
					modifiedAt?: string;
					external?: unknown;
				};
				components?: unknown[];
				comments?: Record<string, string>;
			};

			editingLogicalId = false;
			uiDefinition.loadSnapshot(
				snapshot.components ?? [],
				snapshot.uiDefinition ? toEditorMeta(snapshot.uiDefinition) : undefined
			);
			snapshotComments.loadFromYamlMap(
				snapshot.comments ?? {},
				uiDefinition.components.map((component) => component.id)
			);
		} catch (error) {
			console.warn('[UiDefinitionMetaAccordion] failed to restore snapshot:', error);
			const detail = error instanceof Error ? error.message : String(error);
			toast.error('snapshot の復元に失敗しました', detail);
		}
	}

	/**
	 * 新しい画面 ID を確定する（既存 snapshot があれば復元）
	 */
	async function applyLogicalIdChange(nextId: string, previousId: string): Promise<void> {
		uiDefinition.logicalId = nextId;
		if (nextId === previousId) {
			return;
		}
		await restoreFromSnapshotDirectory(nextId);
		void loadLogicalIdOptions();
	}

	/**
	 * logicalId の入力確定（blur / 候補選択）を処理する
	 */
	async function handleLogicalIdCommit(): Promise<void> {
		if (!editingLogicalId || confirmOpen || confirmBusy) {
			return;
		}

		const previousId = uiDefinition.logicalId;
		const trimmed = logicalIdDraft.trim();
		logicalIdDraft = trimmed;
		editingLogicalId = false;

		if (trimmed === previousId) {
			return;
		}

		// ▽▽▽ メタlogicalIdが入力変更された ▽▽▽

		// 入力中のlogicalIdが有効でない場合はメモリ上のUIDefinitionにのみ反映し、snapshot API へは反映しない
		if (!isValidLogicalId(trimmed)) {
			uiDefinition.logicalId = trimmed;
			return;
		}

		confirmBusy = true;
		try {
			const exists = await snapshotDirectoryExists(trimmed);
			if (exists) {
				await applyLogicalIdChange(trimmed, previousId);
				return;
			}

			if (
				!shouldPromptNewSnapshotDir(layoutEditorConfig.property.confirmSnapshotDirCreation)
			) {
				await applyLogicalIdChange(trimmed, previousId);
				return;
			}

			confirmPreviousId = previousId;
			confirmInitialId = trimmed;
			confirmOpen = true;
		} catch (error) {
			console.warn('[UiDefinitionMetaAccordion] snapshot check failed:', error);
			const detail = error instanceof Error ? error.message : String(error);
			toast.warn('snapshot の確認に失敗しました', detail);
			await applyLogicalIdChange(trimmed, previousId);
		} finally {
			confirmBusy = false;
		}
	}

	/**
	 * 新規 snapshot ディレクトリ確認で続行する
	 */
	async function handleConfirmContinue(logicalId: string, dontAskAgain: boolean): Promise<void> {
		if (dontAskAgain) {
			setSnapshotDirConfirmSkippedByUser(true);
		}
		confirmOpen = false;
		const previousId = confirmPreviousId;
		await applyLogicalIdChange(logicalId, previousId);
	}

	/**
	 * 新規 snapshot ディレクトリ確認をキャンセルする
	 */
	function handleConfirmCancel(): void {
		confirmOpen = false;
		logicalIdDraft = confirmPreviousId;
		editingLogicalId = false;
	}

	onMount(() => {
		void loadLogicalIdOptions();
	});
</script>

<div class="relative mb-4">
	<Accordion>
	<AccordionItem
		class="!m-0"
		bind:open={metaOpen}
		classes={{
			button: '!py-2 !px-4 text-sm font-medium',
			content: '!p-0'
		}}
	>
		{#snippet header()}
			<span class="pl-12 pr-10">{accordionHeader}</span>
		{/snippet}

		<div class="grid gap-3 border-t border-gray-200 p-4 md:grid-cols-2 dark:border-gray-700">
			<div class={fieldClass}>
				<Label for="ui-definition-logical-id">
					ID <span class="text-red-600 dark:text-red-400">*</span>
				</Label>
				<Autocomplete
					id="ui-definition-logical-id"
					required
					placeholder="画面 ID"
					aria-label="画面定義 ID"
					options={logicalIdOptions}
					debounceMs={300}
					value={logicalIdField}
					onfocus={beginLogicalIdEdit}
					oninput={handleLogicalIdInput}
					onblur={() => void handleLogicalIdCommit()}
					onselect={() => void handleLogicalIdCommit()}
				/>
			</div>

			<div class={fieldClass}>
				<Label for="ui-definition-name">
					画面名 <span class="text-red-600 dark:text-red-400">*</span>
				</Label>
				<Input
					id="ui-definition-name"
					size="sm"
					required
					placeholder="画面名"
					aria-label="画面名"
					bind:value={uiDefinition.name}
				/>
			</div>

			<div class="{fieldClass} md:col-span-2">
				<Label for="ui-definition-description">説明</Label>
				<Textarea
					id="ui-definition-description"
					class="w-full"
					rows={4}
					placeholder="画面の説明"
					aria-label="画面の説明"
					bind:value={uiDefinition.description}
				/>
			</div>

			<div class={fieldClass}>
				<Label for="ui-definition-version">version</Label>
				<Input
					id="ui-definition-version"
					size="sm"
					placeholder="1.0.0"
					aria-label="画面定義 version"
					bind:value={uiDefinition.version}
				/>
			</div>
		</div>
	</AccordionItem>
	</Accordion>
	<div class="absolute top-2 left-3 z-20">
		<YamlCommentButton
			ownerKey={UI_DEFINITION_COMMENT_KEY}
			title="uiDefinition"
			ariaLabel="画面定義の運用コメント"
		/>
	</div>
</div>

<ConfirmNewSnapshotDirModal
	bind:open={confirmOpen}
	initialId={confirmInitialId}
	onConfirm={(logicalId, dontAskAgain) => void handleConfirmContinue(logicalId, dontAskAgain)}
	onCancel={handleConfirmCancel}
/>
