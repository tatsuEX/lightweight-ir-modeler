# UIDefinition 純クラス分割 — 命名修正と確認点の意図

Date: 2026-09-06 23:29

## 前提の修正

初回提案（`2026-09-06-2315-ir-definition-pure-class-split.md`）のドメインクラス名 `IRDefinition` / ファイル `ir-definition.ts` は使わない。

理由: 後続で layout IR（画面構造・配置）など、UI 定義とは別種類の IR を足す。汎用名 `IRDefinition` を UI 定義集約に使うと、種類が増えたときに名前が衝突する。

| 役割 | 修正後 |
|---|---|
| ドメイン純クラス | `UIDefinition`（UI 定義 IR の集約。Svelte 非依存） |
| データバッグ | `UIDefinitionData` |
| ファイル | `src/lib/ir/ui-definition.ts` |
| `$state` 工場 | `createReactiveUIDefinition`（store） |
| Context 名 | `getUIDefinitionContext` / `setUIDefinitionContext`（変更なし。型は純クラス `UIDefinition`） |

`ir/` は種類の置き場のまま。クラス名は種類ごと（`UIDefinition`、将来の layout IR 用クラス）にする。

## 確認点の確定

1. ファクトリは `$lib/ir/elements/factories` へ移動。`ComponentToolPalette` はそこを直接 import。store からの互換 re-export はしない
2. `toEditorMeta` をクラスに足す件は、分割の必須ではない（下記）。実装時の既定は **足さない**
3. 実装はまだしない

## 確認点の意図（後追い）

初回末尾の確認は「どちらでも分割は成立するが、選ばないと後で境界が滲む」という任意選択だった。ブロッカーではない。
