import { describe, expect, it } from 'vitest';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { errorLogMeta, runLogged, type AppLogger } from '$lib/server/logging/logger';

/**
 * 記録用のテスト logger
 */
function createRecordingLogger(): { logger: AppLogger; lines: string[] } {
	const lines: string[] = [];
	const logger: AppLogger = {
		debug: (message) => {
			lines.push(`debug:${message}`);
		},
		info: (message) => {
			lines.push(`info:${message}`);
		},
		warn: (message) => {
			lines.push(`warn:${message}`);
		},
		error: (message) => {
			lines.push(`error:${message}`);
		}
	};
	return { logger, lines };
}

describe('runLogged', () => {
	it('logs start and return on success', () => {
		const { logger, lines } = createRecordingLogger();
		const result = runLogged(logger, 'sampleOp', { targetId: 'primefaces' }, () => 42);

		expect(result).toBe(42);
		expect(lines[0]).toBe('info:sampleOp start');
		expect(lines[1]).toBe('info:sampleOp return');
	});

	it('logs throw and rethrows', () => {
		const { logger, lines } = createRecordingLogger();

		expect(() =>
			runLogged(logger, 'sampleOp', {}, () => {
				throw new Error('boom');
			})
		).toThrow('boom');

		expect(lines[0]).toBe('info:sampleOp start');
		expect(lines[1]).toBe('error:sampleOp throw');
	});

	it('logs expected operational errors as warn', () => {
		const { logger, lines } = createRecordingLogger();

		expect(() =>
			runLogged(logger, 'sampleOp', {}, () => {
				throw new RawValidationError('im-forma', [{ path: 'items', message: 'invalid' }]);
			})
		).toThrow('invalid');

		expect(lines[0]).toBe('info:sampleOp start');
		expect(lines[1]).toBe('warn:sampleOp throw');
	});

	it('awaits async return', async () => {
		const { logger, lines } = createRecordingLogger();
		const result = await runLogged(logger, 'asyncOp', {}, async () => 'ok');

		expect(result).toBe('ok');
		expect(lines).toEqual(['info:asyncOp start', 'info:asyncOp return']);
	});
});

describe('errorLogMeta', () => {
	it('extracts name and message from Error', () => {
		const meta = errorLogMeta(new Error('failed'));
		expect(meta.errorName).toBe('Error');
		expect(meta.errorMessage).toBe('failed');
	});
});
