---
created: "2026-08-09T22:40:58"
updated: "2026-08-09T23:50:00"
summary: "PrimeFaces Export: shape union・component hbs・日付 placeholder マスク導出"
features:
  - ui-export
  - primefaces
  - handlebars
---

# PrimeFaces Export（Facelet / Handlebars）

最終更新: 2026-08-09 23:50

Export 全体のパイプライン・API・検証境界は [外部 UI 定義の出力（Export）](./ui-export.md) を参照。  
本稿は **target `primefaces` 固有** の shape・テンプレート合成・コンポーネント対応をまとめる。

## 成果物

| 項目 | 値 |
|---|---|
| ファイル名 | `<logicalId>.xhtml` |
| Content-Type | `application/xhtml+xml; charset=utf-8` |
| Transformer | `transformToPrimeFacesRaw` |
| shape | `shapePrimeFaces` |
| serialize | Handlebars（`form.hbs` + `components/<type>.hbs`） |
| テンプレート根 | `app.io.export.templates.primefaces.dir`（既定 `./templates/export/primefaces`） |

## 合成フロー

1. 検証済み Raw を `shapePrimeFaces` で field context へ整形
2. 各 field の `type` → `components/<type>.hbs` を描画（未知 / 不正 type は `unsupported.hbs`）
3. 描画結果を `SafeString` として form context の `markup` に載せる
4. `form.hbs` の `{{{markup}}}` でレイアウトへ統合

HTML escape は **component / form テンプレートの `{{ }}`** に委譲する。独自 `escapeHtml` は使わない。

## 責務分担

| 層 | 責務 |
|---|---|
| `form.hbs` | ページ骨格・`h:form`・`p:panelGrid`・`p:outputLabel`（レイアウト） |
| `components/*.hbs` | type 別の入出力コントロールのみ |
| `shapePrimeFaces` | テンプレート用キー寄せ・既定値・派生。**ベンダー tag 名は持たない** |

- `outputLabel for` と入力 `id` は同一 field の `{{id}}` で対応付ける
- `form.hbs` は `xmlns:f`（JSF core）を含む（`f:selectItem` 用）

## shape（discriminated union）

`PrimeFacesFieldShape` は `type` を discriminant とする union。

| グループ | IR `type` | 追加フィールド |
|---|---|---|
| 共通 | （すべて） | `id` / `label` / `hint` / `required` / `disabled` / `readonly` |
| 単純入力 | `textbox` / `number` | （共通のみ） |
| textarea | `textarea` | `rows` / `cols` / `maxlength`（任意） |
| label | `label` | （共通のみ） |
| select | `checkbox` / `radio` / `dropdown` / `dropdown-multi` | `items[]`（`label` / `value`） |
| date | `datepicker` / `datetimepicker` / `timepicker` | `format` / `clearable`（shape の `placeholder` は `format` から導出） |
| date-span | `date-span` | 上記 + `requiredFrom` / `requiredTo` |

- select の Raw `items` が文字列のときは `label`/`value` 同一として正規化する
- 日付系 IR の SSOT は `format` のみ。未指定時の既定: `yyyy-MM-dd` / `yyyy-MM-dd HH:mm` / `HH:mm`（type 別）
- テンプレート用 `placeholder` は shape が `format` の英字トークンを同長 `_` に置換して導出する（例: `yyyy-MM-dd HH:mm` → `____-__-__ __:__`）。IR に `placeholder` は持たない
- `clearable === true` のときテンプレートは `showButtonBar="true"` を出力する
- EL バインド（`value="#{...}"`）は IR 非搭載方針のため **出力しない**（静的スケルトンのみ）

## IR type → PrimeFaces タグ

| IR `type` | PrimeFaces タグ | 備考 |
|---|---|---|
| `textbox` | `p:inputText` | |
| `textarea` | `p:inputTextarea` | |
| `number` | `p:inputNumber` | |
| `checkbox` | `p:selectManyCheckbox` | `layout="lineDirection"`、`f:selectItem` |
| `radio` | `p:selectOneRadio` | 同上 |
| `dropdown` | `p:selectOneMenu` | `f:selectItem` |
| `dropdown-multi` | `p:selectManyMenu` | `showCheckbox="true"` |
| `datepicker` | `p:datePicker` | `pattern` ← shape `format` |
| `date-span` | `p:datePicker` | `selectionMode="range"` |
| `datetimepicker` | `p:datePicker` | `showTime="true"` |
| `timepicker` | `p:datePicker` | `timeOnly="true"` |
| `label` | `p:outputText` | `value="{{label}}"` |
| （その他） | `unsupported.hbs` | HTML コメントで type / id を残す |

テンプレートパス解決: `type` が `^[a-zA-Z][a-zA-Z0-9_-]*$` かつファイル存在時のみ `components/<type>.hbs`。それ以外は `unsupported.hbs`。

## 関連実装

| 領域 | パス |
|---|---|
| Writer | `src/lib/server/io/writers/primefaces-writer.ts` |
| shape | `src/lib/server/io/writers/shape/primefaces-shape.ts` |
| serialize | `src/lib/server/io/writers/serialize/serialize-handlebars.ts` |
| Transformer | `src/lib/transform/primefaces-transform.ts` |
| Raw field 写像 | `src/lib/transform/ir-to-raw-fields.ts` |
| Schema | `schemas/raw/primefaces.schema.json` |
| Templates | `templates/export/primefaces/` |
