# UIDefinition 公開面: フィールドアクセサ vs meta/components

Date: 2026-09-07 01:06

## Question

メタ項目の追加・変更の影響範囲を最小にする公開 API はどれか。

1. フィールドごとの get/set で `ui.name` を維持
2. `ui.meta` / `ui.components` を公開し、GUI はそこを bind（推奨・質問者）
3. その他

## Recommendation

**2.** 一回の GUI 書き換えのあと、項目追加のたびにクラスを触らなくてよい。コンポーネント表は既に `component.label` 直 bind なので、メタだけフラット API なのが不揃い。

案 1 は今の bind を守るが、LiveMeta と同じキーをクラスが複製し続ける。投影を `ui-definition-meta.ts` に集めた方針と衝突する。

案 3（meta と components を別 Context）は集約が割れ、操作（`append` / `loadSnapshot`）の置き場が曖昧になるので採らない。

## One-time GUI cost for (2)

`uiDefinition.name` → `uiDefinition.meta.name` 等。主に:

- `UiDefinitionMetaAccordion.svelte`（bind の中心）
- `SnapshotVersionControls.svelte`
- `MarkdownCommentModal.svelte`（一部メタ）
- `Preview.svelte`（logicalId / components）
- `ir-auto-save.svelte.ts` / `ui-export-client.ts`（`toEditorMetaFromLive(ui.meta)`）

`components` の直 bind は既に案 2 と同じ。YAML コメントパス `uiDefinition.logicalId` は snapshot キーであり、クラス API とは別。

## Domain shape (if 2)

クラスは操作を持つ。`meta` と `components` は注入された object への参照（Svelte 型は出さない）。空文字は data 初期値の問題で、getter で `?? ''` しない。
