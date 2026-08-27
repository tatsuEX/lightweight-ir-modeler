# CommentTargetTree: ノード開閉（collapse）

Date: 2026-08-28 07:22

## Problem / goal

運用コメントモーダル左ペインのキーツリーは現状すべて展開されている。`external` 配下が深いと一覧が長く、目的キーへたどり着きにくい。

**親ノードを開閉できるようにし、既定では浅い階層だけ見せる。** 選択（コメント対象）と開閉は別操作にする。

## Current behavior

`CommentTargetTree` は `children` を常に描画する。行クリックは `onSelect` のみ。開閉状態はない。

`CommentTreeNode`（`src/lib/ir/comment-target-tree.ts`）は既に再帰 `children` を持つ。ドメインモデルの変更は不要。

## Proposed approach

**既存の再帰 snippet に「展開中キーの Set」を足す。Flowbite Accordion は使わない。**

Accordion は排他的パネル向けで、入れ子にするとヘッダクリック＝開閉になり、キー選択と衝突する。ネスト数も `external` の深さに対して重い。

VS Code エクスプローラ相当（既存の左ペイン方針）:

```
[▸] logicalId          ← 葉はシェブロンなし（幅だけ揃える）
[▾] external           ← シェブロン = 開閉、ラベル = 選択
      [▸] im-forma
```

- **シェブロン**（子があるノードのみ）: 展開トグル。`aria-expanded`。選択はしない。
- **ラベル行**: 現行どおり `onSelect`。開閉しない。
- 葉: シェブロン位置に同じ幅のスペーサ。ラベル列が揃う。

アイコンは既存依存 `flowbite-svelte-icons` の `ChevronRightOutline`（閉）/ `ChevronDownOutline`（開）。新規パッケージは足さない。

### 展開状態

コンポーネント内の `Set<string>`（`ownerKey`）。store には載せない。モーダルを閉じると `{#if tree}` でアンマウントされ、次回は初期状態に戻る。

**初期 / `root` 変更時**

- ルートは常に展開（第一階層のキーが見える）
- `selectedOwnerKey` までの祖先も展開（選択行が隠れない）
- それ以外は閉じる（`external` 配下は既定で畳む）

**選択が変わったとき**

- 新しい選択の祖先を Set に **追加**する（他で開いた枝は閉じない）
- ユーザーが選択の祖先を手動で閉じることは許可する（強制再オープンしない）

**トグル**

```
expanded なら delete、否则 add。root.ownerKey は閉じてもよい（第一階層が消える）。
```

ルートを閉じられると何も見えなくなるので、**ルートは閉じない**（シェブロンなし、またはトグル無効）。第一階層の `external` などは閉じられる。

### 純関数（テストする）

`comment-target-tree.ts` にパス収集を足す（Svelte 非依存）:

```
collectAncestorOwnerKeys(root, ownerKey): string[]
```

ルートから対象までの `ownerKey` 列（対象自身は含めても含めなくてもよい。展開に必要なのは祖先）。見つからなければ `[root.ownerKey]`。既存 spec にケースを追加。

### コメント有無の見た目

現行どおり **そのノード自身** が `comments.has` なら semibold。折りたたんだ親に子孫コメントを示す印は今はやらない（YAGNI）。必要なら後続。

## Alternatives

| 案 | 却下理由 |
|---|---|
| 入れ子 Flowbite `Accordion` | 選択と開閉が同じヘッダ。排他開閉。DOM が重い |
| 行全体が `<details>` | summary クリックが開閉になり、選択と衝突 |
| すべて展開が既定 | 今回の長さ問題が残る |
| 開閉状態を snapshot store に永続 | 過剰。モーダル寿命で足りる |

## Files to change

| File | Change |
|---|---|
| `src/lib/ir/comment-target-tree.ts` | `collectAncestorOwnerKeys` |
| `src/lib/ir/comment-target-tree.spec.ts` | パス収集のテスト |
| `src/lib/components/CommentTargetTree.svelte` | シェブロン、`expandedKeys`、子は展開時のみ描画 |
| `docs/use-cases/layout-editor.md` | 実装後: 左ペインが開閉可能である旨 |

### 変更しない（想定）

- `MarkdownCommentModal.svelte` — ツリーを置くだけ
- `snapshot-comments.svelte.ts` — 選択ロジックはそのまま
- `CommentTreeNode` の形

## Open questions / implementation risks

1. ルートにシェブロンを出すか。出さない（常時展開）を推奨。
2. ラベルクリックで子を開くか。開かないを推奨（選択と開閉を分ける）。
3. `flowbite-svelte-icons` は依存済みだが src 未使用。初回 import になる。

## Decision needed

この方針で実装してよいか。
