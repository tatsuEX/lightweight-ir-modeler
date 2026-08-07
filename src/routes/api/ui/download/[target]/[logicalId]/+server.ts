import { json } from '@sveltejs/kit';
import { isValidLogicalId } from '$lib/ir/ui-definition-meta';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { loadApplicationConfig } from '$lib/server/config/application-config';
import {
	hasExportedDefinition,
	readExportedDefinition
} from '$lib/server/io/definition-export-io';
import { exportFromLatestSnapshot } from '$lib/server/ui/export-pipeline';
import { resolveExportTargetBundle } from '$lib/server/ui/export-target-registry';
import type { RequestHandler } from './$types';

/**
 * 外部 UI 定義ファイルをダウンロードする（未出力時は最新 snapshot から export）
 */
export const GET: RequestHandler = async ({ params }) => {
	const config = loadApplicationConfig();
	if (!config.app.io?.exportDir) {
		return json({ error: 'app.io.exportDir is not configured' }, { status: 403 });
	}

	const target = params.target?.trim() ?? '';
	const logicalId = params.logicalId?.trim() ?? '';
	const bundle = resolveExportTargetBundle(target);

	if (!bundle) {
		return json({ error: 'unsupported target' }, { status: 400 });
	}
	if (!isValidLogicalId(logicalId)) {
		return json({ error: 'logicalId is required and must be a valid identifier' }, { status: 400 });
	}

	try {
		// ファイル名・MIME は Writer 固有知識（IO / API は拡張子を解釈しない）
		const identity = bundle.writer.describeArtifact(logicalId);
		let autoExported = false;

		if (!(await hasExportedDefinition(target, logicalId, identity.filename))) {
			await exportFromLatestSnapshot(target, logicalId);
			autoExported = true;
		}

		const exported = await readExportedDefinition(target, logicalId, identity.filename);
		if (!exported) {
			return json({ error: 'exported file not found' }, { status: 404 });
		}

		return new Response(exported.content, {
			status: 200,
			headers: {
				'Content-Type': identity.contentType,
				'Content-Disposition': `attachment; filename="${exported.filename}"`,
				'X-Ui-Export-Auto': autoExported ? 'true' : 'false',
				'X-Ui-Export-Source': autoExported ? 'snapshot' : 'existing'
			}
		});
	} catch (error) {
		if (error instanceof RawValidationError) {
			return json(
				{ error: error.message, target: error.targetId, issues: error.issues },
				{ status: 400 }
			);
		}

		const message = error instanceof Error ? error.message : '';
		if (message.includes('snapshot not found')) {
			return json({ error: 'snapshot not found; export first or save a snapshot' }, { status: 404 });
		}

		console.warn('[api/ui/download] failed:', error);
		return json({ error: 'failed to download UI definition' }, { status: 500 });
	}
};
