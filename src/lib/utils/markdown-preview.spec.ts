import { describe, expect, it } from 'vitest';
import { renderMarkdownPreview } from '$lib/utils/markdown-preview';

describe('markdown-preview', () => {
	it('renders headings, lists, and escaped HTML', () => {
		const html = renderMarkdownPreview('# 注意\n- <script>x</script>\n**強調**');
		expect(html).toContain('<h1>注意</h1>');
		expect(html).toContain('<ul><li>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('<strong>強調</strong>');
		expect(html).not.toContain('<script>');
	});
});
