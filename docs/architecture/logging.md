---
created: "2026-08-24T08:15:00"
updated: "2026-08-24T08:15:00"
summary: "Winston によるサーバログ（YAML 設定・ファイル分割・パイプライン追跡）"
features:
  - logging
  - application-config
---

# ロギング

最終更新: 2026-08-24 08:15

サーバ専用。Winston は `src/lib/server/logging/` に閉じ、呼び出し側は `getLogger` / `runLogged` だけを使う。クライアント（Svelte）は対象外。

## 使い方（SLF4J 相当）

```ts
import { getLogger, runLogged } from '$lib/server/logging/logger';

const logger = getLogger(import.meta.url);
logger.info('exported', { targetId, logicalId });

return runLogged(logger, 'toRaw', { filename: source.filename }, () => reader.toRaw(source));
```

`runLogged` は **start / return / throw** を出す（Spring の `@Around` 相当）。全関数の自動織り込みはしない。

## HTTP

`src/hooks.server.ts` が method / path / status / durationMs を記録する。リクエストボディは出さない。Vite 内部パスは除外する。

## 追跡する主要ステップ

Import / Export の入口に加え、次を `runLogged` で囲む。

| 操作 | 例 |
|---|---|
| HTTP | `request start` / `return` / `throw` |
| パイプライン | `importFromUploadedFile` / `exportFromEditorState` |
| Reader | `toRaw` / `parseXml` / `parseJson` / `unshape*` |
| Transform | `transformTo*Raw` / `transformFrom*Raw` |
| Validate | `validateRawDefinition` |
| Writer | `toArtifact` / `shapePrimeFaces` / `serializeHandlebarsTemplate` / `mergeImFormaDocument` |
| IO | `writeExportedDefinition` / `writeSnapshot` |

本文や IR 全体は出さない。filename / targetId / logicalId / 件数 / 所要時間のみ。

## 設定（`application.yml`）

```yaml
logging:
  level: info
  console:
    enabled: true
  file:
    dir: ./logs
    info:
      enabled: true
      filename: info.log
      rolling: daily          # daily | monthly | none
      maxFiles: 14d
    error:
      enabled: true
      filename: error.log
      rolling: monthly
      maxFiles: "12"
```

- 未設定時はコンソールのみ（テストが `./logs` を汚さない）
- **info ファイル**: `info` と `warn` のみ
- **error ファイル**: `error` のみ
- rolling は info / error で独立
- 相対 `dir` は `process.cwd()` 基準
- 開発 overlay（`application-dev.yml`）で `logging.level: debug` を上書き可能
- Vitest 実行中はファイルもコンソールも silent

## 関連

- [アーキテクチャ概要](./overview.md)
