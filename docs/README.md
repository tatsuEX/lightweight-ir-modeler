---
created: "2026-08-08T22:54:00"
updated: "2026-09-27T04:45:00"
summary: "docs 索引。利用者向けと保守者向けの区別、現行スコープ（プラグイン多段・domain validation・IR migration）"
features:
  - docs
  - maintenance
  - architecture
  - licensing
  - layout-editor
  - ir-snapshot
  - arcane
  - ui-export
  - ui-import
  - primefaces
  - im-forma
  - http-api
  - logging
  - global-toast
  - plugins
---

# lightweight-ir-modeler ドキュメント

最終更新: 2026-09-27 04:45

本ディレクトリは、実装と同期する **現行仕様** のドキュメント置き場です。  
設計検討のスナップショットは [`.design-logs/`](../.design-logs/)（追記専用）、日々の作業記録は [`.articles/`](../.articles/) を参照してください。

## 読者による使い分け

| 読者 | 見る場所 | 内容 |
|---|---|---|
| **LIRM 利用者** | `use-cases/`・`api/`・`architecture/` | 何ができるか・API 契約・target ごとの取り込み / 出力仕様 |
| **LIRM 保守者** | [`maintenance/`](./maintenance/README.md) | LIRM を拡張・改訂するときに**どこを何の順で触るか** |

利用者向け文書は「**何が起きるか**」、保守運用ガイドは「**どのファイルをどう変えるか**」を書きます。同じ話題でも役割が違うので、片方に寄せずに両方更新してください。

## 読む順番（推奨）

### Core（IR / 横断パイプライン / API）

1. [アーキテクチャ概要](./architecture/overview.md) — モジュール境界・データフロー・クラス関係
2. [プラグイン（射影）](./architecture/plugins.md) — `applyProjections` / opt-in id
3. [ライセンス方針](./architecture/licensing.md) — 自コード MIT / 第三者 NOTICE / `static/` 掲載
4. [レイアウトエディタ編集](./use-cases/layout-editor.md) — property / layout / preview
5. [Global Toast](./use-cases/global-toast.md) — アプリ全体の Growl 相当通知
6. [IR スナップショット自動保存](./use-cases/ir-snapshot-auto-save.md)
7. [IR snapshot からの簡易コード生成](./use-cases/arcane-summon.md) — `arcane:summon`
8. [外部 UI 定義の出力（Export）](./use-cases/ui-export.md) — 横断パイプライン / API / 検証
9. [外部 UI 定義の取り込み（Import）](./use-cases/ui-import.md) — Reader / unshape / external 残余
10. [HTTP API](./api/http-endpoints.md)
11. [ロギング](./architecture/logging.md)

### Adapter target（ベンダー固有）

12. [PrimeFaces Export](./use-cases/primefaces-export.md) — Facelet / shape / component 対応
13. [PrimeFaces Import](./use-cases/primefaces-import.md) — XHTML / タグ判別 / unsupported 救出
14. [im-forma Export](./use-cases/im-forma-export.md) — importBase merger / Forma 風 serialize
15. [im-forma Import](./use-cases/im-forma-import.md) — 実画面定義 / type マップ / external

### 保守運用（LIRM を改造する人向け）

索引: [保守運用ガイド](./maintenance/README.md)

16. [`schemaVersion` 改訂](./maintenance/schema-version-revision.md) — sub / main の判断・migration step・同意フロー
17. [target 追加: Import パイプライン](./maintenance/add-target-import.md) — unshape / Reader / Raw→IR
18. [target 追加: Export パイプライン](./maintenance/add-target-export.md) — IR→Raw / shape or merge / serialize / Writer
19. [target 追加: その他対応](./maintenance/add-target-other.md) — Raw schema / registry 一覧 / `application.yml` / 既存 spec / UI
20. [`arcane:summon` テンプレート新規作成](./maintenance/add-summon-template.md) — context / helper / projection

## ドキュメントの層

| 層 | 例 | 書いてよいこと |
|---|---|---|
| **Core** | `architecture/`・`api/`・`ui-import.md` / `ui-export.md` 等 | IR・横断パイプライン・HTTP 契約・`external['<targetId>']`・shape/merge/serialize の一般概念・projection / writer-filter の契約 |
| **Adapter target** | `primefaces-*.md`・`im-forma-*.md` | 語彙・type マップ・merge / writer-filter 段の中身・serialize 方言・文書族判定 |
| **保守運用** | `maintenance/` | 作業手順・触る箇所の一覧・順序・チェックリスト。既存 target は「真似る雛形」として path 参照のみ（語彙の中身は書かない） |

層の境界は Cursor ルール `.cursor/rules/02-architecture-boundaries.mdc`、ファイル形式は `.cursor/rules/docs-format.mdc` を参照。

## ドキュメントの更新方針

詳細設計レベルの方針変更を実装したときは、**実装と同時に** 本ディレクトリの該当 `.md` を新規作成または更新する。  
新 target を追加するときは横断文書を膨らませず、target 専用文書を追加して本索引からリンクする（手順は [target 追加: その他対応](./maintenance/add-target-other.md)）。  
触る箇所が変わる変更（registry の追加、パイプライン段の増減、CLI フラグ）を入れたときは `maintenance/` の該当手順も更新する。

## 現状スコープ（要約）

| 領域 | 状態 |
|---|---|
| Layout Editor（属性・配置・プレビュー） | 実装済み |
| IR snapshot 自動保存 | 実装済み（プロファイル設定依存） |
| `arcane:summon`（snapshot → Handlebars） | 実装済み（CLI。Export とは別経路） |
| Export（IR → Raw → validate → Writer） | 実装済み（複数 adapter target） |
| Import（Reader → Raw → validate → IR） | 実装済み（ファイルアップロード。`importDir` は未使用のまま） |
| サーバロギング（Winston） | 実装済み（`logging` YAML、HTTP hook + パイプライン追跡） |
| Global Toast | 実装済み（Preview / Import 成功 / 自動保存失敗 / snapshot 復元） |
| First-party 射影プラグイン（`by-logical-id` / `db-maxlength`） | MVP 実装済み（[プラグイン](./architecture/plugins.md)）。複数段の指定・実行。`arcane:summon --projection` |
| writer-filter | スコープ内。複数段を指定順に実行。実装は未着手（契約は `.cursor/rules/16-plugins.mdc`） |
| adapter-target | スコープ内。Import / Export は選んだ target を一度だけ実行。Reader / Writer は実装済み |
| IR snapshot `schemaVersion` | MVP 実装済み（[自動保存](./use-cases/ir-snapshot-auto-save.md)）。root `schemaVersion` + 4 分類 + step 空の seam |
| IR schema migration | スコープ内。加算でない形の変更は版付き変換。移行ランナーは未着手 |
| Domain validation | スコープ内。IR 種類ごとの不変条件。ルール DSL は作らない。専用モジュールは未着手 |
| Undo コマンドスタック / event bus / 汎用 service 層 / リポジトリ外プラグイン | 対象外（`.cursor/rules/03-out-of-scope.mdc`） |
