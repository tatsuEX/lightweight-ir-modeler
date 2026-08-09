# Property 属性テーブル: 列グループ切替 + TagsInput

- Date: 2026-08-09 23:06
- Status: implemented
- Related: `.design-logs/2026-08-06-2253-property-attribute-table-v3-ux-hardcoded.md`

## Problem / Goal

`ComponentAttributeTable` が共通列（logicalId / type / label / hint / required）のみで、IR の type 固有属性（`items`, `minDate` / `maxDate` 等）を編集できなかった。

## Decisions

1. **依存**: Melt 等は追加しない。既存 `flowbite-svelte` のみ。
2. **TagsInput**: `src/lib/components/TagsInput.svelte` を IR 非依存（`string[]`）の汎用コンポーネントとして実装。Flowbite `Badge` + `Input`。
3. **列構成**: 常時 = 選択 / id / type / label。追加列は `Basic | Items | DateTime` の ButtonGroup で切替（`LayoutEditorNav` と同型）。
4. **状態**: アクティブグループ・行選択は presentation state。IR / snapshot に載せない。
5. **列ディスクリプタ**: 作らない（v3 継続）。グループごとの列は markup 直書き。
6. **items 変換**: 表示は `${value}${itemDelimiter}${label}`（同一なら単一文字列）。書込は常に `{ label, value }[]`。`itemDelimiter` は `layoutEditor.property.itemDelimiter`（既定 `|`）。
7. **DateTime**: min/max の 1 組の列で type 分岐。日付は Flowbite `Datepicker`、時刻は `Timepicker`、日時は `datetime-local`。IR は文字列（`yyyy-MM-dd` / `HH:mm` / `yyyy-MM-dd HH:mm`）。
8. **arrowNavigation**: TagsInput は `data-arrow-nav-focus` を入力に付与。action 側は mark → text entry → 汎用 focusable の順で解決する。

## Out of scope

- Text / Number 専用グループ
- items の二欄エディタ
- IR 型の正式化
- Preview 側 Datepicker 実装

## Implemented files

- `src/lib/components/TagsInput.svelte`
- `src/lib/components/ComponentAttributeTable.svelte`
- `src/routes/layout-editor/property/+page.svelte`
- `docs/use-cases/layout-editor.md`
