---
created: "2026-09-07T04:46:00"
summary: "arcane:summon のコード生成テンプレートを新規作成する手順。context / helper / projection / spec 追加"
updated: "2026-09-07T04:46:00"
features:
  - maintenance
  - arcane
  - handlebars
  - plugins
---

# 保守手順: `arcane:summon` テンプレート新規作成

最終更新: 2026-09-07 04:46

IR snapshot から Handlebars で任意コードを生成するテンプレートを追加する手順です。CLI の利用者向け仕様は [IR snapshot からの簡易コード生成](../use-cases/arcane-summon.md) を参照してください。

**テンプレート追加は本番コードの変更を伴いません。** `.hbs` を 1 枚置いて spec を足すだけです。context を変える必要が出たら、それは別の変更として扱ってください。

## 1. 置き場所と命名

```
templates/cli/summon/<targetId>/<出力物>.<拡張子>.hbs
```

例: `templates/cli/summon/primefaces/create-table.sql.hbs`。**生成物の拡張子を `.hbs` の前に残します**（`.sql.hbs` / `.js.hbs` / `.tsv.hbs`）。エディタのシンタックスハイライトと用途の判別のためです。

`templates/export/<targetId>/` は Writer が使う**別機構**です（`application.yml` の `app.io.export.templates` で解決）。混ぜないでください。

## 2. ヘッダコメントの規約

既存サンプルはすべて `{{!-- --}}` ブロックで始まります。`{{! }}` ではなく `{{!-- --}}` を使う（出力から除去される）点に注意してください。

構成は「1 行目にツール名と target → 出力物と非自明なルールの説明 → 空行 → 実行できる `npm run` コマンド」です。

```1:9:templates/cli/summon/primefaces/create-table.sql.hbs
{{!--
  arcane:summon サンプル（target: primefaces）
  uiDefinition.logicalId を表名、各 component.logicalId を列名にした CREATE TABLE。
  label 型は表示専用のため列にしない。カンマは先頭置き（末尾カンマ回避）。
  文字数は validation.maxlength。--projection db-maxlength 時は validation.dbMaxlength を優先。

  npm run arcane:summon -- --target primefaces --template ./templates/cli/summon/primefaces/create-table.sql.hbs --source ./path/to/ir-snapshot.yaml
  npm run arcane:summon -- --target primefaces --template ./templates/cli/summon/primefaces/create-table.sql.hbs --source ./path/to/ir-snapshot.yaml --projection db-maxlength
--}}
```

コマンド行はテンプレート自身のパスを書きます。projection 対応版があるなら 2 行並べます。コメントは日本語です。

## 3. 使える context

`SummonTemplateContext`（`scripts/lib/summon.ts`:17）が全量です。

| キー | 内容 |
|---|---|
| `target` | `--target` の値そのまま |
| `schemaVersion` | IR **構造**版（現行 `1.0`） |
| `savedAt` | snapshot envelope の ISO 文字列 |
| `uiDefinition` | メタ。`logicalId` / `name` / `description` / `version` / `createdAt` / `modifiedAt`、任意で `basedOn` / `changeReason` / `releasedAt` / `closedAt` / `closedReason` |
| `components` | 復元済み component 配列 |
| `external` | 画面レベルの残余（`uiDefinition.external` と同じ値） |
| `componentsByLogicalId` | `--projection by-logical-id` のときだけ存在 |

### `external` は既に target で平坦化されている

これが最も間違えやすい点です。context に入る時点で**その target のバッグの中身に潰されています**。

```
snapshot: external: { primefaces: { formId: 'f' }, 'im-forma': {...} }
  ↓ --target primefaces
context: external: { formId: 'f' }
```

つまり `{{external.formId}}` が正しく、`{{external.primefaces.formId}}` は**解決しません**。`components[].external` も同じ規則です。他 target の残余はテンプレートから見えません。

### 気をつける点

- **`components[].id` を安定キーに使わないこと。** 復元のたびに `nanoid(16)` で再採番されます。安定した識別子は `logicalId` です
- **任意メタは省略されます。** `basedOn` などは値が無いとキー自体が無いので `{{#if}}` で守ってください
- **`false` / `0` は空文字で出ます。** `{{ }}` の性質なので、真偽値は `{{#if}}` か明示的な文字列化が必要です
- **ハイフンを含む `logicalId` はドットパスで引けません。** 組み込みの `lookup` を使ってください
- **`schemaVersion` と `uiDefinition.version` は別物です。** 前者は IR 構造版、後者は利用者の画面定義の製品版です

## 4. 使える構文

登録されている helper は **`eq` 1 つだけ**です（`scripts/lib/summon.ts`:9）。arity 2、厳密比較（`===`）なので `(eq maxlength "64")` は数値相手だと false になります。

