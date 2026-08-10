import { json } from '@sveltejs/kit';
import { RawValidationError } from '$lib/schema/raw-validation-error';
import { DefinitionReadError } from '$lib/server/io/readers/definition-reader';
import { importFromUploadedFile } from '$lib/server/ui/import-pipeline';
import { resolveImportTargetBundle } from '$lib/server/ui/import-target-registry';
import type { RequestHandler } from './$types';

/** 取り込み可能なアップロードサイズ上限 */
const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

/**
 * アップロードされた外部 UI 定義ファイルを IR へ取り込んで返す
 */
export const POST: RequestHandler = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'multipart/form-data ではありません' }, { status: 400 });
	}

	const target = typeof form.get('target') === 'string' ? String(form.get('target')).trim() : '';
	if (!target || !resolveImportTargetBundle(target)) {
		return json({ error: '未対応または未指定の target です' }, { status: 400 });
	}

	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) {
		return json({ error: 'file が指定されていません' }, { status: 400 });
	}
	if (file.size > MAX_IMPORT_FILE_BYTES) {
		return json(
			{ error: `ファイルサイズが上限（${MAX_IMPORT_FILE_BYTES} bytes）を超えています` },
			{ status: 400 }
		);
	}

	try {
		const imported = importFromUploadedFile(target, {
			filename: file.name,
			content: await file.text()
		});

		return json({ target, ...imported });
	} catch (error) {
		if (error instanceof RawValidationError) {
			return json(
				{ error: error.message, target: error.targetId, issues: error.issues },
				{ status: 400 }
			);
		}
		if (error instanceof DefinitionReadError) {
			return json({ error: error.message, target: error.targetId }, { status: 400 });
		}
		console.warn('[api/ui/import] import failed:', error);
		return json({ error: '外部 UI 定義の取り込みに失敗しました' }, { status: 500 });
	}
};
