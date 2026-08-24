---
created: "2026-08-08T22:54:00"
updated: "2026-08-24T08:11:00"
summary: "モジュール境界・データフロー・shape/merge/serialize 概観"
features:
  - architecture
  - ir
  - raw
  - schema
  - transform
  - export
  - import
  - ir-snapshot
  - application-config
  - logging
---

# アーキテクチャ概要

最終更新: 2026-08-24 08:11

## 目的

抽象化された IR（Intermediate Representation）を SSOT（Single Source Of Truth）とし、外部 UI フレームワーク定義への変換・出力を行う。  
GUI 上の編集結果は IR として保持し、形式固有知識は Reader / Writer / Transformer 側に閉じる。

## モジュール配置（`src/lib`）

| Path | 役割 | 現状の主な成果物 |
|---|---|---|
| `ir/` | ドメイン SSOT 周辺 | `ui-definition-meta.ts`, `snapshot.ts`, `external-residual.ts`（`IRDefinition` / `Component` クラス階層は今後） |
| `raw/` | 外部形式との中間モデル | `RawDefinition = Record<string, unknown>` |
| `schema/` | 境界での JSON Schema → Zod 検証 | `validate-raw.ts`, `json-schema-loader.ts` |
| `transform/` | Raw ⇄ IR | 共有フィールド変換 + target 固有 `*-transform.ts` |
| `config/` | クライアント安全な設定 type・既定値・純関数 | `application-types.ts`, `layout-editor-config.ts`, `preview-config.ts` |
| `server/io/` | ファイル I/O | `ir-snapshot-io.ts`, `definition-export-io.ts`, `writers/`（shape / merge / serialize）, `readers/`（parse / unshape）, target 固有ヘルパ |
| `server/ui/` | Import / Export オーケストレーション | `export-pipeline.ts`, `export-target-registry.ts`, `import-pipeline.ts`, `import-target-registry.ts` |
| `server/config/` | `application.yml` のサーバ側ロード | `application-config.ts`（公開 API）, `application-config-yaml.ts`, `application-config-parse.ts` |
| `server/logging/` | Winston ロガー | `logger.ts`（`getLogger` / `runLogged`）, `winston-factory.ts` |
| `store/layout-editor/` | 画面向け状態 | `layout-editor.svelte.ts` ほか |
| `components/` | Svelte UI ウィジェット | Preview / 属性表 / パレット等 |

設定の可視性:

- クライアントは `config/*` の type / 既定値のみを直接 import する（`DEFAULT_ITEM_DELIMITER` 等）
- サーバ呼び出し元は `server/config/application-config.ts` の `loadApplicationConfig()` 等を使う（yaml → parse の手順は公開 API に内包）

依存の原則:

- `RawDefinition` は Reader / Writer に依存しない
- IR（ドメイン）は外部 UI フレームワーク定義に依存しない
- 形式固有ロジックは Transformer / Reader / Writer に閉じる
- `schema/` は `server/config` を import しない（SvelteKit private env を引かない）
- IR がモデル化しないベンダー固有キーは `external['<targetId>']`（不透明な残余バッグ）にのみ置く

## データフロー

### Import（複数 target 実装済み）

```text
アップロードされた外部 UI 定義ファイル
  → DefinitionReader（parse → unshape）→ RawDefinition
  → SchemaValidator（JSON Schema / Zod）
  → Transformer → IR
  → GUI（UIDefinition.loadImported）
```

形式固有の未モデル化データは `external['<targetId>']` に退避する。  
一部 target は原文（またはその一部）を同バッグに保持し、Export 時の merge で復元する。  
詳細は [UI Import](../use-cases/ui-import.md) / 各 target の Import 文書。

### Export（実装済み）

```text
GUI 編集（IR 相当の store 状態）
  → Transformer → RawDefinition
  → SchemaValidator（JSON Schema / Zod）
  → shape / merge（target 向け transport payload）
  → serialize（target 固有: JSON / Handlebars 等）※ DefinitionWriter 内部
  → 外部 UI 定義ファイル（definition-export-io）
```

Shape 後ペイロードは再検証しない（Raw が target Schema を満たし、shape が信頼できる前提）。  
merge / serialize の方言は [UI Export](../use-cases/ui-export.md) および各 target の Export 文書。

