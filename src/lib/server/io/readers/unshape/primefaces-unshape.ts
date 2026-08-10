import { buildTargetResidual } from '$lib/ir/external-residual';
import { DEFAULT_UI_DEFINITION_VERSION } from '$lib/ir/ui-definition-meta';
import type { RawDefinition } from '$lib/raw/raw-definition';
import {
	findXmlNodeByTag,
	getXmlAttribute,
	getXmlAttributes,
	getXmlChildren,
	getXmlCommentText,
	getXmlTagName,
	type OrderedXmlNode,
	XML_ATTR_PREFIX,
	XML_COMMENT_KEY
} from '$lib/server/io/readers/parse/parse-xml';
import { PRIMEFACES_TARGET_ID } from '$lib/server/io/writers/shape/primefaces-shape';

/**
 * コントロール既知属性（残余に入れない）。タグ判別に使うものも含む
 */
const KNOWN_CONTROL_ATTRS = [
	'id',
	'required',
	'disabled',
	'readonly',
	'placeholder',
	'pattern',
	'showButtonBar',
	'rows',
	'cols',
	'maxlength',
	'selectionMode',
	'showTime',
	'timeOnly',
	'value',
	// WARN: テンプレートが常に出す骨格属性。IR に持ち込まず再 export で復元する。
	'layout',
	'showCheckbox'
] as const;

/** unsupported.hbs コメントの救出パターン */
const UNSUPPORTED_COMMENT_PATTERN = /unsupported\s+type:\s*(\S+)\s+id=(\S+)/i;

/**
 * XML 真偽属性を boolean にする
 */
function isXmlTrue(value: string | undefined): boolean {
	return value === 'true' || value === '';
}

/**
 * 属性バッグをプレフィックス無しキーへ正規化する
 */
function stripAttrPrefix(attrs: Record<string, string>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(attrs)) {
		result[key.startsWith(XML_ATTR_PREFIX) ? key.slice(XML_ATTR_PREFIX.length) : key] = value;
	}
	return result;
}

/**
 * 先頭 HTML コメントから name / description 候補を取り出す
 */
function readHeaderMetaFromComments(nodes: OrderedXmlNode[]): {
	name?: string;
	description?: string;
} {
	for (const node of nodes) {
		const text = getXmlCommentText(node);
		if (text === undefined) {
			continue;
		}
		if (UNSUPPORTED_COMMENT_PATTERN.test(text)) {
			continue;
		}

		const lines = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line, index, all) => !(line === '' && (index === 0 || index === all.length - 1)));

		const nonEmpty = lines.filter((line) => line.length > 0);
		if (nonEmpty.length === 0) {
			continue;
		}

		return {
			name: nonEmpty[0],
			description: lines.length >= 2 ? lines[1] : undefined
		};
	}
	return {};
}

/**
 * title 要素のテキストを取り出す
 */
function readTitleText(nodes: OrderedXmlNode[]): string | undefined {
	const title = findXmlNodeByTag(nodes, 'title');
	if (!title) {
		return undefined;
	}
	for (const child of getXmlChildren(title)) {
		const text = child['#text'];
		if (typeof text === 'string' && text.trim() !== '') {
			return text.trim();
		}
	}
	return undefined;
}

/**
 * f:selectItem 子から items[] を組み立てる
 */
function readSelectItems(control: OrderedXmlNode): { label: string; value: string }[] {
	const items: { label: string; value: string }[] = [];
	for (const child of getXmlChildren(control)) {
		if (getXmlTagName(child) !== 'f:selectItem') {
			continue;
		}
		const value = getXmlAttribute(child, 'itemValue') ?? '';
		const label = getXmlAttribute(child, 'itemLabel') ?? value;
		if (label === '' && value === '') {
			continue;
		}
		items.push({
			label: label !== '' ? label : value,
			value: value !== '' ? value : label
		});
	}
	return items;
}

/**
 * コントロールタグと属性から IR type を判別する
 */
