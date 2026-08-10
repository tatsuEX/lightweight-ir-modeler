---
created: "2026-08-10T06:20:00"
updated: "2026-08-10T06:20:00"
summary: "PrimeFaces XHTML Import: parse-xml / unshape / タグ判別と unsupported コメント救出"
features:
  - ui-import
  - primefaces
  - fast-xml-parser
  - external-residual
---

# PrimeFaces Import（XHTML / Facelet）

最終更新: 2026-08-10 06:20

Import 全体のパイプラインは [外部 UI 定義の取り込み（Import）](./ui-import.md) を参照。  
本稿は **target `primefaces` 固有** の parse / unshape / タグ判別をまとめる。

Export 側のテンプレート対応は [PrimeFaces Export](./primefaces-export.md)。

## 成果物（入力）

| 項目 | 値 |
|---|---|
| 拡張子 | `.xhtml` のみ |
| parse | `fast-xml-parser`（`preserveOrder: true`） |
| unshape | `unshapePrimeFaces` |
| transform | `transformFromPrimeFacesRaw` |
| Reader | `PrimeFacesReader` |

主サポートは **本プロジェクトの Export 成果物**（`form.hbs` + `components/<type>.hbs`）。  
手書き Facelet の任意レイアウトは対象外。

## 走査規則

1. `h:form@_id` → Raw `logicalId`
2. `h:head/title`（なければ先頭コメント 1 行目）→ `name`
3. 先頭コメント 2 行目 → `description`（無ければ空文字）
4. `version` は XHTML に無い → `DEFAULT_UI_DEFINITION_VERSION`（`1.0.0`）
5. `p:panelGrid` 子を文書順に走査し、`p:outputLabel` と次のコントロール（または unsupported コメント）をペアリング
6. `p:messages` は無視（Export が常に出し直す）

## タグ判別

| ノード | IR `type` | 追加条件 |
|---|---|---|
| `p:inputText` | `textbox` | `placeholder` → `hint` |
| `p:inputTextarea` | `textarea` | `rows` / `cols` / `maxlength` |
| `p:inputNumber` | `number` | |
| `p:selectManyCheckbox` | `checkbox` | 子 `f:selectItem` → `items[]` |
| `p:selectOneRadio` | `radio` | 同上 |
| `p:selectOneMenu` | `dropdown` | 同上 |
| `p:selectManyMenu` | `dropdown-multi` | 同上 |
| `p:datePicker` + `selectionMode="range"` | `date-span` | `pattern` → `format` |
| `p:datePicker` + `timeOnly="true"` | `timepicker` | 同上 |
| `p:datePicker` + `showTime="true"` | `datetimepicker` | 同上 |
| `p:datePicker`（上記以外） | `datepicker` | 同上 |
| `p:outputText` | `label` | `id` は直前の `outputLabel for` |
| `<!-- unsupported type: T id=I -->` | `T` | 正規表現で救出 |

- `showButtonBar="true"` → `clearable: true`
- 日付系の `placeholder` は Export 派生マスクのため **取り込まない**（`pattern` のみ信頼）
- `layout` / `showCheckbox` はテンプレート骨格として無視（残余に入れない）

## external 残余

| 位置 | 例 |
|---|---|
| 定義 | `html` の `xmlns` / `xmlns:*` |
| 要素 | 既知属性以外（例: `data-extra`） |

Export の shape は残余を先に spread する。Handlebars テンプレートは既知キーのみ参照するため、  
未知属性の **XHTML への再出力は保証しない**。意味的フィールド往復（type / id / label / items / format 等）を成功条件とする。

## 関連実装

| 領域 | パス |
|---|---|
| parse | `src/lib/server/io/readers/parse/parse-xml.ts` |
| unshape | `src/lib/server/io/readers/unshape/primefaces-unshape.ts` |
| Reader | `src/lib/server/io/readers/primefaces-reader.ts` |
| Transformer | `src/lib/transform/primefaces-transform.ts`（`transformFromPrimeFacesRaw`） |
| Client | `src/lib/store/layout-editor/ui-import-client.ts`（`PrimeFacesImportClient`） |
