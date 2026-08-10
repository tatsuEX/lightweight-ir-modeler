# PrimeFaces XHTML Reader（Import）実装案

日付: 2026-08-10 06:13

## 問題 / ゴール

`fast-xml-parser` を依存に追加済み。IM-Forma JSON の Import は実装済みだが、
`primefaces`（`.xhtml`）は Reader 未登録のため UI にも出ない。

ゴール:

1. Export 成果物（`form.hbs` + `components/<type>.hbs`）を主入力として取り込む
2. IM-Forma と同じパイプライン（Reader → validate → Transformer → `loadImported`）に載せる
3. ベンダー固有属性・未対応タグは `external['primefaces']` 残余で往復可能にする
4. **バイト完全一致は目指さない**（Handlebars の空白・属性順・コメント整形）。意味的往復（re-export 後の Raw/shape 相当）を成功条件にする

## 提案アプローチ

### パイプライン（IM-Forma と対称）

```text
.xhtml
  → parseXml（fast-xml-parser）
  → unshapePrimeFaces（ベンダー DOM → Raw）
  → validateRawDefinition('primefaces', raw)
  → transformFromPrimeFacesRaw（Raw → IR）
  → UIDefinition.loadImported()
```

`fast-xml-parser` の依存は **`parse-xml.ts` のみ**に閉じる（unshape / Reader は抽象 tree を受け取る）。

### parse 設定（推奨）

| オプション | 値 | 理由 |
|---|---|---|
| `ignoreAttributes` | `false` | 属性が意味の大半 |
| `attributeNamePrefix` | `@_` | FXP 慣例。unshape で strip |
| `preserveOrder` | `true` | panelGrid 内の label/control 順序がフィールド順 |
| `commentPropName` | `#comment` | `unsupported.hbs` と先頭コメント（name/description）を拾う |
| `ignoreDeclaration` / `ignoreDoctype` | `true`（本文処理） | 宣言自体は document 残余へ別途退避可 |
| `isArray` | `f:selectItem` 等を常配列 | 1 件でも配列扱い |
| `removeNSPrefix` | **`false`（既定）** | `p:inputText` と `h:form` をプレフィックス付きで判別したい |

名前空間 URI 解決まではやらない（prefix 文字列一致で十分。export が固定 prefix）。

### unshape の走査規則

1. ルートから `h:form` を探し、`@_id` → Raw `logicalId`
2. `h:head/title` または先頭 HTML コメント 1 行目 → `name`（コメント 2 行目 → `description`）
3. `p:panelGrid` の子を **文書順**に走査し、ペアを組む:
   - `p:outputLabel` → 次の「コントロールノード」または `unsupported` コメントと結合
   - `for` とコントロール `id` が一致すればその label を採用。不一致時は文書順ペアを優先し WARN
4. コントロール → IR `type` はタグ＋属性の判別表（下表）
5. 既知属性だけ Raw 語彙へ。残りは `external['primefaces']`
6. document 残余: `xmlns*`、`p:messages`、未知の兄弟、XML 宣言有無など

### タグ判別表（Export の逆）

| PrimeFaces / ノード | IR `type` | 判別の追加条件 |
|---|---|---|
| `p:inputText` | `textbox` | |
| `p:inputTextarea` | `textarea` | `rows` / `cols` |
| `p:inputNumber` | `number` | |
| `p:selectManyCheckbox` | `checkbox` | 子 `f:selectItem` → `items[]` |
| `p:selectOneRadio` | `radio` | 同上 |
| `p:selectOneMenu` | `dropdown` | 同上 |
| `p:selectManyMenu` | `dropdown-multi` | 同上 |
| `p:datePicker` + `selectionMode="range"` | `date-span` | |
| `p:datePicker` + `timeOnly="true"` | `timepicker` | |
| `p:datePicker` + `showTime="true"` | `datetimepicker` | |
| `p:datePicker`（上記以外） | `datepicker` | `pattern` → `format` |
| `p:outputText` | `label` | `value` → `label`（outputLabel と二重なら outputLabel 優先） |
| `<!-- unsupported type: T id=I -->` | `T`（または `unknown`） | 正規表現で type/id を救出。コントロール本体は無い |

属性マップ（既知）:

| XHTML | Raw / IR |
|---|---|
| `id` | `logicalId` |
| `required="true"` | `required` + `validation.required` |
| `disabled` / `readonly` | 同名 boolean |
| `placeholder`（inputText/Textarea） | `hint` |
| `pattern`（datePicker） | `format` |
| `showButtonBar="true"` | `clearable: true` |
| `f:selectItem itemLabel/itemValue` | `items[].label/value` |

