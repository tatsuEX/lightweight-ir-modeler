# Comment UI layout: header placement, explorer in modal, tooltip

Date: 2026-08-25 07:47

## Problem

1. Property の `UiDefinitionMetaAccordion` ヘッダで、Flowbite 開閉シェブロンと `#` ボタンが右端で重なる。
2. `external` キーツリーがメタ領域・コンポーネント行を占有する。`external` は IR ドメインの主対象ではない。
3. `#` だけでは「コメントを編集」と読み取れない。

## Proposed approach

### 1. `#` はヘッダ左（タイトル先頭）

AccordionItem の `header` snippet は内部が `<button>` のため、そこに `#`（これも button）を入れるとネスト button になる。現状の absolute 配置はそれを避けるため。

推奨: `#` は Accordion **外側のまま**、`right-3` をやめて **`left-3`**。ヘッダ文言に左パディングを足し、タイトル先頭に見えるようにする。シェブロンは右端専有のまま。

行テーブル側の `#` と `external` `<details>` の重なりは、2. でツリーを行から外すと解消する。

### 2. コメント対象ツリーはコメントモーダル左ペインのみ

VS Code のファイルエクスプローラ相当。Property 上のインラインツリーは置かない。

| 開いた `#` | 左ペイン | 右ペイン |
|---|---|---|
| 画面メタ | `uiDefinition` ＋ドメインキー（`logicalId` 等）＋ `external` 子孫 | Monaco（選択ノード） |
| コンポーネント行 | その行 ＋ドメインキー＋ `external` 子孫 | 同上 |

ツリー行クリックで編集対象を切り替える。ノード切替時は現在の下書きをそのオーナへ `set` してから切替（モーダルは開いたまま）。キャンセルは **今開いているノードの下書きだけ** 破棄。

ツリー内の `#` は置かない。コメント有無は行の強調（既存の filled 色）で示す。

### 3. tooltip

Flowbite `Tooltip` で常時「コメントを編集」。既存の「記入済み Markdown プレビュー」は同じ tooltip 内に続けて出す（ホバー UI を二重にしない）。`aria-label` も「…のコメントを編集」に寄せる。

## Alternatives

- `#` をシェブロン左（`right-10`）: 右端の取り合いが残る。不採用。
- ワークスペース全体のエクスプローラ（全コンポーネント）: 過剰。今回は開いた対象のスコープのみ。
- ノード切替で下書き破棄: 操作を失いやすい。不採用。

## Files

| File | Change |
|---|---|
| `YamlCommentButton.svelte` | Tooltip「コメントを編集」＋プレビュー統合 |
| `UiDefinitionMetaAccordion.svelte` | `#` を左へ。インライン `ExternalCommentTree` 削除 |
| `ComponentAttributeTable.svelte` | 行の `external` `<details>` 削除（`#` 列は行コメントのみ） |
| `MarkdownCommentModal.svelte` | 左ペイン＋ Monaco。`size` 拡大 |
| `CommentTargetTree.svelte` | 選択用ツリー（ドメインキー + external） |
| `snapshot-comments.svelte.ts` | `selectEditor`（下書き保存して切替） |
| `snapshot-comment-map.ts` | `uiDefinition.*` と `components[i].*` をオーナへ |
| `docs/use-cases/layout-editor.md` | 実装後に UI 説明を更新 |

## Open questions

なし。実装時の追加決定: 左ペインは **開いた対象のドメインキー（logicalId 等）と `external` 子孫の両方** を選択可能とする。
