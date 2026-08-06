import { redirect } from '@sveltejs/kit';

/**
 * Layout Editor 直下は Property タブへ誘導する
 */
export function load() {
	throw redirect(302, '/layout-editor/property');
}
