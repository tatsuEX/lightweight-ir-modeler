import { describe, expect, it } from 'vitest';
import {
	formatIssuesDetail,
	IssuesError,
	issuesFromUnknown
} from '$lib/utils/validation-issue-notify';

describe('validation-issue-notify', () => {
	it('lists every issue in detail and in IssuesError.message', () => {
		const issues = [
			{ path: 'meta.logicalId', message: '必須です' },
			{ path: 'components/a/label', message: 'label は必須です' }
		];
		expect(formatIssuesDetail(issues)).toBe(
			'・meta.logicalId: 必須です\n・components/a/label: label は必須です'
		);
		const error = new IssuesError('検証エラーが 2 件あります', issues);
		expect(error.message).toContain('meta.logicalId');
		expect(error.message).toContain('components/a/label');
		expect(issuesFromUnknown(error)).toEqual(issues);
	});

	it('caps detail lines and reports the remainder', () => {
		const issues = Array.from({ length: 3 }, (_, index) => ({
			path: `p${index}`,
			message: `m${index}`
		}));
		expect(formatIssuesDetail(issues, 2)).toBe('・p0: m0\n・p1: m1\n…他 1 件');
	});
});
