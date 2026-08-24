import { createContext } from 'svelte';
import {
	ownerCommentMapsEqual,
	ownerCommentsFromYamlMap,
	retainOwnerCommentsForComponentIds,
	yamlCommentsFromOwnerMap,
	type OwnerCommentMap
} from '$lib/ir/snapshot-comment-map';
import { normalizeCommentText, type YamlCommentMap } from '$lib/utils/yaml-comments';

export const [getSnapshotCommentsContext, setSnapshotCommentsContext] =
	createContext<SnapshotComments>();

/**
 * 運用コメント編集モーダルの状態
 */
export type SnapshotCommentEditorState = {
	ownerKey: string;
	title: string;
	draft: string;
};

/**
 * snapshot YAML 運用コメント（IR には載せない）
 */
export class SnapshotComments {
	#map = $state<OwnerCommentMap>({});
	#editor = $state<SnapshotCommentEditorState | null>(null);

	/**
	 * オーナマップを取得する
	 */
	get map(): OwnerCommentMap {
		return this.#map;
	}

	/**
	 * 編集中モーダル状態を取得する
	 */
	get editor(): SnapshotCommentEditorState | null {
		return this.#editor;
	}

	/**
	 * 指定オーナのコメント本文を取得する
	 */
	get(ownerKey: string): string {
		return this.#map[ownerKey] ?? '';
	}

	/**
	 * 指定オーナにコメントがあるか判定する
	 */
	has(ownerKey: string): boolean {
		return normalizeCommentText(this.get(ownerKey)) != null;
	}

	/**
	 * 指定オーナのコメントを設定する（空なら削除）
	 */
	set(ownerKey: string, text: string): void {
		const normalized = normalizeCommentText(text);
		const next = { ...this.#map };
		if (normalized == null) {
			delete next[ownerKey];
		} else {
			next[ownerKey] = normalized;
		}
		this.#map = next;
	}

	/**
	 * YAML パスマップと component id 順からコメントを置き換える
	 */
	loadFromYamlMap(yamlComments: YamlCommentMap, componentIds: readonly string[]): void {
		this.#map = ownerCommentsFromYamlMap(yamlComments, componentIds);
		this.#editor = null;
	}

	/**
	 * コメントをすべて捨てる
	 */
	clear(): void {
		this.#map = {};
		this.#editor = null;
	}

	/**
	 * 残っているコンポーネント以外のコメントを落とす
	 *
	 * WARN: 内容が同じでも代入すると $effect が自己再入する。変更が無いときは #map を触らない。
	 */
	retainComponentIds(componentIds: readonly string[]): void {
		const next = retainOwnerCommentsForComponentIds(this.#map, new Set(componentIds));
		if (ownerCommentMapsEqual(this.#map, next)) {
			return;
		}
		this.#map = next;
	}

	/**
	 * 保存用 YAML パスマップを作る
	 */
	toYamlMap(componentIds: readonly string[]): YamlCommentMap {
		return yamlCommentsFromOwnerMap(this.#map, componentIds);
	}

	/**
	 * コメント編集モーダルを開く
	 */
	openEditor(ownerKey: string, title: string): void {
		this.#editor = {
			ownerKey,
			title,
			draft: this.get(ownerKey)
		};
	}

	/**
	 * 編集対象を切り替える（現在の下書きは先にオーナへ載せる）
	 */
	selectEditor(ownerKey: string, title: string): void {
		if (!this.#editor) {
			this.openEditor(ownerKey, title);
			return;
		}
		if (this.#editor.ownerKey === ownerKey) {
			return;
		}
		this.set(this.#editor.ownerKey, this.#editor.draft);
		this.openEditor(ownerKey, title);
	}

	/**
	 * コメント編集モーダルの下書きを更新する
	 */
	setEditorDraft(draft: string): void {
		if (!this.#editor) {
			return;
		}
		this.#editor = { ...this.#editor, draft };
	}

	/**
	 * コメント編集を確定する
	 */
	commitEditor(): void {
		if (!this.#editor) {
			return;
		}
		this.set(this.#editor.ownerKey, this.#editor.draft);
		this.#editor = null;
	}

	/**
	 * コメント編集をキャンセルする
	 */
	cancelEditor(): void {
		this.#editor = null;
	}
}

/**
 * snapshot コメント store を作る
 */
export function createSnapshotComments(): SnapshotComments {
	return new SnapshotComments();
}
