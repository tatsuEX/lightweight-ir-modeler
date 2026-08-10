import { XMLParser } from 'fast-xml-parser';

/** preserveOrder 時の属性オブジェクトキー */
export const XML_ATTR_BAG_KEY = ':@';

/** 属性名プレフィックス */
export const XML_ATTR_PREFIX = '@_';

/** コメントノードキー */
export const XML_COMMENT_KEY = '#comment';

/** テキストノードキー */
export const XML_TEXT_KEY = '#text';

/**
 * preserveOrder モードの XML ノード（タグ名 → 子配列、任意で :@ 属性）
 */
export type OrderedXmlNode = Record<string, unknown>;

const orderedXmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: XML_ATTR_PREFIX,
	preserveOrder: true,
	commentPropName: XML_COMMENT_KEY,
	ignoreDeclaration: true,
	// WARN: select の選択肢は 1 件でも配列として扱う（preserveOrder 以外の経路向け保険）
	isArray: (tagName) => tagName === 'f:selectItem'
});

/**
 * XML / XHTML 文字列を preserveOrder ツリーへパースする（serialize の対）
 */
export function parseXml(text: string): OrderedXmlNode[] {
	const result = orderedXmlParser.parse(text);
	if (!Array.isArray(result)) {
		throw new Error('XML parse result must be an ordered node array');
	}
	return result as OrderedXmlNode[];
}

/**
 * ノードのタグ名を返す（属性バッグ・コメント以外の最初のキー）
 */
export function getXmlTagName(node: OrderedXmlNode): string | undefined {
	for (const key of Object.keys(node)) {
		if (key !== XML_ATTR_BAG_KEY) {
			return key;
		}
	}
	return undefined;
}

/**
 * ノードの属性マップを返す（プレフィックス付きキーのまま）
 */
export function getXmlAttributes(node: OrderedXmlNode): Record<string, string> {
	const bag = node[XML_ATTR_BAG_KEY];
	if (bag === null || typeof bag !== 'object' || Array.isArray(bag)) {
		return {};
	}

	const attrs: Record<string, string> = {};
	for (const [key, value] of Object.entries(bag as Record<string, unknown>)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			attrs[key] = String(value);
		}
	}
	return attrs;
}

/**
 * 属性名（プレフィックス無し）で値を取得する
 */
export function getXmlAttribute(node: OrderedXmlNode, name: string): string | undefined {
	return getXmlAttributes(node)[`${XML_ATTR_PREFIX}${name}`];
}

/**
 * ノードの子要素配列を返す
 */
export function getXmlChildren(node: OrderedXmlNode): OrderedXmlNode[] {
	const tag = getXmlTagName(node);
	if (!tag) {
		return [];
	}
	const children = node[tag];
	return Array.isArray(children) ? (children as OrderedXmlNode[]) : [];
}

/**
 * コメントノードのテキストを結合する
 */
export function getXmlCommentText(node: OrderedXmlNode): string | undefined {
	const comment = node[XML_COMMENT_KEY];
	if (!Array.isArray(comment)) {
		return undefined;
	}

	return comment
		.map((entry) => {
			if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
				return '';
			}
			const text = (entry as Record<string, unknown>)[XML_TEXT_KEY];
			return typeof text === 'string' ? text : '';
		})
		.join('')
		.trim();
}

/**
 * タグ名で最初の子孫ノードを深さ優先で探す
 */
export function findXmlNodeByTag(nodes: OrderedXmlNode[], tagName: string): OrderedXmlNode | undefined {
	for (const node of nodes) {
		if (getXmlTagName(node) === tagName) {
			return node;
		}
		const found = findXmlNodeByTag(getXmlChildren(node), tagName);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/**
 * タグ名に一致する子孫を文書順で列挙する
 */
export function collectXmlNodesByTag(nodes: OrderedXmlNode[], tagName: string): OrderedXmlNode[] {
	const found: OrderedXmlNode[] = [];
	for (const node of nodes) {
		if (getXmlTagName(node) === tagName) {
			found.push(node);
		}
		found.push(...collectXmlNodesByTag(getXmlChildren(node), tagName));
	}
	return found;
}
