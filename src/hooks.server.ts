import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getLogger } from '$lib/server/logging/logger';

const httpLogger = getLogger('http');

/**
 * Vite / SvelteKit 内部リクエストはアクセスログから除外する
 */
function isNoisyInternalPath(pathname: string): boolean {
	return (
		pathname.startsWith('/@') ||
		pathname.startsWith('/_app') ||
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/node_modules') ||
		pathname.startsWith('/.svelte-kit')
	);
}

/**
 * 全 HTTP の around ログ（Filter 相当）。body は出さない
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (isNoisyInternalPath(event.url.pathname)) {
		return resolve(event);
	}

	const meta = {
		method: event.request.method,
		path: event.url.pathname
	};
	const startedAt = Date.now();
	httpLogger.info('request start', meta);

	try {
		const response = await resolve(event);
		httpLogger.info('request return', {
			...meta,
			status: response.status,
			durationMs: Date.now() - startedAt
		});
		return response;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		httpLogger.error('request throw', {
			...meta,
			durationMs: Date.now() - startedAt,
			errorMessage
		});
		throw error;
	}
};

/**
 * 未処理例外（hook まで throw が抜けた場合）
 */
export const handleError: HandleServerError = ({ error, event }) => {
	httpLogger.error('unhandled', {
		method: event.request.method,
		path: event.url.pathname,
		errorMessage: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined
	});
	return { message: 'Internal Error' };
};
