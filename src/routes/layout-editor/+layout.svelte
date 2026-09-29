<script lang="ts">
	import LayoutEditorNav from '$lib/components/LayoutEditorNav.svelte';
	import MarkdownCommentModal from '$lib/components/MarkdownCommentModal.svelte';
	import SchemaMigrationConsentModal from '$lib/components/SchemaMigrationConsentModal.svelte';
	import { parseEditorMetaFromRecord } from '$lib/ir/ui-definition-meta';
	import { attachIrAutoSave } from '$lib/store/layout-editor/ir-auto-save.svelte';
	import {
		blockSchemaMigrationSave,
		dismissSchemaConsent,
		markSchemaMigrationConsent,
		pendingSchemaConsent,
		requestSchemaConsent
	} from '$lib/store/layout-editor/schema-migration-consent.svelte';
	import { getToastContext } from '$lib/store/toast/toast.svelte';
	import {
		createReactiveUIDefinition,
		setUIDefinitionContext
	} from '$lib/store/layout-editor/layout-editor.svelte';
	import {
		createSnapshotComments,
		setSnapshotCommentsContext
	} from '$lib/store/layout-editor/snapshot-comments.svelte';
	import {
		createPreviewTheme,
		setPreviewThemeContext
	} from '$lib/store/layout-editor/preview-theme.svelte';
	import {
		createTransformTarget,
		setTransformTargetContext
	} from '$lib/store/layout-editor/transform-target.svelte';
	import { setLayoutEditorConfigContext } from '$lib/store/layout-editor/layout-editor-config.svelte';

	let { data, children } = $props();

	/** layout-editor の状態は Context API 経由でのみ参照する */
	const uiDefinition = createReactiveUIDefinition(data.uiDefinition.logicalId, data.uiDefinition.name, data.uiDefinition.description, data.uiDefinition.version);
	setUIDefinitionContext(uiDefinition);

	const previewTheme = createPreviewTheme(data.preview.theme);
	setPreviewThemeContext(previewTheme);

	const transformTarget = createTransformTarget(data.preview.transformTarget);
	setTransformTargetContext(transformTarget);

	setLayoutEditorConfigContext(data.layoutEditor);

	const snapshotComments = createSnapshotComments();
	setSnapshotCommentsContext(snapshotComments);
	const toast = getToastContext();

	const consentPrompt = $derived(pendingSchemaConsent());
	let consentBusy = $state(false);

	let announcedSchemaBlock = false;

	if (data.schemaBlock && data.uiDefinition.logicalId) {
		blockSchemaMigrationSave(data.uiDefinition.logicalId);
		if (data.schemaBlock.code === 'schema-consent') {
			requestSchemaConsent({
				logicalId: data.uiDefinition.logicalId,
				rationales: data.schemaBlock.rationales,
				schemaVersion: data.schemaBlock.schemaVersion,
				latest: data.schemaBlock.latest
			});
		}
	}

	$effect(() => {
		const block = data.schemaBlock;
		if (!block || block.code === 'schema-consent' || announcedSchemaBlock) {
			return;
		}
		announcedSchemaBlock = true;
		toast.error('snapshot を読めません', block.error);
	});

	if (data.initialSnapshot) {
		uiDefinition.loadSnapshot(
			data.initialSnapshot,
			data.initialUiDefinition ?? undefined
		);
		snapshotComments.loadFromYamlMap(
			data.initialComments ?? {},
			uiDefinition.components.map((component) => component.id)
		);
	}

	attachIrAutoSave(uiDefinition, snapshotComments, data.autoSave);

	/**
	 * 同意後に current を migration 済みで読み込み、エディタへ載せる
	 */
	async function reloadConsentedSnapshot(logicalId: string): Promise<void> {
		const response = await fetch(
			`/api/ir/snapshot?logicalId=${encodeURIComponent(logicalId)}&confirmMigration=true`
		);
		if (!response.ok) {
			toast.error('snapshot の読み込みに失敗しました', `HTTP ${response.status}`);
			return;
		}

		const snapshot = (await response.json()) as {
			uiDefinition?: Record<string, unknown>;
			components?: unknown[];
			comments?: Record<string, string>;
		};
		uiDefinition.loadSnapshot(
			snapshot.components ?? [],
			snapshot.uiDefinition ? parseEditorMetaFromRecord(snapshot.uiDefinition) : undefined
		);
		snapshotComments.loadFromYamlMap(
			snapshot.comments ?? {},
			uiDefinition.components.map((component) => component.id)
		);
	}

	/**
	 * 破壊的 migration に同意する
	 */
	async function acceptSchemaConsent(): Promise<void> {
		const prompt = pendingSchemaConsent();
		if (!prompt || consentBusy) {
			return;
		}

		consentBusy = true;
		try {
			markSchemaMigrationConsent(prompt.logicalId);
			const retry = dismissSchemaConsent();
			if (retry) {
				retry();
				return;
			}
			await reloadConsentedSnapshot(prompt.logicalId);
		} finally {
			consentBusy = false;
		}
	}

	/**
	 * 同意を見送る。自動保存は止めたままにする
	 */
	function declineSchemaConsent(): void {
		dismissSchemaConsent();
	}
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-6">
	<div class="mb-4 shrink-0">
		<LayoutEditorNav />
	</div>
	<div class="min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</div>
	<MarkdownCommentModal />
	<SchemaMigrationConsentModal
		open={consentPrompt !== null}
		rationales={consentPrompt?.rationales ?? []}
		busy={consentBusy}
		onConfirm={() => {
			void acceptSchemaConsent();
		}}
		onCancel={declineSchemaConsent}
	/>
</div>
