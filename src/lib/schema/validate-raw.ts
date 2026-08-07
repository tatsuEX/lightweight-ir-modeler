import type { RawDefinition } from '$lib/raw/raw-definition';
import { getRawZodSchema } from '$lib/schema/json-schema-loader';
import {
	formatZodIssuePath,
	RawValidationError,
	type RawValidationIssue
} from '$lib/schema/raw-validation-error';

/**
 * target 別 JSON Schema（Zod 変換済み）で RawDefinition を検証する
 * 失敗時は RawValidationError を投げる
 */
export function validateRawDefinition(targetId: string, raw: RawDefinition): void {
	const schema = getRawZodSchema(targetId);
	const result = schema.safeParse(raw);

	if (result.success) {
		return;
	}

	const issues: RawValidationIssue[] = result.error.issues.map((issue) => ({
		path: formatZodIssuePath(issue.path),
		message: issue.message
	}));

	throw new RawValidationError(targetId, issues);
}
