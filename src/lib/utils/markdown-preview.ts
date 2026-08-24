import { escapeHtml } from '$lib/utils/escape-html';

/**
 * インライン Markdown を HTML にする（先に escape 済みのテキスト）
 */
function renderInlineMarkdown(escaped: string): string {
	const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
	const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	const withItalic = withBold.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
	return withItalic.replace(
		/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
		'<a href="$2" rel="noreferrer noopener" target="_blank">$1</a>'
	);
}

/**
 * 運用コメントの Markdown を tooltip 用 HTML にする
 *
 * WARN: 入力は escapeHtml してから装飾する。生 HTML は通さない。
 */
export function renderMarkdownPreview(markdown: string): string {
	const trimmed = markdown.replace(/\s+$/u, '');
	if (trimmed.trim() === '') {
		return '';
	}

	const lines = trimmed.replaceAll('\r\n', '\n').split('\n');
	const blocks: string[] = [];
	let listItems: string[] = [];

	/**
	 * 溜まっているリストを吐き出す
	 */
	function flushList(): void {
		if (listItems.length === 0) {
			return;
		}
		blocks.push(`<ul>${listItems.join('')}</ul>`);
		listItems = [];
	}

	for (const line of lines) {
		const heading = line.match(/^(#{1,3})\s+(.*)$/);
		if (heading) {
			flushList();
			const level = heading[1].length;
			blocks.push(`<h${level}>${renderInlineMarkdown(escapeHtml(heading[2]))}</h${level}>`);
			continue;
		}

		const list = line.match(/^[-*]\s+(.*)$/);
		if (list) {
			listItems.push(`<li>${renderInlineMarkdown(escapeHtml(list[1]))}</li>`);
			continue;
		}

		flushList();
		if (line.trim() === '') {
			continue;
		}
		blocks.push(`<p>${renderInlineMarkdown(escapeHtml(line))}</p>`);
	}

	flushList();
	return blocks.join('');
}
