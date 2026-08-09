import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfig = vi.hoisted(() => ({
	loadApplicationConfig: vi.fn()
}));

vi.mock('$lib/server/config/application-config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config/application-config')>();
	return {
		...actual,
		loadApplicationConfig: mockConfig.loadApplicationConfig,
		resolveExportTemplateDir: (targetId: string) => {
			const dir =
				mockConfig.loadApplicationConfig().app.io?.export?.templates?.[targetId]?.dir?.trim();
			if (!dir) {
				throw new Error(
					`application config "app.io.export.templates.${targetId}.dir" is not configured`
				);
			}
			return actual.resolveApplicationPath(dir);
		}
	};
});

import {
	clearHandlebarsTemplateCache,
	resolveComponentTemplateFile
} from '$lib/server/io/writers/serialize/serialize-handlebars';

describe('resolveComponentTemplateFile', () => {
	beforeEach(() => {
		mockConfig.loadApplicationConfig.mockReturnValue({
			app: {
				name: 'test',
				io: {
					export: {
						templates: {
							primefaces: {
								dir: resolve(process.cwd(), 'templates/export/primefaces')
							}
						}
					}
				}
			},
			preview: {
				theme: { default: 'tailwind-dark', options: [{ name: 'Dark', value: 'tailwind-dark' }] },
				transformTarget: {
					default: 'primefaces',
					options: [{ name: 'PF', value: 'primefaces' }]
				}
			}
		});
	});

	afterEach(() => {
		clearHandlebarsTemplateCache();
		vi.clearAllMocks();
	});

	it('resolves known component types', () => {
		expect(resolveComponentTemplateFile('primefaces', 'textbox')).toBe('components/textbox.hbs');
		expect(resolveComponentTemplateFile('primefaces', 'textarea')).toBe(
			'components/textarea.hbs'
		);
		expect(resolveComponentTemplateFile('primefaces', 'number')).toBe('components/number.hbs');
		expect(resolveComponentTemplateFile('primefaces', 'checkbox')).toBe(
			'components/checkbox.hbs'
		);
		expect(resolveComponentTemplateFile('primefaces', 'dropdown-multi')).toBe(
			'components/dropdown-multi.hbs'
		);
		expect(resolveComponentTemplateFile('primefaces', 'datepicker')).toBe(
			'components/datepicker.hbs'
		);
		expect(resolveComponentTemplateFile('primefaces', 'date-span')).toBe(
			'components/date-span.hbs'
		);
	});

	it('falls back to unsupported for unknown or unsafe types', () => {
		expect(resolveComponentTemplateFile('primefaces', 'not-a-real-type')).toBe(
			'components/unsupported.hbs'
		);
		expect(resolveComponentTemplateFile('primefaces', '../etc/passwd')).toBe(
			'components/unsupported.hbs'
		);
		expect(resolveComponentTemplateFile('primefaces', '')).toBe('components/unsupported.hbs');
	});
});
