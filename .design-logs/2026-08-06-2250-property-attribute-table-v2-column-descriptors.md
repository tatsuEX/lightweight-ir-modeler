# Property 共通属性テーブル（案2: 列ディスクリプタ）

- Date: 2026-08-06
- Source: [Property attribute table](7b46aa60-e40c-427a-b3a8-a3fe19ca2ea7)
- Status: superseded（案3でディスクリプタを撤回）

## Goal / context

将来 basic / option / validation の列グループ切り替えに備え、今回は切り替え UI を作らず内部構造だけデータ駆動にする改訂案。

## Assistant summary (chat)

plan を更新しました。今回の見た目・機能は前案どおり（basic 5列固定表示、シードなし、0件時メッセージ）ですが、内部構造だけ将来のグループ切り替えに耐える形にしています。

変更点は次のとおりです。

- 列を markup に直書きせず、`src/lib/components/component-attribute-columns.ts` の**列ディスクリプタ配列**から描画します。各列に `group: 'basic' | 'option' | 'validation'` と `kind: 'text' | 'readonly' | 'toggle'` を持たせます。
- `validation.required` のようなネストがあるため、パス文字列ではなく `get` / `set` 関数で値をやり取りし、セルは Svelte 5 の関数バインディング `bind:value={() => col.get(c), (v) => col.set(c, v)}` で繋ぎます。
- テーブル側は `$derived` で `group === 'basic'` を絞って描画します。将来はこのフィルタ条件を `$state<ColumnGroup>` の選択値に差し替え、ディスクリプタへ行を足すだけで option / validation 表示に拡張できます。切り替え UI 自体は今回作りません。

この形でよろしければ実装に入ります。

## Design points captured in plan updates

- 列は markup 直書きではなく列ディスクリプタ配列から描画
- `src/lib/components/component-attribute-columns.ts` に `ColumnGroup` / `ColumnKind` / `AttributeColumn` と basic 5列を定義
- 各列は `group` / `kind` / `get` / `set`（function binding）
- 今回の表示は `group: basic` のみ。切り替え UI は作らないが `$derived` フィルタ差し込み点を用意
- 見た目・機能は案1どおり（basic 5列、シードなし、0件時メッセージ）
