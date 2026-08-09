---
created: "2026-08-08T22:54:00"
updated: "2026-08-09T00:36:00"
summary: "debounce 付き IR YAML snapshot の自動保存・世代管理・二重重複抑制"
features:
  - ir-snapshot
  - auto-save
  - layout-editor
---

# ユースケース: IR スナップショット自動保存

最終更新: 2026-08-09 00:36

## 概要

編集中の UI 定義を、debounce 付きでサーバ上の YAML snapshot として世代管理する。  
外部 UI 形式への変換とは **別経路**（Export とは独立）。

前提設定（例: `config/application-dev.yml`）:

```yaml
ir:
  autoSave:
    enabled: true
    delay: 500
    dir: ./data/ir
    maxGenerations: 10
```

`enabled: false` または未設定のとき、書込 API は 403。logical-ids 一覧は空配列を返す。

## シーケンス

```mermaid
sequenceDiagram
  participant Editor as Layout Editor
  participant Store as UIDefinition
  participant Auto as attachIrAutoSave
  participant API as POST /api/ir/snapshot
  participant IO as writeSnapshot
  participant Disk as autoSave.dir

  Editor->>Store: メタ / components 変更
  Auto->>Auto: $effect で payload + hash 生成
  Note over Auto: debounce(delay)
  alt meta 未準備 or hash 同一
    Auto-->>Auto: 送信スキップ
  else 送信
    Auto->>API: uiDefinition + components
    API->>IO: writeSnapshot
    IO->>Disk: 最新と比較（id 除外・キーソート YAML）
    alt 内容同一
      IO-->>API: skipped=true → 200
    else 新規
      IO->>Disk: ir-snapshot-YYYYMMDDTHHmmss.yml（wx）
      IO->>Disk: pruneSnapshots(maxGenerations)
      IO-->>API: 201
    end
  end
```

## 二重の重複抑制

| 層 | 比較単位 | 備考 |
|---|---|---|
| クライアント | `buildSaveHash`（`JSON.stringify`、component `id` 含む） | 連続入力の送信抑制 |
| サーバ | `normalizeSnapshotForCompare`（`id` 除去 + `sortKeys` YAML） | 意味的に同じ内容の再書込を skip |

そのため、見た目上の reorder や id 再生成だけではサーバ側で skip されることがある。

## ファイル配置

```text
<data/ir>/<logicalId>/ir-snapshot-YYYYMMDDTHHmmss.yml
<data/ir>/<logicalId>/ir-snapshot-YYYYMMDDTHHmmss-2.yml   # 同一秒衝突時
```

- ファイル名の時刻は **ローカル時刻**
- ファイル内 `savedAt` は ISO UTC
- 世代のソート・prune は **ファイル名** 基準（mtime ではない）
- 復元時: component `id` を除去して保存 → 読込時に再採番

## YAML エンベロープ（version = 1）

- `version`, `savedAt`
- `uiDefinition`: `logicalId`, `name`, `description`, `version`, `createdAt`, `modifiedAt`
- `components[]`

`createdAt` は初回作成を `buildSnapshotMetaForWrite` が維持する。

## 関連 API

| Method | Path | 用途 |
|---|---|---|
| `POST` | `/api/ir/snapshot` | 保存（201 / skip 時 200） |
| `GET` | `/api/ir/snapshot?logicalId=` | 最新 1 件取得 |
| `GET` | `/api/ir/snapshot/logical-ids` | オートコンプリート用一覧 |

## 関連実装

| 領域 | パス |
|---|---|
| クライアント | `src/lib/store/layout-editor/ir-auto-save.svelte.ts` |
| IO | `src/lib/server/io/ir-snapshot-io.ts` |
| メタ / snapshot 型 | `src/lib/ir/ui-definition-meta.ts`, `src/lib/ir/snapshot.ts` |