function resolveControlType(tagName: string, attrs: Record<string, string>): string | undefined {
	switch (tagName) {
		case 'p:inputText':
			return 'textbox';
		case 'p:inputTextarea':
			return 'textarea';
		case 'p:inputNumber':
			return 'number';
		case 'p:selectManyCheckbox':
			return 'checkbox';
		case 'p:selectOneRadio':
			return 'radio';
		case 'p:selectOneMenu':
			return 'dropdown';
		case 'p:selectManyMenu':
			return 'dropdown-multi';
		case 'p:outputText':
			return 'label';
		case 'p:datePicker':
			if (attrs.selectionMode === 'range') {
				return 'date-span';
			}
			if (isXmlTrue(attrs.timeOnly)) {
				return 'timepicker';
			}
			if (isXmlTrue(attrs.showTime)) {
				return 'datetimepicker';
			}
			return 'datepicker';
		default:
			return undefined;
	}
}

/**
 * unsupported コメントから field を救出する
 */
function fieldFromUnsupportedComment(
	commentText: string,
	pendingLabel: { forId?: string; value?: string } | null
): Record<string, unknown> | undefined {
	const match = UNSUPPORTED_COMMENT_PATTERN.exec(commentText);
	if (!match) {
		return undefined;
	}

	const type = match[1];
	const logicalId = match[2];
	const label =
		pendingLabel?.forId === logicalId && pendingLabel.value
			? pendingLabel.value
			: pendingLabel?.value ?? logicalId;

	return {
		logicalId,
		type,
		label,
		hint: '',
		disabled: false,
		readonly: false,
		hidden: false,
		required: false,
		validation: { required: false }
	};
}

/**
 * コントロールノードを Raw field へ変換する
 */
function fieldFromControl(
	control: OrderedXmlNode,
	pendingLabel: { forId?: string; value?: string } | null
): Record<string, unknown> | undefined {
	const tagName = getXmlTagName(control);
	if (!tagName || tagName === 'p:outputLabel' || tagName === 'p:messages') {
		return undefined;
	}

	const attrs = stripAttrPrefix(getXmlAttributes(control));
	const type = resolveControlType(tagName, attrs);
	if (!type) {
		return undefined;
	}

	const logicalId =
		attrs.id && attrs.id.trim() !== ''
			? attrs.id
			: pendingLabel?.forId && pendingLabel.forId.trim() !== ''
				? pendingLabel.forId
				: '';

	const labelFromOutput =
		pendingLabel && (!pendingLabel.forId || pendingLabel.forId === logicalId)
			? pendingLabel.value
			: undefined;
	const label =
		(labelFromOutput && labelFromOutput.trim() !== '' ? labelFromOutput : undefined) ??
		(type === 'label' && attrs.value ? attrs.value : undefined) ??
		logicalId;

	const required = isXmlTrue(attrs.required);
	const validation: Record<string, unknown> = { required };
	if (attrs.maxlength !== undefined && attrs.maxlength !== '') {
		const maxlength = Number(attrs.maxlength);
		if (Number.isFinite(maxlength)) {
			validation.maxlength = maxlength;
		}
	}

	const field: Record<string, unknown> = {
		logicalId,
		type,
		label,
		hint: '',
		disabled: isXmlTrue(attrs.disabled),
		readonly: isXmlTrue(attrs.readonly),
		hidden: false,
		required,
		validation
	};

	// WARN: 日付系 placeholder は export 派生マスクなので Raw hint に載せない。
	if (
		(type === 'textbox' || type === 'textarea') &&
		typeof attrs.placeholder === 'string' &&
		attrs.placeholder !== ''
	) {
		field.hint = attrs.placeholder;
	}

	if (typeof attrs.pattern === 'string' && attrs.pattern !== '') {
		field.format = attrs.pattern;
	}
	if (isXmlTrue(attrs.showButtonBar)) {
		field.clearable = true;
	}
	if (attrs.rows !== undefined && attrs.rows !== '') {
		const rows = Number(attrs.rows);
		if (Number.isFinite(rows)) {
			field.rows = rows;
		}
	}
	if (attrs.cols !== undefined && attrs.cols !== '') {
		const cols = Number(attrs.cols);
		if (Number.isFinite(cols)) {
			field.cols = cols;
		}
	}

	if (
		type === 'checkbox' ||
		type === 'radio' ||
		type === 'dropdown' ||
		type === 'dropdown-multi'
	) {
		field.items = readSelectItems(control);
	}

	const residualSource: Record<string, string> = { ...attrs };
	for (const key of KNOWN_CONTROL_ATTRS) {
		delete residualSource[key];
	}
	const external = buildTargetResidual(residualSource, [], PRIMEFACES_TARGET_ID);
	if (external) {
		field.external = external;
	}

	return field;
}

