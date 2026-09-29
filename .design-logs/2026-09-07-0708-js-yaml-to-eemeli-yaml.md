# Remaining js-yaml → eemeli/yaml (remove js-yaml)

Date: 2026-09-07 07:08

## Problem / goal

IR snapshot の運用コメント対応で `src/lib/ir/snapshot.ts` は既に `yaml`（eemeli）の Document 経路へ移した。  
残りの `js-yaml` 読込・出力を同じパッケージへ寄せ、`js-yaml` / `@types/js-yaml` を `package.json` から外せるようにする。

既に入っている依存: `yaml@^2.9.0`。新規 YAML ライブラリは足さない。

## Current remaining call sites

ソース上の `from 'js-yaml'` は次の 5 箇所のみ（snapshot / writer serialize には残っていない）。

| Path | 用途 | 操作 |
|---|---|---|
| `src/lib/server/config/application-config-yaml.ts` | `application.yml` 読込 | `load` |
| `src/lib/server/config/application-config-parse.ts` | YAML 文字列 → mapping | `load`（`parseApplicationConfig` のみ。他は未使用 import） |
| `src/lib/schema/json-schema-loader.ts` | Raw JSON Schema の `.yaml` / `.yml` | `load`（レジストリ現状は `.json` のみ） |
| `scripts/schema-infer.mjs` | サンプル YAML 読込 + schema YAML 出力 | `load` / `dump` |
| `scripts/schema-convert.mjs` | JSON Schema JSON ↔ YAML | `load` / `dump`（`--check` 往復含む） |

`package.json` dependencies: `js-yaml`, `@types/js-yaml`, 既存 `yaml`。

## Proposed approach

### 1. TypeScript の読込は既存 `parseYaml` に寄せる

`src/lib/utils/yaml-document.ts` の `parseYaml`（内部は `yaml.parse`）を使う。

- `readYamlMapping` / `parseApplicationConfig` / `parseSchemaText` の `load` / `yamlLoad` を `parseYaml` に置換
- mapping 検証（null / array 拒否）はその場に残す。エラーメッセージと呼び出し元が違うのでヘルパ統合はしない
- Document / コメント保持は不要（config / schema は JS オブジェクトへ落として終わり）

`stringifyYaml` は使わない。こちらは snapshot 向け（preferred キー順 + `lineWidth: 0`）。schema CLI の dump 方針と衝突する。

### 2. CLI スクリプトは `yaml` を直接 import する

`scripts/*.mjs` は `$lib` / TS ヘルパを引かない（`node` 直実行）。`import { parse, stringify } from 'yaml'`。

読込: `yamlLoad(text)` → `parse(text)`。  
出力: 現行 `dump` オプションを eemeli 相当へ写す。

| js-yaml `dump` | eemeli `stringify` |
|---|---|
| `indent: 2` | `indent: 2` |
| `lineWidth: 120` | `lineWidth: 120` |
| `noRefs: true` | `aliasDuplicateObjects: false` |
| `sortKeys: false` | 省略（既定でソートしない） |

WARN: コメント付き YAML を schema convert すると、現行どおりコメントは落ちる（`parse` → JS → `stringify`）。CLI の WARN 文言だけ `js-yaml` 言及を外す。コメント維持の Document 往復はこのスコープに入れない（schema 草案の相互変換が目的）。

### 3. パーサ差分は小さい前提で進める

現行 `js-yaml@^5` も YAML 1.2 寄り。`application.yml` は `true` / `false` を明示しており、`yes` / `on` 依存はない。  
想定する差:

- 重複キー: eemeli は警告寄り。config では失敗してよい（黙って last-wins しない）
- dump のクォート / 折返し位置はバイト一致しない。`--check` はオブジェクト等価で見る（現行どおり `JSON.stringify` 比較）
- 空ドキュメントはどちらも mapping 検証で reject

新規テストは最小。既存 `application-config.spec.ts` が config 経路をカバーする。schema CLI は実装後に `schema:convert -- --check` を実ファイルで確認する（スクリプト用 unit は今ない。このためにテスト枠は増やさない）。

### 4. 依存削除はコード置換のあと、承認付き

ルール上 `package.json` / lockfile は承認後のみ。実装順:

1. 上記 5 ファイル + living docs を置換
2. `from 'js-yaml'` がゼロであることを確認
3. 承認を得て `js-yaml` と `@types/js-yaml` を dependencies から削除（`npm uninstall`）
4. `THIRD_PARTY_NOTICES.md` / `static/THIRD_PARTY_NOTICES.md` から js-yaml / argparse（js-yaml 経由）を落とす。NOTICE 再生成手順が別にあればそれに従う

## Alternatives considered

| 案 | 採用しない理由 |
|---|---|
| schema dump も `stringifyYaml` | キーソートと `lineWidth: 0` が草案 YAML の読みやすさを壊す |
| `src/lib/yaml/` を新設 | 既存 `utils/yaml-document.ts` で足りる。YAGNI |
| dump 用の共通 `stringifyYamlPlain` | 呼び出しは scripts 2 ファイルだけ。mjs から TS を引かない方針と衝突 |
| application.yml も Document + コメント維持 | 読込専用。overlay merge は plain object。コメント round-trip は要求されていない |
| js-yaml を scripts だけ残す | 全廃が目的。残す理由がない |

## Open questions

1. `package.json` からの削除と NOTICE 更新を、コード置換と同じセッションで進めてよいか（uninstall は承認必須）。
2. schema CLI の YAML 見た目（クォート差）をゴールデン比較するか。提案はオブジェクト往復のみ。

## Files to change (when implementing)

| Path | Action |
|---|---|
| `src/lib/server/config/application-config-yaml.ts` | `load` → `parseYaml` |
| `src/lib/server/config/application-config-parse.ts` | 未使用に近い `js-yaml` import を `parseYaml` へ |
| `src/lib/schema/json-schema-loader.ts` | `yamlLoad` → `parseYaml` |
| `scripts/schema-infer.mjs` | `yaml` の `parse` / `stringify` |
| `scripts/schema-convert.mjs` | 同上。WARN コメント更新 |
| `docs/use-cases/ui-export.md` | schema 読込を eemeli/yaml に |
| `docs/use-cases/ir-snapshot-auto-save.md` | 「application.yml は js-yaml」行を削除 / 更新 |
| `docs/architecture/overview.md` | `utils/` 行から js-yaml 残留注記を外す |
| `package.json` / `package-lock.json` | **承認後** `js-yaml` と `@types/js-yaml` を削除 |
| `THIRD_PARTY_NOTICES.md` / `static/THIRD_PARTY_NOTICES.md` | **承認後** js-yaml 系を削除 |

変更しない:

- `src/lib/ir/snapshot.ts` / `yaml-document.ts` の Document・キー順・運用コメント（済）
- Writer の yaml serialize ヘルパ（target なし。将来足すときは `yaml` を使う）
- `docs/use-cases/ui-export_BACKUP_*.md` 等のマージ残骸
- 歴史ログ（`.design-logs/` / `.articles/` の過去記述）
