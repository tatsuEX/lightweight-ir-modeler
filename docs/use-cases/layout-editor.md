---
created: "2026-08-08T22:54:00"
updated: "2026-08-24T23:50:00"
summary: "Property 属性テーブルの列ヘッダフィルタと snapshot 運用コメント"
features:
  - layout-editor
  - ui-definition
  - preview
  - ir-snapshot
  - property-attributes
  - property-column-filters
  - yaml-comments
  - arrow-navigation
---

# ユースケース: レイアウトエディタ編集

最終更新: 2026-08-24 23:50

## 概要

`/layout-editor` 配下で UI 定義メタとコンポーネント一覧を編集する。  
エントリ `/layout-editor` は `/layout-editor/property` へリダイレクトする。

| 画面 | パス | 主な操作 |
|---|---|---|
| Property | `/layout-editor/property` | コンポーネント追加・属性編集・論理 ID 確定 |
| Layout | `/layout-editor/layout` | 並べ替え（DnD） |
| Preview | `/layout-editor/preview` | 見た目確認・Export / Download |

## アクターと成功条件

- **アクター**: プロトタイプ作成者（ローカル開発者）
- **成功**: メタ（`logicalId` / `name` 等）とコンポーネント列が Context 上の `UIDefinition` に反映され、他タブ・自動保存・Export から参照できる

## 画面構成データフロー

```mermaid
flowchart LR
  subgraph routes
    Prop[property]
    Lay[layout]
    Prev[preview]
  end

  Layout["+layout.svelte\nUIDefinition Context"]
  Server["+layout.server.ts\n最新 snapshot 読込"]
  Store[UIDefinition]
  Auto[attachIrAutoSave]
  API["POST /api/ir/snapshot"]

  Server -->|loadSnapshot| Store
  Layout --> Store
  Prop --> Store
  Lay --> Store
  Prev --> Store
  Store --> Auto
  Auto -->|debounce| API
```

## メタ編集と既存画面の読込

`UiDefinitionMetaAccordion` で画面 ID（内部名 `logicalId`）を blur / オートコンプリート確定したとき:

1. `GET /api/ir/snapshot?logicalId=…` を呼ぶ
2. 見つかれば store をその snapshot で置換
3. **404（未使用 ID）** のとき、設定に応じて確認ダイアログを出し、続行後に現在の components を維持したまま ID だけ切り替える（「既存画面をコピーして別名保存」用途）

定義インポート後も、取り込み結果の画面 ID が未使用なら **同じ確認ダイアログ** を出す（手動変更と共通）。

### 未使用画面 ID の確認ダイアログ

| 項目 | 内容 |
|---|---|
| 表示条件 | 画面 ID が変わり、かつその ID の snapshot が無く、かつ確認が有効なとき |
| 設定 | `layoutEditor.property.confirmSnapshotDirCreation`（既定 `true`） |
| 「次回以降確認しない」 | ブラウザ `localStorage`（`layout-editor.skipConfirmSnapshotDirCreation`）。application.yml は書き換えない |
| キャンセル | ID 変更／取り込みを取り消し |

`logicalId` の妥当性は `isValidLogicalId`（`/^[a-zA-Z][a-zA-Z0-9_-]*$/`）。  
パスセグメントとしても同じ制約（`assertSafeLogicalIdPathSegment`）で traversal を防ぐ。

## Property: 編集可能な項目のみ

属性表上部の Toggle「編集可能な項目のみ」（既定 ON）で、ファクトリ登録済み type だけを一覧表示する。  
OFF にすると非対応 type（パススルー）も含めて全件表示する。Layout / Preview の表示方針とは独立。

## プレビュー描画

```mermaid
flowchart TB
  Store[UIDefinition.components]
  Preview[Preview.svelte]
  Renderer[PreviewComponentRenderer]
  Reg[PREVIEW_COMPONENT_REGISTRY]

  Store --> Preview
  Preview --> Renderer
  Renderer --> Reg
  Reg -->|textbox| PreviewTextbox
  Reg -->|textarea| PreviewTextarea
  Reg -->|number| PreviewNumber
  Reg -->|その他| PreviewUnknown
```

- テーマは `preview-theme--{value}` クラス + `preview-theme-styles.ts`
- Export / Download ボタンは `isUiDefinitionMetaReady` かつ非 busy のときのみ有効

## Property 属性テーブル

`ComponentAttributeTable` で `UIDefinition.components` を行編集する。

- **常時表示列**: 行選択 / `logicalId` / `type` / `label`
- **列グループ切替**（presentation state。IR / snapshot には載せない）: `Basic` | `Details` | `Validation`（関心別。type 名では増やさない）
- Details / Validation は **固定スロット列**（行ごとに td 数が変わらない）。ヘッダは `colspan` でグループ名のみ表示する。
- **viewport 内スクロール**: AppHeader → layout-editor Nav → Property 見出し → メタ Accordion / 列グループ切替は自然高（`shrink-0`）。残り高さをテーブル領域に渡し、表だけ `overflow-auto` する。Accordion の開閉でテーブル高が伸縮する。thead は sticky。セル内スクロールはしない。Datepicker ポップオーバーが表の overflow で切れる場合がある。

| グループ | 追加列 | 編集対象（列位置に type 別フィールドを載せる） |
|---|---|---|
| Basic | hint / required / readonly / disabled | 共通フラグ・hint。非対応は `- not supported -` |
| Details | details-0..2（3 固定） | 0: defaultValue、1: items \| format \| cols、2: rows |
| Validation | validation-0..2（3 固定） | 0: pattern \| maxlength \| min \| minDate / minDateTime(date)…、1: minlength \| max \| maxDate / maxDateTime(date)…、2: textbox maxlength。datetime は同セル内に Datepicker + Timepicker（時刻は `validation-N-time`） |

