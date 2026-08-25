---
created: "2026-08-08T22:54:00"
updated: "2026-08-25T08:32:00"
summary: "docs 索引と現行スコープ、core / adapter target 分離方針"
features:
  - docs
  - architecture
  - layout-editor
  - ir-snapshot
  - arcane
  - ui-export
  - ui-import
  - primefaces
  - im-forma
  - http-api
  - logging
---

# lightweight-ir-modeler ドキュメント

最終更新: 2026-08-25 08:32

本ディレクトリは、実装と同期する **現行仕様** のドキュメント置き場です。  
設計検討のスナップショットは [`.design-logs/`](../.design-logs/)（追記専用）、日々の作業記録は [`.articles/`](../.articles/) を参照してください。

## 読む順番（推奨）

### Core（IR / 横断パイプライン / API）

1. [アーキテクチャ概要](./architecture/overview.md) — モジュール境界・データフロー・クラス関係
2. [レイアウトエディタ編集](./use-cases/layout-editor.md) — property / layout / preview
3. [IR スナップショット自動保存](./use-cases/ir-snapshot-auto-save.md)
4. [IR snapshot からの簡易コード生成](./use-cases/arcane-summon.md) — `arcane:summon`
5. [外部 UI 定義の出力（Export）](./use-cases/ui-export.md) — 横断パイプライン / API / 検証
6. [外部 UI 定義の取り込み（Import）](./use-cases/ui-import.md) — Reader / unshape / external 残余
7. [HTTP API](./api/http-endpoints.md)
8. [ロギング](./architecture/logging.md)

### Adapter target（ベンダー固有）

9. [PrimeFaces Export](./use-cases/primefaces-export.md) — Facelet / shape / component 対応
10. [PrimeFaces Import](./use-cases/primefaces-import.md) — XHTML / タグ判別 / unsupported 救出
11. [im-forma Export](./use-cases/im-forma-export.md) — importBase merger / Forma 風 serialize
12. [im-forma Import](./use-cases/im-forma-import.md) — 実画面定義 / type マップ / external

## ドキュメントの層

| 層 | 例 | 書いてよいこと |
|---|---|---|
| **Core** | `architecture/`・`api/`・`ui-import.md` / `ui-export.md` 等 | IR・横断パイプライン・HTTP 契約・`external['<targetId>']`・shape/merge/serialize の一般概念 |
| **Adapter target** | `primefaces-*.md`・`im-forma-*.md` | 語彙・type マップ・merge 詳細・serialize 方言・文書族判定 |

詳細は Cursor ルール `.cursor/rules/12-docs-maintenance.mdc` を参照。

## ドキュメントの更新方針

詳細設計レベルの方針変更を実装したときは、**実装と同時に** 本ディレクトリの該当 `.md` を新規作成または更新する。  
新 target を追加するときは横断文書を膨らませず、target 専用文書を追加して本索引からリンクする。

## 現状スコープ（要約）

| 領域 | 状態 |
|---|---|
| Layout Editor（属性・配置・プレビュー） | 実装済み |
| IR snapshot 自動保存 | 実装済み（プロファイル設定依存） |
| `arcane:summon`（snapshot → Handlebars） | 実装済み（CLI。Export とは別経路） |
| Export（IR → Raw → validate → Writer） | 実装済み（複数 adapter target） |
| Import（Reader → Raw → validate → IR） | 実装済み（ファイルアップロード。`importDir` は未使用のまま） |
| サーバロギング（Winston） | 実装済み（`logging` YAML、HTTP hook + パイプライン追跡） |
| ドメイン検証 / Undo / プラグイン等 | 初期スコープ外（`.cursor/rules/03-out-of-scope.mdc`） |
