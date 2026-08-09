---
created: "2026-08-08T22:54:00"
updated: "2026-08-09T17:34:00"
summary: "Export: form=レイアウト、components=入力。shape→hbs 合成 / json"
features:
  - ui-export
  - raw-validation
  - primefaces
  - im-forma
  - preview
  - handlebars
---

# ユースケース: 外部 UI 定義の出力（Export）

最終更新: 2026-08-09 17:34

## 概要

Preview の「出力」「ダウンロード」から、編集中 IR（store）を target 固有の外部定義ファイルへ書き出す。

対応 target（現状）:

| targetId | 成果物例 | Transformer | shape | serialize |
|---|---|---|---|---|
| `primefaces` | `<logicalId>.xhtml` | `transformToPrimeFacesRaw` | `shapePrimeFaces` | Handlebars（`form.hbs`） |
| `im-forma` | `<logicalId>.json` | `transformToImFormaRaw` | `shapeImForma` | `JSON.stringify` |

クライアントは `targetId` だけを選ぶ。json / yaml / Handlebars の戦略は各 `DefinitionWriter` の内部事情。

## API 形状（重要）

| 操作 | Method / Path | target の渡し方 |
|---|---|---|
| 明示出力 | `POST /api/ui/export` | **JSON body** の `target` |
| ダウンロード | `GET /api/ui/download/[target]/[logicalId]` | **パスパラメータ** |

※ `POST /api/ui/export/[target]/[logicalId]` というパスは **存在しない**。クライアントは `HttpUiExportClient.export` が body に `target` を載せる。

## 明示出力シーケンス

```mermaid
sequenceDiagram
  participant UI as Preview.svelte
  participant Client as HttpUiExportClient
  participant API as POST /api/ui/export
  participant Pipe as exportFromEditorState
  participant Reg as resolveExportTargetBundle
  participant Tx as transformTo*Raw
  participant Val as validateRawDefinition
  participant Loader as getRawZodSchema
  participant Writer as DefinitionWriter
  participant Shape as shapeForTarget
  participant Ser as serialize
  participant IO as writeExportedDefinition

  UI->>Client: export(uiDefinition)
  Client->>API: { target, uiDefinition, components }
  API->>Pipe: exportFromEditorState(...)
  Pipe->>Reg: bundle 解決
  Pipe->>Tx: IR → Raw
  Pipe->>Val: validateRawDefinition(targetId, raw)
  Val->>Loader: getRawZodSchema（プロセス内キャッシュ）
  alt Zod safeParse 失敗
    Val-->>API: RawValidationError
    API-->>Client: 400 + issues
  else 成功
    Pipe->>Writer: toArtifact(raw)
    Writer->>Shape: Raw → transport payload
    Writer->>Ser: json / Handlebars
    Pipe->>IO: exportDir/target/logicalId/filename
    API-->>Client: 201 + relativePath 等
  end
```

パイプライン本体: `src/lib/server/ui/export-pipeline.ts` の `exportFromEditorState`。

1. `resolveExportTargetBundle(targetId)`
2. `bundle.transform(meta, components)` → `RawDefinition`
3. `validateRawDefinition(targetId, raw)` ← **ここで Zod（JSON Schema 由来）検証**（shape 後は再検証しない）
4. `bundle.writer.toArtifact(raw)`（内部で shape → serialize）
5. `writeExportedDefinition(...)`

## ダウンロードシーケンス

```mermaid
sequenceDiagram
  participant UI as Preview.svelte
  participant Client as HttpUiExportClient
  participant API as GET /api/ui/download/...
  participant IO as definition-export-io
  participant Pipe as exportFromLatestSnapshot

  UI->>Client: download(logicalId)
  Client->>API: GET
  API->>IO: hasExportedDefinition?
  alt 成果物なし
    API->>Pipe: 最新 snapshot から export
    Note over API: X-Ui-Export-Auto: true<br/>X-Ui-Export-Source: snapshot
  else 既存あり
    Note over API: Auto: false / Source: existing
  end
  API->>IO: readExportedDefinition
  API-->>Client: ファイルバイト
  Client->>UI: saveBlobAsFile
```

