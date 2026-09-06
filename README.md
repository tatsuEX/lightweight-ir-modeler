# lightweight-ir-modeler

> **LIRM is not a "Designer", but a "Modeler".**

LIRM（lightweight-ir-modeler）は、画面の見た目を美しく整えるためのデザイナではありません。
業務フォームを構成する画面項目の**「意味」**を設計・編集し、特定のUI技術から独立した形で管理するためのモデリングツールです。

## Why LIRM?

業務フォームの画面定義は、しばしば特定のUIフレームワークやノーコード／ローコードプラットフォーム固有の形式で保存されます。

その結果、画面項目が持つ本来の意味――たとえば「これは社員番号を入力する必須項目であり、最大10文字である」といった情報まで、特定製品のJSON、XML、ソースコード、あるいは独自形式の中に閉じ込められます。

LIRMは、こうした**画面定義そのものを、利用しているUI技術より長く生きる資産として扱う**ことを目指します。

そのために、LIRMでは画面定義の意味を **IR（Intermediate Representation）** として抽象化し、特定のUIフレームワークやプラットフォームから分離します。

```text
PrimeFaces ──┐
Power Apps ──┼── Import ──→ IR ──→ Export ──┬── PrimeFaces
Future UI ───┘                              ├── Power Apps
                                            └── Future UI
```

## Goals

LIRMは、次のことを目標としています。

- **業務フォームの初期設計を効率化する**
GUIによる編集や既存定義の再利用によって、画面定義をゼロから繰り返し作成する負担を減らします。
- **画面定義を特定技術から分離する**
特定のUIフレームワークやノーコード／ローコードプラットフォームではなく、技術非依存のIRを画面定義のSSOTとして扱います。
- **画面定義を長期的な資産として保存する**
UI技術や製品のライフサイクルよりも長く、画面項目の意味を保持できることを目指します。
- **既存のソフトウェア開発ツールチェーンと統合する**
IRをYAMLなどのテキスト形式で永続化することで、Gitによるバージョン管理、diff、grep、CLI、自動テストなど、既存の強力な開発ツールを利用できるようにします。
- **移植性とベンダーロック耐性を高める**
画面定義の意味と特定技術向けの表現を分離することで、別のUI技術への移行や複数ターゲットへの出力を容易にします。

## How it works

これらを実現するため、LIRMは大きく3つの機能を提供します。

- **Import Pipeline**
既存のUI定義を読み取り、外部形式固有の情報を整理・検証したうえで、LIRMのIRへ変換します。
- **IR Editor**
SvelteベースのGUIを使って、IRとして管理される画面項目や属性を編集します。
- **Export Pipeline**
IRを各ターゲット固有の形式へ変換・検証し、UIフレームワークやプラットフォーム向けの定義ファイルを生成します。

LIRMが重視するのは、単に**「画面定義ファイルを生成すること」ではありません。**

重要なのは、画面定義が持つ意味を特定技術から切り離し、**テキストとして保存・検索・比較・再利用・変換できる状態にすること**です。

そのため、LIRMでは外部形式へのExportだけでなく、既存の画面定義をIRへ取り込むImportも重要な機能として位置づけます。Exportのみの対応は便利な生成機能にはなりますが、LIRMが目指す「画面定義を特定技術から分離し、長期的な資産として管理する」という目的の一部に留まります。

---

## 現在の実装

現在のLIRMは開発途中です。以下には、現時点で実装されている機能と技術的な構成を記載します。

詳細な現行仕様は [docs/](./docs/README.md) を参照してください。

## できること（現状）

| 領域 | 状態 |
| --- | --- |
| Layout Editor（属性・配置・プレビュー） | 実装済み |
| IR スナップショット自動保存 | 実装済み（プロファイル設定依存。`current` / `history`） |
| IR スナップショット確定版 | 実装済み（`versions/`。パッチ / 改版 / 新たな正本、過去版の読込） |
| IR snapshot `schemaVersion` | MVP（root の構造版。現行 `1.0`。migration *エンジン*ではない） |
| YAML 運用コメント | 実装済み（キーパス → Markdown。ファイル内は `#`） |
| Export（IR → Raw → validate → Writer） | 実装済み（現状 `primefaces`） |
| Import（Reader → Raw → validate → IR） | 実装済み（ファイルアップロード。現状 `primefaces`。`importDir` は未使用） |
| `arcane:summon`（snapshot → Handlebars） | 実装済み（CLI。Export とは別経路。`--projection` で射影） |
| First-party 射影プラグイン | MVP（`by-logical-id` / `db-maxlength`）。GUI / `application.yml` からの注入は未実装 |
| writer-filter / adapter-target 契約化 | 方針のみ。未着手 |
| サーバロギング（Winston） | 実装済み |
| Global Toast | 実装済み |
| ドメイン検証エンジン / Undo / event bus / IR スキーマ移行エンジン | 対象外 |

