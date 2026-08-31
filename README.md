# lightweight-ir-modeler

UI 定義の試作・編集を高速化するためのツールです。  
抽象化された **IR（Intermediate Representation）** をドメインの **SSOT（Single Source Of Truth）** とし、GUI での編集結果を外部 UI フレームワーク向け定義ファイルへ変換・出力します。

詳細な現行仕様は [`docs/`](./docs/README.md) を参照してください。

## できること（現状）

| 領域 | 状態 |
|---|---|
| Layout Editor（属性・配置・プレビュー） | 実装済み |
| IR スナップショット自動保存 | 実装済み（プロファイル設定依存） |
| Export（IR → Raw → validate → Writer） | 実装済み（`primefaces` / `im-forma`） |
| Import（Reader → Raw → validate → IR） | 未実装 |
| ドメイン検証 / Undo / プラグイン等 | 初期スコープ外 |

## アーキテクチャ（要約）

```text
GUI 編集（IR）
  → Transformer → RawDefinition
  → SchemaValidator（JSON Schema / Zod）
  → Writer（shape → serialize）
  → 外部 UI 定義ファイル
```

- **IR** … 永続的な意味の置き場。形式固有知識は持たない
- **Raw** … 外部ファイルと IR の間の一時モデル
- **schema** … システム境界での検証
- **transform / Writer** … 形式固有の変換・出力

モジュール境界とデータフローの詳細は [アーキテクチャ概要](./docs/architecture/overview.md) を参照。

## 前提

- Node.js（LTS 推奨）
- npm

本リポジトリの `.npmrc` ではサプライチェーン対策として `ignore-scripts=true` などが有効です。  
インストール後、必要に応じて信頼できるスクリプト（例: `npm run prepare`）を明示実行してください。

## セットアップ

```sh
npm install
npm run prepare
```

設定ファイルは `config/application.yml` です（パスやプロファイルは環境に合わせて調整）。

## 開発

```sh
npm run dev
```

ブラウザで Layout Editor 等を操作できます。  
本番ビルド / プレビュー:

```sh
npm run build
npm run preview
```

## よく使うスクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 本番ビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run check` | `svelte-check`（型・Svelte 検査） |
| `npm run test` | ユニットテスト（Vitest） |
| `npm run lint` | Prettier / ESLint チェック |
| `npm run format` | Prettier 整形 |

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/README.md](./docs/README.md) | 索引と現状スコープ |
| [アーキテクチャ概要](./docs/architecture/overview.md) | モジュール境界・データフロー |
| [ライセンス方針](./docs/architecture/licensing.md) | 自コード MIT / 第三者 NOTICE |
| [レイアウトエディタ](./docs/use-cases/layout-editor.md) | property / layout / preview |
| [IR スナップショット自動保存](./docs/use-cases/ir-snapshot-auto-save.md) | 自動保存 |
| [UI Export](./docs/use-cases/ui-export.md) | 外部定義の出力 |
| [HTTP API](./docs/api/http-endpoints.md) | エンドポイント契約 |

設計検討のスナップショットは [`.design-logs/`](./.design-logs/)、日々の作業記録は [`.articles/`](./.articles/) にあります。

## 技術スタック

- SvelteKit / Svelte 5（runes）
- TypeScript
- Tailwind CSS / Flowbite Svelte
- Zod / Handlebars（Export 等）
- Vitest

## ライセンス

このリポジトリの自作ソースは [MIT License](./LICENSE) です（`package.json` の `"license": "MIT"` も同じ）。

第三者パッケージの著作権表示と許諾文は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) にあります。  
依存ライブラリが ISC など別ライセンスでも、本プロジェクト自身のライセンスは MIT のままです。