これに Handlebars 4.7 の組み込みが加わります: `if` / `unless` / `each` / `with` / `lookup` / `log`、`@index` / `@key` / `@first` / `@last`、`this`、`../`、部分式 `(eq a b)`。

**制限:**

- **partial は使えません。** `registerPartial` の呼び出しが無く、CLI は `--template` の 1 ファイルしか読みません。`{{> name}}` は render 時に失敗します
- **`{{{三重括弧}}}` は動きますが、サンプルでは未使用です。** `{{ }}` は HTML エスケープするので、SQL / JS / TSV でも `&` `<` `>` `"` `'` が実体参照になります。IR 由来の文字列から引用符を出す必要があるときだけ `{{{ }}}` を使い、注入リスクを意識してください（日本語はエスケープされません）
- Export 側の Handlebars とは**別インスタンス**で、helper もキャッシュも共有しません

## 5. projection を使う場合

`--projection <ids>` で opt-in します。既定は projection なしです。

| id | kind | 追加されるもの |
|---|---|---|
| `db-maxlength` | `transform` | `components[].validation.dbMaxlength`（`maxlength × bytesPerChar` の切り捨て。既定 3、`--bytes-per-char` で変更） |
| `by-logical-id` | `index` | `componentsByLogicalId` |

**順序は kind で決まります。`transform` が先、`index` が後です。** `--projection` のカンマ順は無関係なので、`by-logical-id,db-maxlength` と書いても `dbMaxlength` は先に計算され、map の値にも入ります。

`--bytes-per-char` は `db-maxlength` にしか渡らないので、`--projection db-maxlength` と併せないと効果がありません。不明な id は `unknown projection plugin: <id>` で異常終了します。

詳細は [プラグイン（射影）](../architecture/plugins.md) を参照してください。

## 6. 出力の挙動

- `--out` 省略時は **stdout**。末尾改行は足されないのでリダイレクトが素直に使えます
- `--out` 指定時は**ファイルだけ**に書き、stdout には何も出ません。親ディレクトリは再帰作成されます
- 警告は常に **stderr**。警告だけなら終了コードは 0 です
- テンプレートは UTF-8 の **BOM なし**で保存してください。BOM は除去されず生成物の 1 行目に混入します
- 改行コードはテンプレートのものがそのまま出ます（正規化なし）
- Windows のコンソールは日本語表示がコードページ依存なので、目視確認は `--out` の方が確実です

## 7. spec を足す（省略不可）

`scripts/lib/summon-samples.spec.ts` が**同梱サンプルを実際に render するテスト**です。ここに 1 ケース足します。

1. `renderSample('<新ファイル>.hbs')` を呼ぶ `it(...)` を追加し、特徴的な出力行を検証する
2. projection のキーを使うテンプレートなら、`projectionIds` 引数付きのケースも足す
3. fixture に足りない IR フィールド（`items` を持つ `dropdown`、`external['<target>']`、`basedOn` など）が必要なら `sampleSnapshot` を**拡張**する。既存 3 ケースが同じ fixture を読むので、作り替えないこと

**fixture の癖:** `summon-samples.spec.ts` の `uiDefinition.external` は target 名前空間**なし**で書かれているため、`{{external.*}}` は空で render されます。画面レベルの `external` を読むテンプレートを足すなら、`summon.spec.ts` 側のように名前空間付きに直してください。

最後に [arcane-summon](../use-cases/arcane-summon.md) のサンプル一覧表に行を足し、frontmatter の `updated` と本文の `最終更新` を更新します。

## 8. `no external[...]` 警告について

```
arcane:summon: no external['<target>'] on uiDefinition or components
```

`uiDefinition` にも**どの component にも**その target の残余が無いときに 1 回出ます。バッグが存在しても中身が空（`external: { primefaces: {} }`）なら「無し」と数えられます。

**これは警告でエラーではありません。** `external: {}` として render は続き、終了コードは 0 です。

テンプレート作者にとって重要なのは、**IR フィールド（`logicalId` / `type` / `label` / `validation`）だけを読むテンプレートでも、snapshot にその target の残余が無ければこの警告が出る**ことです。出力は正しいので追いかける必要はありません。逆に `{{external.*}}` が全部空になる症状が出たら、まず `--target` の綴りと snapshot の名前空間キーを疑ってください。`--target` は registry 照合されない自由文字列です。

`projection by-logical-id: duplicate logicalId "<id>" (last wins)` は別物で、projection 側の警告です。

## 9. 検証

```
npm run test
```

`scripts/lib/**` も vitest の対象に含まれています（`vite.config.ts`）。テンプレート追加なら `summon-samples.spec.ts` が緑になれば十分です。
