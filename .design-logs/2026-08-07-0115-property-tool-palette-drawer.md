# Property ツールパレット（Drawer）

- Date: 2026-08-07
- Status: implementing

## Problem / goal

Property 属性テーブルは 0 件起動のため、`UIDefinition.append` へ要素を渡す追加 UI が必要。  
`createTextbox` / `createTextarea` / `createNumber` を使って行を追加できるツールパレットを、flowbite-svelte の `Drawer` で実装する。

## Proposed approach

- 実装場所: [`src/routes/layout-editor/property/+page.svelte`](src/routes/layout-editor/property/+page.svelte)（※ `layout/property` パスは存在しない。Property タブ側）
- パレット本体は [`src/lib/components/ComponentToolPalette.svelte`](src/lib/components/ComponentToolPalette.svelte) に切り出し（テーブルと同様、ページは配置のみ）
- 状態は Context: `getUIDefinitionContext()` → `append(create*( {} ))`
- UI: `Button` で Drawer を開く / `Drawer` + `Drawerhead` / 追加は `Button` 3 つ（Textbox / Textarea / Number）
- 追加後も Drawer は開いたまま（連続追加を優先）
- placement: `right`（編集テーブルを隠さない）

## Key decisions

- store に専用 API は増やさない。既存 factory + `append` のみ
- 削除 UI・DnD・type 別オプションは今回やらない（YAGNI）

## Open questions

- なし（MVP）