WARN: Export の日付 `placeholder` は `format` からの派生で IR に無い。Import 時は `pattern` のみ信頼し、日付系の `placeholder` 属性は残余か無視。

### MVP スコープ

**Phase 1（推奨スライス）**

- 自プロジェクト Export 成果物を主サポート
- 対応 type: Export テンプレートがあるもの全部（unsupported コメント救出含む）
- `version` は XHTML に無い → 空 or `1.0.0` 既定（要決定）
- UI: import registry + client に `primefaces` を追加（`.xhtml` accept）

**Phase 2（明示的に後回し）**

- 手書き Facelet / 任意レイアウト（panelGrid 以外）
- EL（`#{...}`）の解釈
- PrimeFaces の全コンポーネント網羅
- バイト完全ラウンドトリップ

### 往復テストの成功条件

1. 手元の `data/export/primefaces/**/*.xhtml` を import → store 相当の IR を得る
2. 同じ IR を `exportFromEditorState('primefaces', ...)` し、**再 shape 後の fields 配列**が意味的に一致
3. 未知属性を載せた fixture で `external['primefaces']` が残ること

空白・属性順・自己閉じの差は比較前に正規化する。

## 変更対象ファイル

### 新規

| パス | 役割 |
|---|---|
| `src/lib/server/io/readers/parse/parse-xml.ts` | `fast-xml-parser` ラッパ（JSON の `parse-json.ts` 対称） |
| `src/lib/server/io/readers/unshape/primefaces-unshape.ts` | DOM tree → Raw（上表） |
| `src/lib/server/io/readers/primefaces-reader.ts` | `DefinitionReader`（`.xhtml` / 必要なら `.xml`） |
| `src/lib/transform/primefaces-transform.ts` へ `transformFromPrimeFacesRaw` | Raw → IR（`fields` 配列、`mapRawFieldToComponent` 再利用） |
| `*.spec.ts`（parse / unshape / reader / pipeline 往復） | |
| `docs/use-cases/ui-import.md` / `primefaces-export.md` または `primefaces-import.md` | 契約 |

### 変更

| パス | 変更点 |
|---|---|
| `src/lib/server/ui/import-target-registry.ts` | `primefaces` バンドル登録 |
| `src/lib/store/layout-editor/ui-import-client.ts` | `PrimeFacesImportClient`（accept `.xhtml`） |
| `src/lib/server/io/writers/shape/primefaces-shape.ts` | document/field の `external['primefaces']` を先 spread（IM-Forma と同パターン）。**Export 往復のため必須** |
| `src/lib/transform/primefaces-transform.ts` | export 側でも meta.`external` を Raw に載せる |
| `schemas/raw/primefaces.schema.json` | `external` を任意プロパティとして明示（im-forma と同様） |
| `docs/use-cases/ui-import.md` | target 表に `primefaces` |
| `docs/api/http-endpoints.md` / `docs/README.md` | 必要最小限 |
| `.articles/YYYY-MM-DD.md` | 実装時に追記 |

### 触らない（意図的）

| パス | 理由 |
|---|---|
| `export-pipeline.ts` / `export-target-registry.ts` | Import 追加だけで足りる |
| `templates/export/primefaces/**` | Reader はテンプレを読まない（タグ表はコード側の SSOT） |
| `DefinitionImportModal.svelte` | registry 経由で自動表示される想定 |

## 却下 / 非採用

| 案 | 理由 |
|---|---|
| cheerio / HTML parser | 名前空間付き Facelet に不向き |
| shape を経由して Raw を作る | shape は export 用 union。Import はベンダー DOM → Raw が正しい境界 |
| テンプレートファイルを実行時に逆コンパイル | 過剰。タグ表の静的マップで足りる |
| 完全バイト往復 | Handlebars 整形差で破綻しやすい |

## 未決定（実装前に決めるとよい）

1. `version` 欠落時の既定値（空文字 vs `DEFAULT_UI_DEFINITION_VERSION`）
2. accept 拡張子を `.xhtml` のみにするか `.xml` も許すか
3. `p:messages` を常に破棄するか document 残余に残すか（再 export で form.hbs が固定出力するなら破棄でよい）
4. unsupported コメント救出を Phase 1 に含めるか（含めると既存 sample xhtml の checkbox 等が復活できる）

## 推奨決定（提案）

- `version`: 空なら `DEFAULT_UI_DEFINITION_VERSION`（`1.0.0`）
- accept: `.xhtml` のみ（MVP）
- `p:messages`: document 残余ではなく **既知スケルトンとして無視**（export が常に出し直す）
- unsupported コメント救出: **Phase 1 に含める**（既存 export 成果物の実用性が上がる）