## 主要型・クラス関係

```mermaid
classDiagram
  direction TB

  class UIDefinition {
    +logicalId string
    +name string
    +components any[]
    +append()
    +loadSnapshot()
  }

  class UiDefinitionEditorMeta {
    +logicalId string
    +name string
    +description string
    +version string
    +external ExternalResidual
  }

  class IrSnapshot {
    +version number
    +savedAt string
    +uiDefinition
    +components[]
  }

  class ExportTargetBundle {
    +targetId string
    +transform()
    +writer DefinitionWriter
  }

  class DefinitionWriter {
    <<interface>>
    +targetId string
    +describeArtifact()
    +toArtifact()
  }

  class PrimeFacesWriter
  class IMFormaWriter
  class RawDefinition
  class UiExportClient {
    <<interface>>
    +export()
    +download()
  }

  class ImportTargetBundle {
    +targetId string
    +reader DefinitionReader
    +transform()
  }

  class DefinitionReader {
    <<interface>>
    +targetId string
    +acceptExtensions string[]
    +toRaw()
  }

  class IMFormaReader
  class PrimeFacesReader
  UIDefinition --> UiDefinitionEditorMeta : meta fields
  IrSnapshot --> UiDefinitionEditorMeta : uiDefinition
  ExportTargetBundle --> DefinitionWriter
  PrimeFacesWriter ..|> DefinitionWriter
  IMFormaWriter ..|> DefinitionWriter
  ExportTargetBundle ..> RawDefinition : transform 結果
  DefinitionWriter ..> RawDefinition : toArtifact 入力
  UiExportClient ..> UIDefinition : Preview から呼び出し
  ImportTargetBundle --> DefinitionReader
  IMFormaReader ..|> DefinitionReader
  PrimeFacesReader ..|> DefinitionReader
  DefinitionReader ..> RawDefinition : toRaw 結果
  ImportTargetBundle ..> UIDefinition : loadImported 入力
```

補足:

- クラス図の具象 Writer / Reader は **登録済み adapter の存在示し**。語彙・merge・serialize の詳細は各 target 文書
- 画面間の store 共有は **Svelte Context のみ**（`setUIDefinitionContext` / `getUIDefinitionContext`）
- Export の target 解決はサーバ側 `EXPORT_TARGET_REGISTRY` とクライアント側 `UI_EXPORT_CLIENT_REGISTRY` の二系統（薄い HTTP アダプタ）
- Import も同様に `IMPORT_TARGET_REGISTRY` / `UI_IMPORT_CLIENT_REGISTRY` の二系統。Reader 未実装 target は UI に出さない

## 設定

- ベース: `config/application.yml`
- プロファイル上書き: `APP_PROFILE` → `config/application-{profile}.yml`（例: `dev`）
- 必須環境変数: `APP_CONFIG_PATH`
- IO 関連キー:
  - `app.io.exportDir` — 外部 UI 定義の出力ルート（未設定時は export API が 403）
  - `app.io.export.templates.<targetId>.dir` — Handlebars 等テンプレート根（target ごと、差し替え可能）
  - `app.io.importDir` — 予約（YAML ではコメントアウト、利用箇所なし。Import はアップロード方式）
  - `ir.autoSave.*` — snapshot 自動保存（主に `application-dev.yml`）
  - `preview.theme` / `preview.transformTarget` — Preview UI 用
  - `logging.*` — サーバログ（コンソール / ファイル / rolling）。詳細は [サーバロギング](./logging.md)

相対パスは `process.cwd()` 基準。`npm run` をリポジトリルートから実行する前提。

## 関連ドキュメント

- [レイアウトエディタ](../use-cases/layout-editor.md)
- [IR snapshot](../use-cases/ir-snapshot-auto-save.md)
- [UI Export](../use-cases/ui-export.md)
- [UI Import](../use-cases/ui-import.md)
- [im-forma Import](../use-cases/im-forma-import.md)
- [im-forma Export](../use-cases/im-forma-export.md)
- [PrimeFaces Import](../use-cases/primefaces-import.md)
- [PrimeFaces Export](../use-cases/primefaces-export.md)
- [HTTP API](../api/http-endpoints.md)
- [ロギング](./logging.md)
