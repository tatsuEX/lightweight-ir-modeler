import { describe, expect, it } from 'vitest';
import {
	buildTargetResidual,
	hasTargetResidual,
	normalizeExternalResidual,
	readTargetResidual
} from '$lib/ir/external-residual';

describe('buildTargetResidual', () => {
	it('collects unknown keys under the target namespace', () => {
		expect(
			buildTargetResidual(
				{ formId: 'myForm', formSystemId: 'SYS-1', revision: 3 },
				['formId'],
				'im-forma'
			)
		).toEqual({ 'im-forma': { formSystemId: 'SYS-1', revision: 3 } });
	});

	it('returns undefined when nothing is left over', () => {
		expect(buildTargetResidual({ formId: 'myForm' }, ['formId'], 'im-forma')).toBeUndefined();
		expect(buildTargetResidual('not an object', [], 'im-forma')).toBeUndefined();
	});

	it('drops prototype polluting keys', () => {
		const source = JSON.parse('{"__proto__": {"polluted": true}, "keep": 1}');
		expect(buildTargetResidual(source, [], 'im-forma')).toEqual({ 'im-forma': { keep: 1 } });
	});
});

describe('readTargetResidual', () => {
	it('reads the entry of the requested target only', () => {
		const residual = { 'im-forma': { a: 1 }, primefaces: { b: 2 } };
		expect(readTargetResidual(residual, 'im-forma')).toEqual({ a: 1 });
		expect(readTargetResidual(residual, 'unknown-target')).toEqual({});
		expect(readTargetResidual(null, 'im-forma')).toEqual({});
	});
});

describe('hasTargetResidual', () => {
	it('is true only when the target bag has at least one key', () => {
		expect(hasTargetResidual({ primefaces: { widgetVar: 'x' } }, 'primefaces')).toBe(true);
		expect(hasTargetResidual({ primefaces: {} }, 'primefaces')).toBe(false);
		expect(hasTargetResidual({ primefaces: { widgetVar: 'x' } }, 'im-forma')).toBe(false);
		expect(hasTargetResidual(undefined, 'primefaces')).toBe(false);
	});
});

describe('normalizeExternalResidual', () => {
	it('keeps only object entries with content', () => {
		expect(
			normalizeExternalResidual({ 'im-forma': { a: 1 }, empty: {}, broken: 'x' })
		).toEqual({ 'im-forma': { a: 1 } });
	});

	it('returns undefined for empty or invalid input', () => {
		expect(normalizeExternalResidual(undefined)).toBeUndefined();
		expect(normalizeExternalResidual({})).toBeUndefined();
		expect(normalizeExternalResidual([1, 2])).toBeUndefined();
	});
});
