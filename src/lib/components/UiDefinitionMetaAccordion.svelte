<script lang="ts">
	import { onMount } from 'svelte';
	import { Accordion, AccordionItem, Input, Label, Textarea } from 'flowbite-svelte';
	import Autocomplete from '$lib/components/Autocomplete.svelte';
	import { isUiDefinitionMetaReady, isValidLogicalId, toEditorMeta } from '$lib/ir/ui-definition-meta';
	import { getUIDefinitionContext } from '$lib/store/layout-editor/layout-editor.svelte';

	/** 画面定義の状態は Context API 経由でのみ参照する */
	const uiDefinition = getUIDefinitionContext();

	let metaOpen = $state(true);
	let logicalIdOptions = $state<string[]>([]);
	/** 入力中の logicalId（blur / 候補選択確定時のみ store へ反映する） */
	let logicalIdInput = $state(uiDefinition.logicalId);

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
				return;
			}

			const payload = (await response.json()) as { logicalIds?: string[] };
			logicalIdOptions = payload.logicalIds ?? [];
		} catch (error) {
			console.warn('[UiDefinitionMetaAccordion] failed to load logicalId options:', error);
		}
	}

	/**
	 * 入力中 logicalId を store へ確定反映する
	 * @returns logicalId が前回確定値から変わった場合 true
	 */
	function commitLogicalIdInput(): boolean {
		const trimmed = logicalIdInput.trim();
		logicalIdInput = trimmed;
		if (trimmed === uiDefinition.logicalId) {
			return false;
		}
		uiDefinition.logicalId = trimmed;
		return true;
	}

	/**
	 * logicalId 変更確定後、当該 snapshot ディレクトリから UI 定義を復元する
	 */
	async function restoreFromSnapshotDirectory(): Promise<void> {
		const logicalId = uiDefinition.logicalId.trim();
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
				};
				components?: unknown[];
			};

			uiDefinition.loadSnapshot(
				snapshot.components ?? [],
				snapshot.uiDefinition ? toEditorMeta(snapshot.uiDefinition) : undefined
			);
			logicalIdInput = uiDefinition.logicalId;
		} catch (error) {
			console.warn('[UiDefinitionMetaAccordion] failed to restore snapshot:', error);
		}
	}

	/**
	 * logicalId の入力確定（blur / 候補選択）を処理する
	 */
	function handleLogicalIdCommit(): void {
		if (!commitLogicalIdInput()) {
			return;
		}
		void restoreFromSnapshotDirectory();
	}

	onMount(() => {
		void loadLogicalIdOptions();
	});
</script>

<Accordion class="mb-4">
	<AccordionItem
		class="!m-0"
		bind:open={metaOpen}
		classes={{
			button: '!py-2 !px-4 text-sm font-medium',
			content: '!p-0'
		}}
	>
		{#snippet header()}
			{accordionHeader}
		{/snippet}

		<div class="grid gap-3 border-t border-gray-200 p-4 md:grid-cols-2 dark:border-gray-700">
			<div class={fieldClass}>
				<Label for="ui-definition-logical-id">
					ID <span class="text-red-600 dark:text-red-400">*</span>
				</Label>
				<Autocomplete
					id="ui-definition-logical-id"
					required
					placeholder="logicalId"
					aria-label="画面定義 ID"
					options={logicalIdOptions}
					debounceMs={300}
					bind:value={logicalIdInput}
					onblur={handleLogicalIdCommit}
					onselect={handleLogicalIdCommit}
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
