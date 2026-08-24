<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	type Props = {
		value?: string;
		/** エディタの高さ（px） */
		heightPx?: number;
	};

	let { value = $bindable(''), heightPx = 280 }: Props = $props();

	let host = $state<HTMLDivElement | undefined>();
	let editor: { getValue(): string; setValue(next: string); dispose(): void; layout(): void } | undefined;
	let applyingExternal = false;

	/**
	 * Monaco Markdown エディタを初期化する
	 */
	async function mountEditor(): Promise<void> {
		if (!host) {
			return;
		}

		const monaco = await import('monaco-editor');
		// WARN: ESM エントリは `esm/vs/editor/editor.main.js`。CSS は JS 側が `./editor.css` 等を import する。
		// `esm/vs/editor/editor.main.css` は存在しない（バンドル CSS は min/vs/editor/editor.main.css）。
		const editorWorker = await import('monaco-editor/esm/vs/editor/editor.worker?worker');

		self.MonacoEnvironment = {
			getWorker() {
				return new editorWorker.default();
			}
		};

		const dark = document.documentElement.classList.contains('dark');
		const instance = monaco.editor.create(host, {
			value,
			language: 'markdown',
			theme: dark ? 'vs-dark' : 'vs',
			minimap: { enabled: false },
			wordWrap: 'on',
			lineNumbers: 'on',
			scrollBeyondLastLine: false,
			automaticLayout: true,
			fontSize: 13,
			tabSize: 2
		});

		instance.onDidChangeModelContent(() => {
			if (applyingExternal) {
				return;
			}
			value = instance.getValue();
		});

		editor = instance;
	}

	$effect(() => {
		const next = value;
		if (!editor || editor.getValue() === next) {
			return;
		}
		applyingExternal = true;
		editor.setValue(next);
		applyingExternal = false;
	});

	onMount(() => {
		void mountEditor();
	});

	onDestroy(() => {
		editor?.dispose();
		editor = undefined;
	});
</script>

<div
	bind:this={host}
	class="overflow-hidden rounded-md border border-gray-200 dark:border-gray-600"
	style="height: {heightPx}px;"
></div>
