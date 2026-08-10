# 外部 UI 定義の取り込み（Import）と残余保持

日付: 2026-08-10 05:10

## 問題 / ゴール

layout-editor に外部 UI 定義ファイル（IM-Forma JSON）を取り込む動線が無い。Export は
`IR → transform → validate → shape → serialize → write` まで実装済みだが、逆方向は 1 行も無く、
`app.io.importDir` が予約されているだけだった。

さらに厄介なのは **外部定義が持つベンダー内部のシステム ID**。IR はそれをモデル化しないため、
素直に取り込むと次回 export で欠落し、外部システムへ戻せなくなる。

ゴール:

1. アップロードしたファイルを Reader → SchemaValidator → Transformer に通して IR を得る
2. IR がモデル化しないキーを失わず、次の export で元通り復元する
3. 取り込み結果でエディタの編集状態を丸ごと置き換える

## 採用した方式

### パイプライン（export の鏡像）

```text
アップロードファイル
  → DefinitionReader（parse → unshape）→ RawDefinition
  → SchemaValidator（JSON Schema → Zod）
  → Transformer → IR（uiDefinition + components）
  → store.loadImported()
```

`shape` の逆を `unshape`、`serialize` の逆を `parse` として対称に置いた。target 解決は
`import-target-registry.ts`（export 側 registry は変更しない）。

### 残余（residual）保持

Reader は「知っているキー」だけを Raw 語彙へマップし、**残り全部**を target 名前空間付きの
バッグへ退避する。

- 定義レベル: `uiDefinition.external['im-forma']`
- 要素レベル: `component.external['im-forma']`

export 時は `shapeImForma` が残余を **先に** spread し、IR 所有キーで上書きする。
これにより IM-Forma の実仕様書が無くても往復性が保てる。

## 却下した代替案

| 案 | 却下理由 |
|---|---|
| side-car（定義単位の `logicalId → 外部ID` マップ） | `logicalId` はエディタで自由に変更できる。rename すると外部 ID が孤児化する |
| 元ドキュメント全文を base document として保持し export 時に全体 deep merge | 要素の追加 / 削除 / 並べ替えに対するマージ規則が必要になり、YAGNI から外れる |
| 外部 ID を IR の第一級フィールドにする | IR が特定ベンダーの語彙に依存する。`ir-definition.mdc` の「外部 UI フレームワークに依存しない」に抵触 |

`external` は **target 名前空間の不透明な bag** であり、外部フレームワークの型を IR に持ち込まない。
中身を解釈するのは Reader / shape（形式固有層）だけ、という線引きで上記ルールとの整合を取る。

## 決定事項

- 取り込み方式は **ファイルアップロード（multipart）**。`app.io.importDir` は引き続き未使用
- target は dropdown で明示選択。ただし **Reader 実装済み target のみ表示**（現状 `im-forma` のみ）
- PrimeFaces XHTML の Reader は非対応。Handlebars 生成マークアップの逆解析は損失が大きく、
  XML パーサ依存も増えるため、必要になった時点で別途設計する
- エディタ用 `id`（nanoid）は Transformer では採番しない。presentation 層のファクトリ
  （`createComponentByType`）が付与する

## 未解決 / 留意点

- IM-Forma の実仕様書・実ファイルがリポジトリに無い。現 Reader は `shapeImForma` の逆として実装している。
  実ファイルが入手でき次第、spec を追加して差分を吸収する
- `formId` が `^[a-zA-Z][a-zA-Z0-9_-]*$` を満たさない場合は 400 で弾く。自動サニタイズはしない
  （元の値は残余に残るため、手で logicalId を直せば往復は維持される）
- component 複製機能を将来足す場合、`external` を引き継ぐと外部システム ID が重複する。
  複製時は落とす必要がある