/**
 * panelGrid 子を文書順にペアリングして fields を組み立てる
 */
function unshapePanelGridFields(panelGrid: OrderedXmlNode): unknown[] {
	const fields: unknown[] = [];
	let pendingLabel: { forId?: string; value?: string } | null = null;

	for (const child of getXmlChildren(panelGrid)) {
		const tagName = getXmlTagName(child);

		if (tagName === 'p:outputLabel') {
			pendingLabel = {
				forId: getXmlAttribute(child, 'for'),
				value: getXmlAttribute(child, 'value')
			};
			continue;
		}

		if (tagName === XML_COMMENT_KEY || child[XML_COMMENT_KEY] !== undefined) {
			const commentText = getXmlCommentText(child);
			if (commentText) {
				const rescued = fieldFromUnsupportedComment(commentText, pendingLabel);
				if (rescued) {
					fields.push(rescued);
					pendingLabel = null;
					continue;
				}
			}
		}

		if (tagName === 'p:messages') {
			continue;
		}

		const field = fieldFromControl(child, pendingLabel);
		if (field) {
			fields.push(field);
			pendingLabel = null;
		}
	}

	return fields;
}

/**
 * PrimeFaces XHTML（ordered XML tree）を RawDefinition へ戻す
 */
export function unshapePrimeFaces(document: unknown): RawDefinition {
	if (!Array.isArray(document)) {
		throw new Error('PrimeFaces definition must be an ordered XML node array');
	}

	const roots = document as OrderedXmlNode[];
	const form = findXmlNodeByTag(roots, 'h:form');
	if (!form) {
		throw new Error('h:form が見つかりません');
	}

	const logicalId = getXmlAttribute(form, 'id')?.trim() ?? '';
	if (logicalId === '') {
		throw new Error('h:form の id が空です');
	}

	const header = readHeaderMetaFromComments(roots);
	const title = readTitleText(roots);
	const name = (title && title.trim() !== '' ? title : header.name)?.trim() ?? '';
	if (name === '') {
		throw new Error('画面名（title / 先頭コメント）が取得できません');
	}

	const panelGrid = findXmlNodeByTag(getXmlChildren(form), 'p:panelGrid');
	const fields = panelGrid ? unshapePanelGridFields(panelGrid) : [];

	const html = findXmlNodeByTag(roots, 'html');
	const htmlAttrs = html ? stripAttrPrefix(getXmlAttributes(html)) : {};
	const documentResidualSource: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(htmlAttrs)) {
		if (key === 'xmlns' || key.startsWith('xmlns:')) {
			documentResidualSource[key] = value;
		}
	}
	const external = buildTargetResidual(documentResidualSource, [], PRIMEFACES_TARGET_ID);

	const raw: RawDefinition = {
		target: PRIMEFACES_TARGET_ID,
		logicalId,
		name,
		description: typeof header.description === 'string' ? header.description : '',
		version: DEFAULT_UI_DEFINITION_VERSION,
		fields
	};

	if (external) {
		raw.external = external;
	}

	return raw;
}
