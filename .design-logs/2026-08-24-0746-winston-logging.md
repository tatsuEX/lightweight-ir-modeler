# Winston ロギング（config 駆動・logback 風）

Date: 2026-08-24 07:46

## Problem / goal

- `winston` は `package.json` に追加済み。設定 YAML を SSOT（Single Source Of Truth）として、サーバ各所から同じ使い方でロギングしたい。
- 欲しい使用感は Spring の **AOP + logback** に近いもの:
  1. 呼び出し側は Logger を取るだけで、appender / rolling / ファイル分割を知らない
  2. ファイル出力
  3. daily / monthly ローリング
  4. info 帯と error 帯でファイルを分けられる

## Constraints

- Winston / `fs` は **サーバ専用**。`src/lib/server/` に閉じる。クライアント（Svelte）は対象外（既存 `console.warn` を維持）。
- TypeScript / SvelteKit に AspectJ 相当のメソッド織り込みはない。AOP は **HTTP 境界の around** と **名前付き Logger 工場** で近似する（全関数の自動トレースは YAGNI）。
- `winston` 本体の `File` transport はローリングしない。daily / monthly には追加パッケージが必要（下記 Open questions）。
- `package.json` への依存追加はユーザー承認が必要（既存ルール）。
- プラグイン枠・イベントバスは初期スコープ外。

## Proposed approach

### 1. 公開 API（SLF4J 相当）

呼び出し側は Winston を直接 import しない。

```ts
import { getLogger } from '$lib/server/logging/logger';

const log = getLogger(import.meta.url);
log.info('export started', { targetId, logicalId });
log.error('export failed', { err });
```

- `getLogger` はモジュール識別子付きの child logger を返す（logback の logger name）。
- `import.meta.url` は短い相対パスへ正規化する（`src/lib/server/ui/export-pipeline.ts` など）。
- 実体の Winston logger / transport はプロセス内シングルトン。初回 `getLogger`（または hooks）で `loadApplicationConfig()` から組む。
- 設定未読込・パス未解決時は既存 config ローダと同様に throw（黙って捨てない）。

### 2. AOP 相当（織り込みはしない）

| Spring | 本リポジトリでの対応 |
|---|---|
| `LoggerFactory.getLogger(Foo.class)` | `getLogger(import.meta.url)` |
| logback.xml の appender / rolling | `application.yml` の `logging` |
| Controller / Filter の around | `src/hooks.server.ts` の `handle` / `handleError` |
| `@Around` で全 service を自動ログ | **やらない**（ノイズ・YAGNI）。use-case 境界で明示 `info` / `error` |

`handle` では method / path / status / durationMs のみ。リクエストボディ（IR ペイロード）は出さない。

### 3. 設定（logback.xml 相当を YAML へ）

`application.yml` ルートに `logging` を追加。未設定時は **コンソールのみ**（テストが `./logs` を汚さない）。

```yaml
logging:
  level: info                 # root: error | warn | info | debug
  console:
    enabled: true
  file:
    enabled: true
    dir: ./logs
    rolling: daily            # daily | monthly | none
    maxFiles: 14d             # daily-rotate-file の保持。monthly なら '12' 等
    info:
      enabled: true
      filename: info.log      # 実ファイルは info-2026-08-24.log など
    error:
      enabled: true
      filename: error.log
```

`application-dev.yml` で `level: debug` や file 有効化を overlay。

レベル分割の意味（推奨）:

- root `level` 未満はどの出力にも出ない
- **info ファイル**: `info` と `warn` のみ（error を混ぜない）
- **error ファイル**: `error` のみ
- **console**: root 以上をすべて

Winston の transport `level` は「そのレベル以上」なので、帯域分割は **filter format** で実現する。

`rolling: none` は固定ファイル名（開発・テスト用）。`daily` は `YYYY-MM-DD`、`monthly` は `YYYY-MM`。

相対 `dir` は既存どおり `process.cwd()` 基準（`resolveApplicationPath`）。

### 4. モジュール配置

| Path | 役割 |
|---|---|
| `src/lib/config/logging-config.ts` | `LoggingConfig` type・既定値（fs なし。`application-types` から参照） |
| `src/lib/server/logging/logger.ts` | 公開 API: `getLogger` / 内部で Winston 組み立て |
| `src/lib/server/logging/winston-factory.ts` | transport / rolling / level filter（Winston 詳細をここに閉じる） |
| `src/lib/server/config/application-config-parse.ts` | `logging` ブロックの parse |
| `src/hooks.server.ts` | HTTP around ログ + 未処理例外 |

`logger.ts` がファクトリを内包してもよいが、parse と I/O 組み立ては変更理由が違うので factory を分ける。呼び出し元は `logger.ts` のみ。

`ApplicationConfig.logging` は省略可。省略時はコンソールのみの既定値。

### 5. ローリング実装

推奨: **`winston-daily-rotate-file`** を追加する（`datePattern` で daily / monthly）。

代替（依存追加なし）: 自前で日付付き `File` transport を差し替える — プロセスを跨いだ真のローリングや maxFiles 削除が弱い。要件 3 を満たすなら公式ローテータを使う。

**実装前に `winston-daily-rotate-file` の追加承認が必要。**

### 6. 初期の埋め込み箇所（console.warn 置換）

サーバの失敗ログを Winston へ寄せる（メッセージは既存に近い）:

- `src/routes/api/ui/export/+server.ts`
- `src/routes/api/ui/import/+server.ts`
- `src/routes/api/ui/download/[target]/[logicalId]/+server.ts`
- `src/routes/api/ir/snapshot/+server.ts`
- `src/routes/api/ir/snapshot/logical-ids/+server.ts`

任意（成功パスの info）: `export-pipeline` / `import-pipeline` / snapshot I/O。HTTP hook があれば成功は hook 側でも足りる。パイプラインには target / logicalId などドメイン文脈を `info` で残すのが有用。

クライアントの `console.warn`（`UiDefinitionMetaAccordion` / `ir-auto-save.svelte.ts`）は **対象外**。

### 7. その他

- `.gitignore` に `logs/` を追加
- parse テストを `application-config.spec.ts` に追加
- logger の単体テストは tmp ディレクトリ（実 `./logs` を使わない）
- 実装後: `docs/architecture/overview.md` に logging 節、必要なら `docs/architecture/logging.md` を新規し `docs/README.md` からリンク

## Alternatives considered

1. **クラスデコレータ / experimentalDecorators** — サーバコードの大半が関数。SvelteKit との相性も悪い。不採用。
2. **クライアントにも同じ logger** — ブラウザに `fs` は無い。不採用。
3. **1 ファイルに全レベル + error だけ複製** — logback の ThresholdFilter パターン。要件 4 の「分ける」には info 側から error を除外する方が分かりやすい。
4. **名前付きロガーごとの level 上書き**（`logging.level.export-pipeline: debug`） — Spring では定番だが初回は root のみ。需要が出たら追加。

## Open questions

1. `winston-daily-rotate-file` の追加を承認するか。
2. info ファイルの帯域: `info+warn`（推奨）か `info` のみか。
3. 成功系 `info` をパイプラインにも出すか、HTTP hook のみか。
4. ログフォーマット: 人間向けテキスト（logback 風、推奨）か JSON か。

## Key decisions (pending user)

- 公開面は `getLogger` + YAML `logging` + `hooks.server.ts`。Winston は内部。
- ファイル分割は config の `file.info` / `file.error` の enabled で切替。
- クライアントは Winston を使わない。
