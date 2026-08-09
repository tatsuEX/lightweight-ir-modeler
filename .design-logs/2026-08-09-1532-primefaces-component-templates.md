# PrimeFaces: type 別コンポーネントテンプレート合成

- Date: 2026-08-09 15:32 (+09:00)
- Status: implemented (2026-08-09 15:35)
- Supersedes (partially): 2026-08-09-1439 の「単一 form.hbs 内 type 分岐 / tag マッピング」MVP

## Problem / goal

`RawDefinition.type`（IR コンポーネント種別）を PrimeFaces タグ名へ直接マップし、`form.hbs` 内で `eq type` 分岐や `<p:{{tag}}>` する方式は、コンポーネントごとに **マークアップ構造が大きく異なり得る** ため脆い。

望ましい流れ:

1. `RawDefinition.type` で UI コンポーネントを識別
2. target ごと・コンポーネント固有のテンプレートを取得（例: `components/textbox.hbs`）
3. そのテンプレートをレンダリングしてコンポーネント断片文字列を得る
4. 親テンプレート（例: `form.hbs`）のコンポーネント出力箇所へ統合

## Proposed layout（既存 config 根の下）

`app.io.export.templates.primefaces.dir`（既定 `./templates/export/primefaces`）を根とする:

```text
templates/export/primefaces/
  form.hbs
  components/
    textbox.hbs
    textarea.hbs
    number.hbs
    unsupported.hbs
```

パス例の `templates/primefaces/...` は、実装上は **設定された dir からの相対** とする（アプリがパスをハードコードしない）。

## 責務

| 層 | 役割 |
|---|---|
| shape | フィールドの表示用データ（id / label / hint / required / **type**）。ベンダー tag 名は持たない |
| テンプレート解決 | `type` → `components/<safeType>.hbs`。無ければ `unsupported.hbs`。**allowlist または安全なファイル名規則** |
| コンポーネント render | 各 field context で component hbs を描画（`{{ }}` で escape） |
| form 合成 | 描画済み断片を form context に載せ、親 hbs で並べる |

**更新（2026-08-09 17:34）:** `outputLabel` は **form.hbs（レイアウト）** 側へ外出し。component hbs は type 別の入出力コントロールのみ。  
グリッド→テーブル等のレイアウト変更は form だけ見直す想定。`for`/`id` は同一 field context の `{{id}}` で揃える。  
ラベル配置がコンポーネント固有になる種別（複合コントロール等）が出たら、そのときだけ例外経路を足す。

### form.hbs（イメージ）

```handlebars
...
<p:panelGrid ...>
{{#each fields}}
{{{markup}}}
{{/each}}
</p:panelGrid>
...
```

### components/textbox.hbs（イメージ）

```handlebars
			<p:outputLabel for="{{id}}" value="{{label}}" />
			<p:inputText id="{{id}}"{{#if required}} required="true"{{/if}}{{#if hint}} placeholder="{{hint}}"{{/if}} />
```

## 統合方法の二案

### 案 A（推奨）: 事前レンダー + SafeString / triple-stash

Writer（または serialize ヘルパ）が各 field を component hbs で描画し、`{ ...field, markup: SafeString }` を form に渡す。

- ユーザー文字列の escape は **component hbs の `{{ }}`** で完結
- form 側の `{{{markup}}}` は「既に escape 済みの信頼できる断片」のみ（component 経路以外の生 HTML を載せない）
- 独自 `escapeHtml` は使わない方針と両立

### 案 B: Handlebars partial 登録

起動時または初回に `components/*.hbs` を partial 登録し、form 内で `{{> (lookup typePartial) }}`。

- triple-stash を避けられる
- partial 名と type の対応・動的 lookup の扱いでややハンドルバーズ寄り
- テンプレート差し替え（config dir 変更）時に partial 再登録が必要

**採択提案:** 案 A（明示的でテストしやすい。escape 境界が「component 内 {{ }} / form は markup のみ生挿入」と説明しやすい）

## 批判的メモ（パフォーマンス・安全・複雑性）

### パフォーマンス

| 点 | 評価 |
|---|---|
| フィールド数 N 回の render | フォーム数十件なら無視できる。数千件なら計測だが本ツールの想定外 |
| テンプレート compile | 既存どおり絶対パス単位キャッシュで十分。ビルド時 precompile はまだ不要 |
| 二段レンダー（component → form） | CPU コストは小さい。可読性・構造分離の利益の方が大きい |
| 毎回 FS 読込 | キャッシュ必須（実装済みパターンを流用） |

ボトルネックになる見込みは低い。先に心配すべきは性能より **パス安全性** と **二重 escape**。

### 安全性

- `type` をパス連結に使うとき、ディレクトリトラバーサルを防ぐ
  - 許可: `^[a-zA-Z][a-zA-Z0-9_-]*$` かつ既存ファイル、または既知 type の allowlist
  - 不一致 → `unsupported.hbs`（エラーで export 全体を落とすかは設定次第。MVP は fallback）
- `{{{markup}}}` に載せる文字列は **自前 component レンダー結果のみ**

### 二重 escape

- component で `{{label}}` → form で `{{markup}}` すると `&lt;` がさらに壊れる
- だから form は `{{{markup}}}` または `SafeString` が必須（案 A）

### 複雑性 / YAGNI

- 現状 type は 3 + unsupported。単一 form 分岐でも動くが、構造差への備えとして **今のうちに分割する価値はある**（ユーザー指摘どおり）
- 汎用「全 target 共通コンポーネントエンジン」までは作らない。primefaces Writer 内（または `serialize-handlebars` の小さな合成関数）に留める
- im-forma（json）はこの仕組みの対象外

### shape に tag を持たない

type→tag マップを shape に戻すのは transient な逃げで、構造差問題は解決しない。棄却。

## Writer 擬似コード

```typescript
toArtifact(raw) {
  const shaped = shapePrimeFaces(raw);
  const formId = assertSafeLogicalIdPathSegment(shaped.formId);
  const fields = shaped.fields.map((field) => {
    const templateFile = resolveComponentTemplateFile(field.type); // components/xxx.hbs
    const markup = serializeHandlebarsTemplate(targetId, templateFile, field);
    return { ...field, markup: new Handlebars.SafeString(markup) };
  });
  const content = serializeHandlebarsTemplate(targetId, 'form.hbs', {
    formId,
    name: ...,
    fields
  });
  return { ...describeArtifact(formId), content };
}
```

## Change targets（実装時）

| パス | 変更 |
|---|---|
| `templates/export/primefaces/form.hbs` | each で `{{{markup}}}` のみ |
| `templates/export/primefaces/components/*.hbs` | textbox / textarea / number / unsupported |
| `serialize-handlebars.ts` または writer 近傍 | type→template 解決、SafeString 合成 |
| `primefaces-writer.ts` | 合成オーケストレーション |
| `definition-writer.spec.ts` | 種別ごと・unsupported・escape |
| `docs/use-cases/ui-export.md` | コンポーネントテンプレート合成を追記 |

## Open questions — 解消

1. 未知 type → `unsupported.hbs` fallback（確定）
2. label は各 component テンプレ側（確定）
3. 案 A（SafeString + `{{{markup}}}`）（確定・実装済み）

## Out of scope

- im-forma へのテンプレート適用
- ビルド時 precompile
- target 横断の汎用コンポーネントプラグイン枠