注意: **既存成果物がある場合は再 export しない**（古いファイルがそのまま返る）。更新したいときは「出力」を先に実行する。

## ファイル配置

```text
<data/export>/<targetId>/<logicalId>/<logicalId>.xhtml   # primefaces
<data/export>/<targetId>/<logicalId>/<logicalId>.json    # im-forma
```

拡張子・MIME は `DefinitionWriter.describeArtifact` / `toArtifact` が決定する。  
`definition-export-io` はディレクトリ配置と書込のみを担当する。

## Writer 内部: shape と serialize

| 層 | 責務 | パス例 |
|---|---|---|
| shape | 検証済み Raw → ベンダー埋め込み用 payload（キー寄せ・既定値・派生） | `writers/shape/*` |
| serialize | payload → ファイル本文 | `serialize-json.ts` / `serialize-handlebars.ts` |
| Writer | `describeArtifact` + shape + serialize の合成 | `*-writer.ts` |

- Handlebars 経路の HTML escape は **コンポーネントテンプレートの `{{ }}`**。独自 `escapeHtml` は使わない。
- テンプレート根: `app.io.export.templates.<targetId>.dir`（既定: `./templates/export/primefaces`）
- **primefaces 合成**: `type` → `<dir>/components/<type>.hbs` を描画 → `SafeString` として `<dir>/form.hbs` の `{{{markup}}}` へ統合。未知 type / 不正 type は `components/unsupported.hbs`
- **primefaces 責務**: `form.hbs` = レイアウト（`outputLabel` 含む）。`components/*.hbs` = type 別入出力コントロールのみ。`outputLabel for` と入力 `id` は同一 field の `{{id}}` で対応付ける
- yaml serialize ヘルパは、yaml を吐く target が追加されたときに同時実装（現状 target なし）

## Raw 検証と JSON Schema

- Schema ファイル: `schemas/raw/<target>.schema.json`
- 読込: `json-schema-loader.ts` → `z.fromJSONSchema` → プロセス内 `Map` キャッシュ
- 検証: `validateRawDefinition`（失敗時 `RawValidationError`、メッセージは Zod 日本語ロケール）

### 運用上の注意

1. **required はオブジェクトの `required` 配列で指定する**（draft 2020-12）。プロパティ内の `"required": true`（draft-3 名残）だけでは不十分な場合がある。コンポーネント（field/item）側も `logicalId` / `type` / `label` 等を `required` に含めること。
2. **Schema は target 初回検証時にキャッシュされる**。サーバ起動後に JSON Schema を直しても、現状はプロセス再起動（または将来の `invalidateRawZodSchema` 呼び出し）まで反映されない。
3. エディタは空の `logicalId` / `label` を許容し得るが、Schema が `minLength: 1` 等を要求していれば **Export 時に 400** になる（境界検証）。

## モジュール関係（Export 周辺）

```mermaid
classDiagram
  direction LR

  class exportFromEditorState
  class ExportTargetBundle
  class validateRawDefinition
  class getRawZodSchema
  class DefinitionWriter
  class shape
  class serialize
  class writeExportedDefinition

  exportFromEditorState --> ExportTargetBundle : resolve
  exportFromEditorState --> validateRawDefinition
  validateRawDefinition --> getRawZodSchema
  exportFromEditorState --> DefinitionWriter : toArtifact
  DefinitionWriter --> shape
  DefinitionWriter --> serialize
  exportFromEditorState --> writeExportedDefinition
```

## 関連実装

| 領域 | パス |
|---|---|
| Pipeline | `src/lib/server/ui/export-pipeline.ts` |
| Registry | `src/lib/server/ui/export-target-registry.ts` |
| Validate | `src/lib/schema/validate-raw.ts` |
| Schema loader | `src/lib/schema/json-schema-loader.ts` |
| shape | `src/lib/server/io/writers/shape/` |
| serialize | `src/lib/server/io/writers/serialize/` |
| Templates | `templates/export/<targetId>/`（config で差し替え可） |
| Client | `src/lib/store/layout-editor/ui-export-client.ts` |
| API | `src/routes/api/ui/export/+server.ts` |
| Download API | `src/routes/api/ui/download/[target]/[logicalId]/+server.ts` |
