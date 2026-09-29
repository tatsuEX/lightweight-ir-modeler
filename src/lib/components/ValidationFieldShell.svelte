<script lang="ts">
	import type { Snippet } from 'svelte';
	import { issuesUnderPath } from '$lib/ir/ui-definition-validation/validate-ui-definition';
	import { getUiDefinitionValidationContext } from '$lib/store/layout-editor/ui-definition-validation.svelte';

	type Props = {
		path: string;
		mode?: 'editable' | 'hidden' | 'disabled';
		children: Snippet;
	};

	let { path, mode = 'editable', children }: Props = $props();

	const validation = getUiDefinitionValidationContext();
	const issues = $derived(path === '' ? [] : issuesUnderPath(validation.report.issues, path));
	const invalid = $derived(issues.length > 0);
	const invalidClass =
		'rounded-md border border-red-300 bg-red-50 p-0 dark:border-red-700 dark:bg-red-950/40 [&_input]:border-red-300 [&_input]:bg-red-50 dark:[&_input]:border-red-700 dark:[&_input]:bg-red-950/40 [&_textarea]:border-red-300 [&_textarea]:bg-red-50 dark:[&_textarea]:border-red-700 dark:[&_textarea]:bg-red-950/40';
</script>

{#if mode !== 'hidden'}
	<!-- WARN: 詳細文言は issue ごと Toast（自動消去）。ここでは背景・枠だけで箇所を示す。 -->
	<div
		class={invalid ? invalidClass : ''}
		aria-invalid={invalid ? 'true' : undefined}
		inert={mode === 'disabled' ? true : undefined}
	>
		{@render children()}
	</div>
{/if}
