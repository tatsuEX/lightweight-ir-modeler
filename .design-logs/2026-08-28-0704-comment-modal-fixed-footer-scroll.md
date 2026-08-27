# MarkdownCommentModal: フッタ固定と左右ペイン独立スクロール

Date: 2026-08-28 07:04

## Problem / goal

`CommentTargetTree` が長いと、`MarkdownCommentModal` 全体（ヘッダ・本文・キャンセル/保存）が一つのスクロール対象になる。  
**ボタンはモーダル下部に常時表示し、残りの描画領域だけを左ツリー / 右 Monaco がそれぞれ独立スクロール**したい。

## Current layout (problem)

Flowbite Svelte `Modal`（v1.33）の構造:

```
<dialog>                         ← open:flex flex-col。高さ上限なし
  header (shrink-0)
  body (overflow-y-auto)         ← 中身の自然高で伸びる。max-height が無いので overflow が発火しない
    左右 flex (min-h-[20rem] のみ)
      左: 幅固定。高さ未拘束 → ツリーがコンテンツ高まで伸びる
      右: Monaco は heightPx=280 固定
    ボタン行                     ← body の末尾なのでツリーと一緒にスクロールアウト
  (footer snippet 未使用)
```

`CommentTargetTree` は既に `h-full overflow-auto`。親に拘束高が無いため `h-full` が効かず、ツリーが modal を押し広げている。

Property テーブル（`.design-logs/2026-08-24-0737-property-table-viewport-scroll.md`）と同じクラス: **高さ未拘束 + overflow 子 = 祖先全体がスクロール**。

## Proposed approach

**flex + `min-h-0` の高さ連鎖。ヘッダ/フッタは shrink-0、body は残り高。左右ペインだけ overflow。計測 JS は使わない。**

```
<dialog class="max-h-[90vh] h-[min(90vh,42rem)] flex flex-col">
  header                         shrink-0（既存 title + close）
  body                           flex-1 min-h-0 overflow-hidden（modal 全体はスクロールしない）
    左右 row                     h-full min-h-0 flex
      左 CommentTargetTree       w-56 shrink-0 min-h-0 overflow-auto
      右
        選択タイトル             shrink-0
        Monaco ホスト            flex-1 min-h-0（中は Monaco 自身のスクロール）
  footer snippet                 shrink-0（キャンセル / 保存）
```

Flowbite は既に `header` / `footer` を `shrink-0`、`body` を `overflow-y-auto` にしている。今回は:

1. ボタンを **`footer` snippet** へ移す（body から出す）。
2. ダイアログに **高さ上限**（`max-h-[90vh]`）と、Monaco の `%` 高さ用の **明示高**（`h-[min(90vh,42rem)]`）を付ける。
3. `body` の `overflow-y-auto` を **`overflow-hidden`** に上書きし、`flex-1 min-h-0` で残り高だけを持つ。
4. 左右はそれぞれその残り高の中でスクロールする。

`h-[min(90vh,42rem)]` の意図: 短いツリーでもエディタ領域を確保し、親高が definite なので Monaco `h-full` が解決できる。`max-height` だけでは `%` 高さが解決しない。

### CommentTargetTree

ほぼ変更なし。親が拘束高を持てば既存 `h-full overflow-auto` が発火する。  
保険で `nav` に `min-h-0` を足す（flex 子がコンテンツ最小高で縮めない対策）。横長キーの横スクロールは現状どおり `overflow-auto`。

### MonacoMarkdownEditor

現状は `heightPx` 既定 280px。呼び出し元はモーダルのみ。

- `heightPx` 省略時はホストを `h-full min-h-0`（親の残り高を埋める）。
- `automaticLayout: true` は維持。モーダル open 後のリサイズは Monaco 側 ResizeObserver に任せる。
- 固定 px はオプションのまま残す（他用途・テスト用）。

### 採用しない案

| 案 | 却下理由 |
|---|---|
| ツリーに `max-h-64` だけ付ける | エディタは埋まらず、ボタンが body に残れば同じ問題 |
| `calc(100vh - 固定px)` / ResizeObserver | Property テーブルと同じく flex で足りる |
| `fullscreen` Modal | コメント編集に過剰 |
| body 全体をスクロールし sticky フッタ | 左右独立スクロールにならない。ヘッダも動きうる |

## Files to change

| File | Change |
|---|---|
| `src/lib/components/MarkdownCommentModal.svelte` | `footer` snippet、`class` で高さ、`bodyClass`/`classes.body` で overflow 上書き、左右を `min-h-0 flex-1` |
| `src/lib/components/CommentTargetTree.svelte` | `nav` に `min-h-0`（必要なら） |
| `src/lib/components/MonacoMarkdownEditor.svelte` | `heightPx` 省略時は `h-full` |
| `docs/use-cases/layout-editor.md` | 実装後: モーダルの固定フッタ / 左右独立スクロールを追記 |

### 変更しない（想定）

- `snapshot-comments.svelte.ts` — 編集ロジックは触らない
- 他 Modal（Import / Confirm）— 短いので現状の body 内ボタンでよい

## Open questions / implementation risks

1. Flowbite `body` 既定の `space-y-4 overflow-y-auto` が tailwind-merge で打ち消せるか。効かない場合は単一ラッパで `overflow-hidden` を二重にかける。
2. native `<dialog>` が `h-[min(90vh,42rem)]` でも中央配置を保つか（既存 `placement: center` / `my-auto`）。
3. モーダル open 直後に Monaco ホスト高が 0 のままになる場合 → `automaticLayout` で追従する想定。だめなら open 後に `editor.layout()` を一度呼ぶ。
4. 左ペインの横スクロールバーが下端に出る（現状どおり）。縦と同時に出ても、フッタは隠れない。

## Decision needed

この方針で実装してよいか。

高さの既定（`h-[min(90vh,42rem)]`）を変えるなら、実装前に指示してほしい。
