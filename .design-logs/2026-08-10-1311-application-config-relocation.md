# application-config の責務・可視性再配置 / import 後 auto-save 方針

日付: 2026-08-10 13:11

## 問題 / ゴール

1. logicalId UI: import 後は入力開始に伴い auto-save される方が望ましい（設計更新）
2. `application-config` を「呼び出し順カプセル化」ではなく **責務分離 + 可視性** で再配置する

## logicalId / auto-save（実装は別途）

- import 結果は `loadImported` で store に載る（meta ready なら既存 `$effect` でも保存候補）
- 方針更新: 「logicalId 入力中は store を汚さない」を優先しすぎない
- import 後にユーザーが編集を始めたら auto-save で snapshot を残す
  - 同一外部 UI 定義との差分材料
  - import 後編集の喪失防止
- UI 同期（focus-scoped draft）実装時も、import 直後〜初回編集で snapshot が残ることを確認観点に含める

## config 再配置

| モジュール | 責務 | 可視性 |
|---|---|---|
| `lib/config/application-types.ts` | yml 静的構造 type | クライアント可 |
| `lib/config/layout-editor-config.ts` | layoutEditor 断片 + 既定値 | クライアント可 |
| `lib/config/preview-config.ts` | preview 断片（既存） | クライアント可 |
| `server/config/application-config-yaml.ts` | 読込・merge・パス | サーバのみ |
| `server/config/application-config-parse.ts` | 正規化パース | サーバのみ |
| `server/config/application-config.ts` | 公開ロード API・キャッシュ | サーバのみ（type は re-export） |

- `DEFAULT_ITEM_DELIMITER` の server 再エクスポートは廃止（公開ホームは `lib/config` のみ）
- 呼び出し元は従来どおり `application-config.ts` の `loadApplicationConfig()` 等を使う

---

## 追記（2026-08-10 13:55）Import 寛容性

`my-new-next` 系で components が空になる件は、実ファイルの自己閉じ `<p:panelGrid ... />` が原因（子が form 兄弟になる）。

**決定:** Reader / unshape を寛容にして救済しない。  
大原則は「実外部 UI 環境で問題のない画面定義を取り込み → 微調整 → 別環境向けに出力」。壊れたマークアップの補完は対象外。