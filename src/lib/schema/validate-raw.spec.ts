import { afterEach, describe, expect, it } from 'vitest';
import {
	getRawZodSchema,
	hasCachedRawZodSchema,
	invalidateRawZodSchema,
	readRawJsonSchema
} from '$lib/schema/json-schema-loader';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { validateRawDefinition } from '$lib/schema/validate-raw';
import { resetZodLocaleForTests } from '$lib/schema/zod-locale';
import { transformToImFormaRaw } from '$lib/transform/im-forma-transform';
import { transformToPrimeFacesRaw } from '$lib/transform/primefaces-transform';

const meta = {
	logicalId: 'myForm',
	name: 'My Form',
	description: 'demo',
	version: '1.0.0'
};

const components = [
	{
		logicalId: 'name',
		type: 'textbox',
		label: 'Name',
		validation: { required: true }
	}
];

describe('validateRawDefinition', () => {
	afterEach(() => {
		invalidateRawZodSchema();
		resetZodLocaleForTests();
	});

	it('accepts transform output for primefaces and im-forma', () => {
		expect(() =>
			validateRawDefinition('primefaces', transformToPrimeFacesRaw(meta, components))
		).not.toThrow();
		expect(() =>
			validateRawDefinition('im-forma', transformToImFormaRaw(meta, components))
		).not.toThrow();
	});

	it('rejects invalid raw with issues', () => {
		expect(() =>
			validateRawDefinition('primefaces', {
				target: 'primefaces',
				logicalId: '',
				name: 'X',
				fields: [{ type: 'textbox' }]
			})
		).toThrow(RawValidationError);

		try {
			validateRawDefinition('primefaces', {
				target: 'wrong',
				logicalId: 'myForm',
				name: 'X',
				fields: []
			});
			expect.unreachable('should throw');
		} catch (error) {
			expect(error).toBeInstanceOf(RawValidationError);
			const validationError = error as RawValidationError;
			expect(validationError.issues.length).toBeGreaterThan(0);
			expect(validationError.issues.some((issue) => issue.path.includes('target'))).toBe(true);
		}
	});

	it('loads schema on first target access and reuses cache until invalidate', () => {
		expect(hasCachedRawZodSchema('primefaces')).toBe(false);

		const schema1 = getRawZodSchema('primefaces');
		expect(hasCachedRawZodSchema('primefaces')).toBe(true);

		const schema2 = getRawZodSchema('primefaces');
		expect(schema1).toBe(schema2);

		invalidateRawZodSchema('primefaces');
		expect(hasCachedRawZodSchema('primefaces')).toBe(false);

		const schema3 = getRawZodSchema('primefaces');
		expect(schema3).not.toBe(schema1);
		expect(hasCachedRawZodSchema('primefaces')).toBe(true);
	});

	it('reads whitelist schema files as objects', () => {
		const primefaces = readRawJsonSchema('primefaces');
		expect(primefaces.title).toBe('PrimeFaces RawDefinition');
		expect(primefaces.required).toEqual(
			expect.arrayContaining(['target', 'logicalId', 'name', 'fields'])
		);

		const imForma = readRawJsonSchema('im-forma');
		expect(imForma.title).toBe('IM-Forma RawDefinition');
		expect(imForma.required).toEqual(
			expect.arrayContaining(['target', 'logicalId', 'name', 'items'])
		);
	});
});
