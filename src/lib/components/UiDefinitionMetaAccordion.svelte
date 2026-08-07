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
	 * logicalId 確定時に既存 snapshot があれば hydrate する
	 */
	async function tryHydrateFromLogicalId(): Promise<void> {
		const logicalId = uiDefinition.logicalId.trim();
		if (!isValidLogicalId(logicalId)) {
			return;
		}
		if (uiDefinition.components.length > 0 || uiDefinition.name.trim().length > 0) {
			return;
		}

		try {
			const response = await fetch(`/api/ir/snapshot?logicalId=${encodeURIComponent(logicalId)}`);
			if (!response.ok) {
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
		} catch (error) {
			console.warn('[UiDefinitionMetaAccordion] failed to hydrate snapshot:', error);
		}
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
					bind:value={uiDefinition.logicalId}
					onblur={() => {
						void tryHydrateFromLogicalId();
					}}
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
					rows={2}
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
