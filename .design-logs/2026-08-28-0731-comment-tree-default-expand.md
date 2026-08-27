# CommentTargetTree: 既定開閉（ドメイン vs external）

Date: 2026-08-28 07:31

## Problem / goal

開閉の既定を「全部閉じ / 選択パスだけ開く」ではなく、次の意図に合わせる。

| 対象 | 既定 |
|---|---|
| UIDefinitionMeta（ルート） | opened |
| components（一覧の視認） | opened ※モーダル外の Property テーブルが相当 |
| component item details（ネストしたドメイン object / array） | closed |
| UIDefinitionMeta `external` | closed |
| component `external` | closed |

言い換え: **ドメインキーは第一階層まで見える。`external` residual とコンポーネントの入れ子詳細は畳む。**

## Current tree shape (important)

コメントモーダルの左ペインは YAML 全体の一本木ではない。開いた `#` のスコープだけ:

- 画面メタ `#` → `buildUiDefinitionCommentTree`（`uiDefinition` + 直下キー + `external` 子孫）
- コンポーネント行 `#` → `buildComponentCommentTree`（その 1 件 + 直下キー + `external` 子孫）

`components:` というノードは左ペインに無い。一覧の視認は Property テーブル側。

## Proposed default

**展開するのはルートだけ。** 第一階層のキー（ドメインも `external` 行も）は見える。その先はすべて閉じる。

```
# メタを開いたとき
▾ uiDefinition
    logicalId
    name
    description
    ▸ external          ← 行は見えるが閉
    version

# コンポーネントを開いたとき
▾ userId
    logicalId
    type
    label
    ▸ validation        ← item details: 閉
    ▸ items             ← 閉
    ▸ external          ← 閉
```

これは次と一致する:

- ドメインモデルのキーは **見える**（親が開いている）
- `external` residual の中身は **見えない**（ノード自体は選択できる）
- コンポーネントの入れ子詳細は **見えない**（第一階層のスキャンを優先）

「ドメインノードをすべて展開」すると `validation` / `items` まで開いてしまい、item details closed と矛盾する。やらない。

### 選択パス

モーダル open 時の選択はルート（`uiDefinition` またはそのコンポーネント）。追加の祖先展開は不要。

モーダル内で深いキーを選んだら、その祖先を Set に足す（選択行が隠れない）。`external` 配下を選んだときだけ、その枝は開く。

### 判定の置き場所

既定 Set は `comment-target-tree.ts` の純関数にする（テストする）:

```
defaultExpandedOwnerKeys(root): Set<string>
  → { root.ownerKey }
```

将来「第一階層のドメイン object だけ開く」などに変える余地を関数に閉じる。`label === 'external'` の列挙は、今の既定（ルートのみ）では不要。

`collectAncestorOwnerKeys` は選択追従用に別途置く。

## Not in this slice

- モーダルを YAML 全体エクスプローラ（meta + 全 components）に拡張する
- `external` 配下をドメイン扱いにする

## Files (unchanged from collapse proposal, plus default helper)

| File | Change |
|---|---|
| `src/lib/ir/comment-target-tree.ts` | `defaultExpandedOwnerKeys` / `collectAncestorOwnerKeys` |
| `src/lib/ir/comment-target-tree.spec.ts` | メタ・コンポーネントでルートのみ展開 |
| `src/lib/components/CommentTargetTree.svelte` | シェブロン + 上記既定 |
| `docs/use-cases/layout-editor.md` | 実装後 |

## Decision

この解釈（スコープ付きツリー + ルートのみ opened）でよいか。
