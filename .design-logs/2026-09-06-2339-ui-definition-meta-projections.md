# UIDefinition メタの投影（確認点 2 の本意）

Date: 2026-09-06 23:39

## 何の話だったか

初回確認点 2（`toEditorMeta` をクラスに足すか）は、症状だけを聞いていた。  
本丸は「GUI の生きた状態」と「ファイルへ出す正規化済みメタ」が、同じ `UiDefinitionEditorMeta` 型に畳まれていること。

`Required<Pick<…>>` / `Omit<…>` で投影を型として分ける、という理解の方が正確。この分割（`$state` 切り離し）の必須作業ではない。

## すでに存在する投影（名前が付いていない）

| 層 | 実体 | 任意項目 | システム日時 | ライフサイクル（basedOn 等） |
|---|---|---|---|---|
| GUI 生きた状態 | `UIDefinition` ゲッター | 空文字 `''`（bind 用） | なし | 持つ |
| エディタ DTO | `UiDefinitionEditorMeta` | 空ならキー省略 | なし | 持つ |
| snapshot YAML | `UiDefinitionSnapshotMeta` | キー省略 | `createdAt` / `modifiedAt` | 持つ |
| ベンダー Export Raw | transform が使う部分集合 | — | なし | **使わない** |

`toEditorMeta` は「外部 UI ファイル用」ではなく、snapshot システム日時を剥がし任意キーを省略する正規化。ベンダーファイルはさらに `logicalId` / `name` / `description` / `version` / `external` だけを transform する。
