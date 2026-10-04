import { createContext } from 'svelte';
import {
	findIntentTagDefinition,
	sharedWarningKey,
	suggestIntentTags,
	UI_DEFINITION_INTENT_TAG_IR_TYPE,
	type IntentTagCatalogView,
	type IntentTagDefinition,
	type IntentTagIrType,
	type IntentTagSuggestion
} from '$lib/ir/intent-tags';

export const [getIntentTagCatalogContext, setIntentTagCatalogContext] =
	createContext<IntentTagCatalog>();

/**
 * 共有マスタ警告の opt-out を保存する localStorage キーの接頭辞
 *
 * WARN: presentation state。IR / snapshot / application.yml には載せない。
 */
export const INTENT_TAG_SHARED_WARNING_STORAGE_PREFIX = 'layout-editor.intentTags.skipSharedWarning:';

/**
 * Intent Tags マスタ（合成済み）を GUI から使う store
 */
export class IntentTagCatalog {
	readonly irType: IntentTagIrType;
	#tags = $state<IntentTagDefinition[]>([]);
	#canRegister = $state(false);
	#sharedWithIrTypes = $state<IntentTagIrType[]>([]);
	#loadError = $state<string | undefined>(undefined);
	#fetchImpl: typeof fetch;

	/**
	 * サーバーが返した合成済みマスタで初期化する
	 */
	constructor(
		view: IntentTagCatalogView,
		options: { irType?: IntentTagIrType; fetchImpl?: typeof fetch } = {}
	) {
		this.irType = options.irType ?? UI_DEFINITION_INTENT_TAG_IR_TYPE;
		this.#fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
		this.#tags = [...view.tags];
		this.#canRegister = view.canRegister;
		this.#sharedWithIrTypes = [...view.sharedWithIrTypes];
		this.#loadError = view.loadError;
	}

	/**
	 * 合成済みのマスタ一覧
	 */
	get tags(): readonly IntentTagDefinition[] {
		return this.#tags;
	}

	/**
	 * default へ新規登録できるか
	 */
	get canRegister(): boolean {
		return this.#canRegister;
	}

	/**
	 * default のファイルを共有しているほかの IR 種類
	 */
	get sharedWithIrTypes(): readonly IntentTagIrType[] {
		return this.#sharedWithIrTypes;
	}

	/**
	 * マスタの読込エラー
	 */
	get loadError(): string | undefined {
		return this.#loadError;
	}

	/**
	 * 具体タグに対応するマスタ定義を返す
	 */
	find(tag: string): IntentTagDefinition | undefined {
		return findIntentTagDefinition(this.#tags, tag);
	}

	/**
	 * 入力候補を返す
	 */
	suggest(
		query: string,
		options: { logicalIds?: readonly string[]; exclude?: readonly string[] } = {}
	): IntentTagSuggestion[] {
		return suggestIntentTags(this.#tags, query, options);
	}

	/**
	 * default マスタへ新規登録し、ローカルの一覧へ反映する
	 *
	 * @throws 登録に失敗したとき（メッセージはサーバーの error）
	 */
	async register(id: string, description: string): Promise<IntentTagDefinition> {
		const response = await this.#fetchImpl('/api/ir/intent-tags', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id, description })
		});
		const body = (await response.json().catch(() => ({}))) as {
			error?: string;
			definition?: IntentTagDefinition;
			sharedWithIrTypes?: IntentTagIrType[];
		};
		if (!response.ok || !body.definition) {
			throw new Error(body.error ?? `HTTP ${response.status}`);
		}
		const definition = body.definition;
		this.#tags = [...this.#tags.filter((tag) => tag.id !== definition.id), definition];
		if (Array.isArray(body.sharedWithIrTypes)) {
			this.#sharedWithIrTypes = [...body.sharedWithIrTypes];
		}
		return definition;
	}

	/**
	 * 共有マスタ警告の opt-out キー
	 */
	#sharedWarningStorageKey(): string {
		return `${INTENT_TAG_SHARED_WARNING_STORAGE_PREFIX}${sharedWarningKey(this.irType, this.#sharedWithIrTypes)}`;
	}

	/**
	 * 新規登録の前に共有マスタ警告を出すべきか判定する
	 */
	shouldWarnShared(): boolean {
		if (this.#sharedWithIrTypes.length === 0) {
			return false;
		}
		return browserStorage()?.getItem(this.#sharedWarningStorageKey()) !== '1';
	}

	/**
	 * 共有マスタ警告を今後出さない（現在の共有先の組に対して）
	 */
	dismissSharedWarning(): void {
		browserStorage()?.setItem(this.#sharedWarningStorageKey(), '1');
	}
}

/**
 * 使える localStorage を返す。SSR や無効環境では null
 */
function browserStorage(): Storage | null {
	try {
		if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
			return null;
		}
		return localStorage;
	} catch {
		return null;
	}
}

/**
 * Intent Tags マスタ store を作る
 */
export function createIntentTagCatalog(view: IntentTagCatalogView): IntentTagCatalog {
	return new IntentTagCatalog(view);
}
