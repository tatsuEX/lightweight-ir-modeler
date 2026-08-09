---
created: "2026-08-08T22:54:00"
updated: "2026-08-09T00:36:00"
summary: "docs 索引と現行スコープ、更新方針の案内"
features:
  - docs
  - architecture
  - layout-editor
  - ir-snapshot
  - ui-export
  - http-api
---

# lightweight-ir-modeler ドキュメント

最終更新: 2026-08-09 00:36

本ディレクトリは、実装と同期する **現行仕様** のドキュメント置き場です。  
設計検討のスナップショットは [`.design-logs/`](../.design-logs/)（追記専用）、日々の作業記録は [`.articles/`](../.articles/) を参照してください。

## 読む順番（推奨）

1. [アーキテクチャ概要](./architecture/overview.md) — モジュール境界・データフロー・クラス関係
2. [レイアウトエディタ編集](./use-cases/layout-editor.md) — property / layout / preview
3. [IR スナップショット自動保存](./use-cases/ir-snapshot-auto-save.md)
4. [外部 UI 定義の出力（Export）](./use-cases/ui-export.md)
5. [HTTP API](./api/http-endpoints.md)

## ドキュメントの更新方針

詳細設計レベルの方針変更を実装したときは、**実装と同時に** 本ディレクトリの該当 `.md` を新規作成または更新する。  
詳細は Cursor ルール `.cursor/rules/12-docs-maintenance.mdc` を参照。

## 現状スコープ（要約）

| 領域 | 状態 |
|---|---|
| Layout Editor（属性・配置・プレビュー） | 実装済み |
| IR snapshot 自動保存 | 実装済み（プロファイル設定依存） |
| Export（IR → Raw → validate → Writer） | 実装済み（`primefaces` / `im-forma`） |
| Import（Reader → Raw → validate → IR） | **未実装**（設定キー `importDir` のみ予約） |
| ドメイン検証 / Undo / プラグイン等 | 初期スコープ外（`.cursor/rules/03-out-of-scope.mdc`） |
