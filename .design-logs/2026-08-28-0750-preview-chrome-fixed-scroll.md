# Preview: テーマ / 出力 chrome 固定とテーブル縦スクロール

Date: 2026-08-28 07:50

## Problem / goal

Preview は上から「テーマ選択 → プレビュー table → 出力先選択 + 出力ボタン」の縦並び。  
行数が増えると **画面全体がスクロール**し、テーマ切替と出力操作が viewport 外へ消える。

**テーマ選択を画面上部に固定、出力先選択と出力ボタンを画面下部に固定、プレビュー table だけを縦スクロール**したい。

Property 属性テーブル（`.design-logs/2026-08-24-0737-property-table-viewport-scroll.md`）と同じクラスの問題: 親が `overflow-auto` で、子に拘束高が無い。

## Current layout (problem)

高さ連鎖は AppHeader / layout-editor shell まで既にある。Preview ページだけが「ページ全体スクロール」に逃がしている。

```
html/body (100vh, overflow: hidden)
  AppHeader                         shrink-0
  layout-editor/+layout             h-full flex-col overflow-hidden
    LayoutEditorNav                 shrink-0
    children                        flex-1 min-h-0 overflow-hidden
      preview/+page <main>          h-full min-h-0 overflow-auto  ← ここが全体スクロール
        h1 + 説明
        Preview.svelte              自然高で伸びる（w-1/2 mx-auto flex-col）
          テーマ Select
          .preview-root + table     行数ぶん伸びる
          出力先 Select + ボタン
```

`Preview.svelte` のルートは高さ未拘束。table がコンテンツ高まで伸び、`main` の `overflow-auto` が発火する。

## Proposed approach

**flex + `min-h-0` の高さ連鎖。テーマ / 出力 chrome は shrink-0、table ラッパだけ `flex-1 min-h-0 overflow-y-auto`。計測 JS は使わない。**

Property / コメントモーダルと同じ方針。layout-editor の高さ連鎖は触らない。

```
viewport
  AppHeader / Nav                   既存 shrink-0
  remaining
    preview/+page <main>            flex h-full min-h-0 flex-col overflow-hidden
      h1 + 説明                     shrink-0
      remaining = Preview           h-full min-h-0 flex-col（w-1/2 mx-auto 維持）
        テーマ Select               shrink-0
        .preview-root + table       flex-1 min-h-0 overflow-y-auto
        出力先 Select + ボタン      shrink-0
```

### ページ見出しの扱い

`+page.svelte` の h1 / 説明は Preview コンポーネント外のページ chrome。  
Property と同じく **shrink-0 のまま固定**する（テーブルと一緒にスクロールさせない）。

テーマ Select は「プレビュー画面内」の上部固定、という要件どおり `Preview.svelte` 側に残す。

### スクロール対象

table 要素自体に overflow は付けない（tbody overflow は HTML table で壊れやすい）。  
既存の `.preview-root` ラッパを scroller にする。テーマ scope クラスはここに残すので、スクロール領域全体にテーマ背景が効く。

行が少ないときは scroller が残り高を埋め、出力 chrome は **viewport 下端に張り付く**（flex の意図）。

### 採用しない案

| 案 | 却下理由 |
|---|---|
| `main` の `overflow-auto` + chrome を `sticky` | スクロール主体がページのまま。行が少ないときフッタはコンテンツ直下に留まり、画面下端固定にならない |
| `calc(100vh - 固定px)` / ResizeObserver | Nav / 見出し高が固定でない。flex で足りる |
| table の `tbody { display:block; overflow }` | 列幅が header とずれる。既存 `table-fixed` と相性が悪い |
| Preview をフル幅にする | 要件外。`w-1/2 mx-auto` は維持 |

## Files to change

| File | Change |
|---|---|
| `src/routes/layout-editor/preview/+page.svelte` | `overflow-auto` をやめる。`flex h-full min-h-0 flex-col overflow-hidden`。見出し shrink-0、`<Preview />` を `flex-1 min-h-0` で包む |
| `src/lib/components/Preview.svelte` | ルートを `h-full min-h-0 flex flex-col`。テーマ / 出力を shrink-0。`.preview-root` に `flex-1 min-h-0 overflow-y-auto`。縦マージン（`mt-4 mb-4 m-2`）は chrome の padding に寄せ、高さ計算を食わないようにする |
| `docs/use-cases/layout-editor.md` | 実装後: Preview の chrome 固定 + table 内スクロールを追記 |

### 変更しない（想定）

- `src/routes/layout-editor/+layout.svelte` — 高さ連鎖は既にある
- `src/lib/preview/preview-classes.ts` / テーマ CSS — scope は `.preview-root` のまま
- テーマ / 出力 / Export の script ロジック

## Markup sketch (`Preview.svelte`)

```svelte
<div class="mx-auto flex h-full min-h-0 w-1/2 flex-col">
  <div class="shrink-0 py-2">
    <Label>プレビューテーマ
      <Select items={themeItems} bind:value={selectedTheme} />
    </Label>
  </div>

  <div class="{previewRootClass} min-h-0 flex-1 overflow-y-auto">
    <table class="w-full table-fixed border-collapse border border-gray-300">
      ...
    </table>
  </div>

  <div class="shrink-0 space-y-2 py-2">
    <Label>出力先
      <Select items={targetItems} bind:value={selectedTarget} />
    </Label>
    <div class="flex justify-end gap-2">
      <!-- 出力 / ダウンロード / キャンセル -->
    </div>
  </div>
</div>
```

WARN: flex 子の最小高さはコンテンツ高が既定。`.preview-root` に `min-h-0` が無いと overflow が発火せず、出力 chrome が画面外へ押し出される。

## Open questions / implementation risks

1. Preview 内の Datepicker 等ポップオーバーが `.preview-root` の `overflow-y-auto` で切れる（Property テーブルと同じリスク。切れたら portal 等で後追い）
2. `w-1/2` のまま中央寄せするか、テーブル可読性のため幅を広げるかは本提案の範囲外
3. テーマ Select 直下に薄い区切り（`border-b`）を付けるかは見た目の好み。機能には不要

## Decision needed

この方針（flex chrome 固定 + `.preview-root` だけ縦スクロール）で実装してよいか。
