# config モジュール境界の再検討 / logicalId 同期手段の再検討

日付: 2026-08-10 12:56

## 問題 / ゴール

1. API カプセル化（呼び出し順の排除）とモジュール分割（責務・可視性）を混同せず、config 配置を見直す
2. parse-xml から Faces 固有 `isArray` を外す方針を確定（`parse-xhtml-facelet.ts` は将来）
3. logicalId の UI 反映に `$effect` が妥当か再検討する（実装はまだしない）

## 批判的結論

### 1. config — 前回の type/IO 分割案は弱い

前回提案した `application-config-io.ts` / `parse.ts` 分割は、「技術レイヤが違う」こと自体を分割理由にしており、**変更理由の分岐にはなっていない**。

- 呼び出し元が知るべき公開 API は既に `loadApplicationConfig()`（と少数の resolve）に閉じている → rule 13 の趣旨は満たしている
- load と parse を別モジュールの公開 API にすると、かえって「import 順で組み立てる」形になり、rule 13 のアンチパターンをモジュール粒度で再現しうる
- 真に効く軸は **可視性**:
  - `src/lib/config/` … クライアント安全な型・既定値・純関数
  - `src/lib/server/config/` … fs / env / YAML ロード（サーバ専用）
- 現状の `preview-config` / `layout-editor-config` 分離は可視性軸として妥当
- `application-config.ts` の同居（型 + 私的 parse + load）は、単一の変更理由（`application.yml` → `ApplicationConfig`）なら **維持でよい**
- 軽い臭い: server からの `DEFAULT_ITEM_DELIMITER` re-export（公開ホームが二重）。クライアントは `lib/config` のみを見るのが望ましい（実装時の掃除候補）

Rules: `.cursor/rules/14-module-vs-api-boundaries.mdc` を追加。`01` / `13` から相互参照。

### 2. parse-xml

確定方針（実装は後続）:

1. `parse-xml.ts` から `isArray`（`f:selectItem`）を削除し汎用化
2. 将来 Faces 固有オプションが必要なら `parse-xhtml-facelet.ts` を新設

### 3. `$effect` による logicalId 同期 — 負荷より設計臭いが本筋

補足:

- `$effect` は毎フレームではなく、**追跡した依存が変わったとき**に走る
- `logicalIdInput = store.logicalId` 程度なら描画負荷としては問題になりにくい
- ただし Svelte 5 では「state 同士の同期に `$effect`」はアンチパターン寄り（過剰更新というより、意図しない上書き・依存の読みにくさ）

`$effect` を勧めた前回案は **妥当ではない（第一選択にしない）**。

#### 推奨: フォーカス中だけ draft

blur 確定・snapshot 復元のため draft が必要なので、常時ローカル `$state` を store と二重管理しない。

- 非編集中: 表示は `uiDefinition.logicalId`（`$derived` または直接参照）
- focus: draft に現在値をコピーして編集開始
- input: draft のみ更新
- blur / select: draft を store へ commit（既存の restore ロジック）

import / `loadSnapshot` 後は、フィールドにフォーカスしていなければ **自動的に新 logicalId が見える**。`$effect` 不要。

代替（次点）: `loadSnapshot` で `metaGeneration` を増やし `{#key}` で Autocomplete 周りを remount。動くが、generation を store に生やす理由が薄い。

非推奨: 常時 `$effect` で draft ← store 同期。

## 実装時のアクション（まだ着手しない）

1. `parse-xml.ts` から `isArray` 削除 + selectItem 1 件 fixture 確認
2. `UiDefinitionMetaAccordion` を focus-scoped draft に変更
3. （任意）server の `DEFAULT_ITEM_DELIMITER` re-export 削除を検討
4. application-config の type/IO ファイル分割は **しない**（現状維持）

## Resolution（2026-08-10 13:28）

- config は別ログ `2026-08-10-1311-application-config-relocation.md` のとおり再配置済み
- `parse-xml.ts` から `isArray` 削除。`parse-xml.spec` に selectItem 1 件ケース追加。関連 unshape/roundtrip テスト通過
- `UiDefinitionMetaAccordion`: focus-scoped draft（`$effect` なし）。`Autocomplete` に `onfocus` / `oninput` 追加
- import 後は store 更新により既存 auto-save `$effect` が保存候補になる。logicalId は blur 確定まで draft（他フィールド編集や import 直後の meta 更新は従来どおり保存対象）