adapter は `primefaces` を先行実装している。同じパイプライン上に、業務フォーム基盤（例: `im-forma`）など別ベンダー形式を載せる想定もある。

## アーキテクチャ（要約）

```text
Import:
  外部 UI 定義ファイル
    → Reader（parse → unshape）→ RawDefinition
    → SchemaValidator（JSON Schema / Zod）
    → Transformer → UIDefinition

Editor:
  GUI 編集（UIDefinition: meta + components）
    → IR snapshot YAML（自動保存 / 確定版）

Export:
  UIDefinition
    → Transformer → RawDefinition
    → SchemaValidator（JSON Schema / Zod）
    → Writer（shape → serialize）
    → 外部 UI 定義ファイル

CLI（arcane:summon）:
  IR snapshot YAML
    → 復元 → 任意の射影 → Handlebars
```

- **IR（`UIDefinition`）** … 画面定義の SSOT。形式固有知識は持たない
- **Raw** … 外部ファイルと IR の間の一時モデル
- **schema** … システム境界での検証
- **Reader / Transformer / Writer** … 形式固有の取り込み・変換・出力
- **projection** … IR の読み取り専用 view（snapshot には書き戻さない）

モジュール境界とデータフローの詳細は [アーキテクチャ概要](./docs/architecture/overview.md) を参照。

## 前提

- Node.js（LTS 推奨）
- npm
- 環境変数 `APP_CONFIG_PATH`（ベース設定 YAML へのパス。未設定時はサーバが起動しない）
- 任意: `APP_PROFILE`（`config/application-{profile}.yml` を overlay）

本リポジトリの `.npmrc` ではサプライチェーン対策として `ignore-scripts=true` などが有効です。  
インストール後、必要に応じて信頼できるスクリプト（例: `npm run prepare`）を明示実行してください。

## セットアップ

```sh
npm install
npm run prepare
```

`APP_CONFIG_PATH` を `config/application.yml`（または同等のベース YAML）へ向けてください。パスやプロファイルは環境に合わせて調整します。

開発時の自動保存・Export 出力先などは、主に `config/application-dev.yml`（`APP_PROFILE=dev`）側の設定です。

## 開発

```sh
npm run dev
```

ブラウザで Layout Editor（`/layout-editor/property` / `layout` / `preview`）を操作できます。  
本番ビルド / プレビュー:

```sh
npm run build
npm run preview
```

IR snapshot からテンプレートで簡易コードを出す CLI（Export ではない）:

```sh
npm run arcane:summon -- --target <id> --template <hbs> --source <yaml>
```

## よく使うスクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバ |
| `npm run build` | 本番ビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run check` | `svelte-check`（型・Svelte 検査） |
| `npm run test` | ユニットテスト（Vitest） |
| `npm run lint` | Prettier / ESLint チェック |
| `npm run format` | Prettier 整形 |
| `npm run arcane:summon` | IR snapshot から Handlebars で簡易コード生成 |

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/README.md](./docs/README.md) | 索引と現状スコープ |
| [アーキテクチャ概要](./docs/architecture/overview.md) | モジュール境界・データフロー |
| [プラグイン（射影）](./docs/architecture/plugins.md) | `applyProjections` / opt-in id |
| [ライセンス方針](./docs/architecture/licensing.md) | 自コード MIT / 第三者 NOTICE |
| [レイアウトエディタ](./docs/use-cases/layout-editor.md) | property / layout / preview |
| [IR スナップショット自動保存](./docs/use-cases/ir-snapshot-auto-save.md) | 自動保存・確定版・schemaVersion |
| [UI Import](./docs/use-cases/ui-import.md) | 外部定義の取り込み |
| [UI Export](./docs/use-cases/ui-export.md) | 外部定義の出力 |
| [arcane:summon](./docs/use-cases/arcane-summon.md) | snapshot → Handlebars CLI |
| [HTTP API](./docs/api/http-endpoints.md) | エンドポイント契約 |

現状の adapter 文書は [PrimeFaces Export](./docs/use-cases/primefaces-export.md) / [PrimeFaces Import](./docs/use-cases/primefaces-import.md)。他ベンダー形式も同じ索引から追加する想定です。

設計検討のスナップショットは [.design-logs/](./.design-logs/)、日々の作業記録は [.articles/](./.articles/) にあります。

## 技術スタック

- SvelteKit / Svelte 5（runes）
- TypeScript
- Tailwind CSS / Flowbite Svelte
- Zod（境界検証）
- Handlebars（Export / `arcane:summon`）
- YAML（IR snapshot。eemeli/`yaml`）
- Monaco Editor（運用コメント）
- Winston（サーバログ）
- Vitest

## ライセンス

このリポジトリの自作ソースは [MIT License](./LICENSE) です（`package.json` の `"license": "MIT"` も同じ）。

第三者パッケージの著作権表示と許諾文は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) にあります。  
依存ライブラリが ISC など別ライセンスでも、本プロジェクト自身のライセンスは MIT のままです。