### 列ヘッダフィルタ

単一入力列のヘッダにフィルタを置く（presentation state。IR / snapshot には載せない）。Details / Validation の複合列は対象外。

パイプライン: `components` → 「編集可能な項目のみ」 → 列フィルタ（列横断 **AND**、type は選択 **OR**） → 表示行。

| 列 | コントロール | マッチ |
|---|---|---|
| 行選択 | なし | — |
| id（`logicalId`） | 一致モード + テキスト | 前方 / 部分 / 後方（既定: 部分）。大小無視。空 query は全件 |
| type | 複数チェック Dropdown | 未選択 = 全件。選択肢は「編集可能のみ」適用後に存在する type + 件数 |
| label / hint | テキスト | 部分一致・大小無視 |
| required / readonly / disabled | すべて / ON / OFF | 非対応（`undefined`）は ON / OFF に一致しない |
| Details / Validation | なし | — |

- ツールバーに `表示件数 / フィルタ前件数` と、アクティブ時の「フィルタをクリア」
- Basic 以外でも hint / boolean フィルタは効いたまま（隠れ列のフィルタはクリアで解除）
- すべて選択・選択削除・`rowIndex` は **フィルタ後の行** が対象。フィルタで非表示になった行の選択は解除する
- type / 一致モードの Dropdown は Flowbite Popper（popover）を使う（表の `overflow-auto` で切れないようにする）

### 矢印キーナビ（`arrowNavigation`）

- 各入力は一意の `field`（`details-N` / `validation-N` 等）を持つ。Details / Validation スロットは `fieldGroup`（`details` / `validation`）も付与する。
- **左右**: 同一行の focusable のみ。テキストおよび `date` / `time` 等は、先頭で左 2 連続・末尾で右 2 連続、または Ctrl+左右でセル遷移（1 回では遷移しない）。datetime 境界は `datetime-local` ではなく Datepicker（text）+ Timepicker を並べ、日付側は Selection API で終端判定する。
- **Datepicker カレンダー**: フォーカスで開くが blur では閉じない（Flowbite 仕様）。セル外へフォーカスが移ったら outside-click 相当で閉じ、下行編集を遮らない。
- **上下（fieldGroup あり）**: 最寄り行で同 group の入力がある行へ着地 → 同行内で同 `field` → なければ ordinal / 先頭。遠い行の同 field へ飛ばない。
- **上下（fieldGroup なし / Basic）**: 同 `field` の最寄り行（未対応行はスキップ）。
- **列ヘッダフィルタ**: 対象外（Tab でヘッダ ↔ 行を移動）。ヘッダ ↔ 行の矢印遷移は未実装。

日付系 IR の SSOT は `format` のみ（`placeholder` は持たない）。PrimeFaces export 時の HTML `placeholder` は shape が `format` の英字トークンを `_` マスク化した文字列を導出する。

`TagsInput` は IR 非依存（Enter / カンマで追加、Badge で削除）。`data-arrow-nav-focus` により外側の `arrowNavigation` が削除ボタンではなく入力へフォーカスする。

items 表記は `${value}${itemDelimiter}${label}`（同一なら区切りなし）。`itemDelimiter` は `config/application.yml` の `layoutEditor.property.itemDelimiter`（既定 `|`）。

## 運用コメント（Markdown）

snapshot YAML の `#` コメントを Property から編集する。IR フィールドには載せない。

| 対象 | UI | YAML パス |
|---|---|---|
| 画面メタ全体 | アコーディオン右上の `#` | `uiDefinition` |
| 各コンポーネント | 行の `#` 列 | `components[i]`（要素先頭） |
| `external` | メタ内ツリー / 行の `external` 折りたたみ | `uiDefinition.external…` / `components[i].external…` |

入力は Monaco Modal（`language: markdown`）。コメント済みの `#` は hover / focus で Markdown プレビュー。

## コンポーネント種別（現状）

Factory: `createTextbox` / `createTextarea` / `createNumber` / `createCheckbox` / `createRadio` / `createDropdown` / `createDropdownMulti` / `createDatepicker` / `createDateSpan` / `createDatetimepicker` / `createTimepicker` / `createLabel` など。  
共通フィールド例: `id`, `type`, `logicalId`, `label`, `validation` など。  
`id` は編集セッション用。snapshot 保存時は除去し、読込時に `nanoid` で再生成する。

## 関連実装

| 領域 | パス |
|---|---|
| App shell | `src/routes/+layout.svelte` |
| Store | `src/lib/store/layout-editor/layout-editor.svelte.ts` |
| Layout shell | `src/routes/layout-editor/+layout.svelte` |
| Property 画面 | `src/routes/layout-editor/property/+page.svelte` |
| 初期読込 | `src/routes/layout-editor/+layout.server.ts` |
| 属性テーブル | `src/lib/components/ComponentAttributeTable.svelte` |
| テキスト列マッチ | `src/lib/utils/text-match.ts` |
| Details セル | `src/lib/components/ComponentDetailsCell.svelte` |
| Validation セル | `src/lib/components/ComponentValidationCell.svelte` |
| TagsInput | `src/lib/components/TagsInput.svelte` |
| Preview | `src/lib/components/Preview.svelte` |
