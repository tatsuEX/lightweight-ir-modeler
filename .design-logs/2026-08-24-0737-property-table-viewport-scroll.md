# Property 属性テーブルを viewport 内スクロールにする

Date: 2026-08-24 07:37

## Problem / goal

Property の IR 編集テーブル（`ComponentAttributeTable`）が行数・セル内容で縦に伸び、ページ全体がスクロールする。  
**テーブルを viewport の残り高さに収め、テーブル領域だけをスクロール**したい。

`UiDefinitionMetaAccordion` は開閉で高さが変わる。その増減はテーブルの利用可能高さに反映する。  
高さ計算に ResizeObserver 等の JS は使わない（CSS flex で足りる）。

## Current layout (problem)

```
html/body (height: 100vh)          ← 既にあるが、子は flex 連鎖していない
  AppHeader (Navbar)
  layout-editor/+layout (p-6)      ← 高さが未拘束。中身が増えると document がスクロール
    LayoutEditorNav
    property/+page
      ページ見出し + Import / 削除 / Palette
      ComponentAttributeTable
        UiDefinitionMetaAccordion  ← 開閉で高さ変化
        列グループ切替 + Toggle
        overflow-x-auto のみ       ← 縦スクロールなし
          Table
```

`ComponentDetailsCell` / `ComponentValidationCell` は行を高くしうる（Textarea、date-span、選択肢一覧）が、セル自体がページ高さを決めているわけではない。

## Proposed approach

**flex + `min-h-0` の高さ連鎖。アコーディオンは shrink-0（自然高）、テーブルラッパだけ `flex-1 min-h-0 overflow-auto`。**

アコーディオン開閉 → 親 flex が再レイアウト → テーブル領域が自動で伸縮。計測不要。

```
viewport (html/body 100vh)
  AppHeader                         shrink-0
  remaining
    layout-editor padding + Nav     shrink-0
    remaining
      Property 見出し行             shrink-0
      remaining = ComponentAttributeTable (h-full flex-col)
        Accordion                   shrink-0（開閉で自然高）
        列グループ toolbar          shrink-0
        Table scroller              flex-1 min-h-0 overflow-auto
          thead sticky top-0（推奨）
          tbody 行はコンテンツ高のまま
```

### Accordion をスクロール対象に入れない理由

- 開いたときにメタ入力がテーブルと一緒に消えるのを避ける
- 閉じたときにテーブルへ高さを返す（要件の「開閉を考慮」）

### セルコンポーネントは当面変更しない

Details / Validation の行高はコンテンツ次第。テーブル全体が縦スクロールする。  
セル内 `max-height` は YAGNI。Datepicker ポップオーバーが `overflow-auto` で切れる場合のみ、実装時に対処（portal / 既存の outside-close）。

### Layout / Preview への波及

高さ連鎖のため `layout-editor/+layout` を `overflow-hidden` にすると、Layout / Preview もクリップしうる。  
同時に各 `main` へ `h-full min-h-0 overflow-auto` を付け、ページ内スクロールに逃がす。

### 採用しない案

| 案 | 却下理由 |
|---|---|
| ResizeObserver で `max-height` | アコーディオンアニメ中の追従が必要。flex で足りる |
| `calc(100vh - 固定px)` | Accordion / Nav / Header の実高が固定でない |
| アコーディオン込みでテーブルと一括スクロール | 開閉がテーブル高に効かない。メタがスクロールアウトする |

## Files to change

| File | Change |
|---|---|
| `src/routes/+layout.svelte` | AppHeader と children を `flex h-full flex-col`。children 領域は `flex-1 min-h-0 overflow-hidden` |
| `src/routes/layout.css` | 必要なら `html, body` に `overflow: hidden`（現状 `height: 100vh` のみ） |
| `src/routes/layout-editor/+layout.svelte` | `h-full min-h-0 flex flex-col overflow-hidden`。Nav は shrink-0、children は `flex-1 min-h-0` |
| `src/routes/layout-editor/property/+page.svelte` | `main` を同様の flex 列。見出し行 shrink-0、テーブルを `flex-1 min-h-0` |
| `src/lib/components/ComponentAttributeTable.svelte` | ルートを flex 列。Accordion / toolbar は shrink-0。既存 `overflow-x-auto` を `flex-1 min-h-0 overflow-auto` に。thead を sticky |
| `src/routes/layout-editor/layout/+page.svelte` | 波及: `h-full overflow-auto`（クリップ防止） |
| `src/routes/layout-editor/preview/+page.svelte` | 同上 |
| `docs/use-cases/layout-editor.md` | 実装後: Property の viewport 内スクロール方針を追記 |

### 変更しない（想定）

- `UiDefinitionMetaAccordion.svelte` — 親が自然高を使うだけ
- `ComponentDetailsCell.svelte` / `ComponentValidationCell.svelte` — セル内スクロールは今はやらない

## Open questions / implementation risks

1. Flowbite `Table` が内部で overflow ラッパを持つ場合、外側の `overflow-auto` と二重になり sticky が効かない → 実装時に上書き確認
2. `border-collapse: collapse` と `position: sticky` の相性
3. Datepicker / Timepicker のポップオーバーがテーブル scroller で切れる
4. ルートを `overflow-hidden` にすると TOP も document スクロールできなくなる（現状 TOP は短いので実害は小さい）

## Decision needed

この方針で実装してよいか。
