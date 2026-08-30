---
created: "2026-08-08T22:54:00"
updated: "2026-08-28T08:01:00"
summary: "debounce 付き IR YAML snapshot の自動保存・運用コメント（commentDelayExtra）"
features:
  - ir-snapshot
  - auto-save
  - layout-editor
  - yaml-comments
  - global-toast
---

# ユースケース: IR スナップショット自動保存

最終更新: 2026-08-28 08:01

## 概要

編集中の UI 定義を、debounce 付きでサーバ上の YAML snapshot として世代管理する。  
外部 UI 形式への変換とは **別経路**（Export とは独立）。

前提設定（例: `config/application-dev.yml`）:

```yaml
ir:
  autoSave:
    enabled: true
    delay: 500
    commentDelayExtra: 1500
    dir: ./data/ir
    maxGenerations: 10
```

| キー | 意味 |
|---|---|
| `delay` | Property / Layout（IR メタ + components）変化後の待ち（ms） |
| `commentDelayExtra` | コメント map **のみ** 変化したときに `delay` へ加算する（ms）。省略時 1500。`0` なら IR と同じ |

実効待ちは IR 変化が `delay`、コメントのみが `delay + commentDelayExtra`。両方変わるときは短い `delay` に合流し、payload には最新コメントを載せる。debounce はクライアントのみ。サーバ IO は POST 受信後に即比較・書込する。

運用コメントの下書き（Monaco）は autoSave しない。`#map` に載るのはモーダルの保存と左ツリー切替。

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
  Auto->>Auto: $effect で payload + IR/コメント hash 生成
  Note over Auto: IR 変化は debounce(delay) / コメントのみは delay+commentDelayExtra
  alt meta 未準備 or hash 同一
    Auto-->>Auto: 送信スキップ
  else 送信
    Auto->>API: uiDefinition + components
    API->>IO: writeSnapshot
    IO->>Disk: 最新と比較（id 除外・preferred+ASCII キーソート YAML + コメント）
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
| クライアント | IR hash とコメント hash（`JSON.stringify`、component `id` を含む） | 変化種別に応じて delay を分ける。連続入力の送信抑制 |
| サーバ | `normalizeSnapshotForCompare` + `normalizeCommentsForCompare` | 意味的に同じ内容の再書込を skip |

そのため、見た目上の reorder や id 再生成だけではサーバ側で skip されることがある。

保存 API が失敗したときは `console.warn` に加え、Global Toast で `error` を出す（sticky にはしない）。

## ファイル配置

```text
<data/ir>/<logicalId>/ir-snapshot-YYYYMMDDTHHmmss.yml
<data/ir>/<logicalId>/ir-snapshot-YYYYMMDDTHHmmss-2.yml   # 同一秒衝突時
```

- ディレクトリ名は画面 ID（`logicalId`）。未使用 ID への切替時は確認ダイアログがあり得る（[layout-editor](./layout-editor.md)）
- ファイル名の時刻は **ローカル時刻**
- ファイル内 `savedAt` は ISO UTC
- 画面 ID を変えると別ディレクトリへ保存される。過剰なディレクトリ生成は許容する（復元は ID 単位）
- 世代のソート・prune は **ファイル名** 基準（mtime ではない）
- 復元時: component `id` を除去して保存 → 読込時に再採番

## YAML envelope (version = 1)

Output uses eemeli/yaml Document (not js-yaml). Operational Markdown comments are stored as YAML `#` (`commentBefore`):

- `uiDefinition` key: one comment for the meta accordion as a whole
- any path under `uiDefinition` (domain keys such as `logicalId`, and `external…`)
- each `components[]` element: one comment immediately before that element (not before the `components` key)
- any path under a `components[]` element (domain keys and `external…`)

HTTP GET/POST carry a `comments` map (YAML key path → Markdown). The YAML file itself does not have a `comments:` key.

Skip compare includes both IR content and the comment map. Comment-only edits create a new generation.

Key order for every mapping:

1. System meta: version, createdAt, modifiedAt, savedAt
2. Snapshot preferred keys (SNAPSHOT_YAML_PREFERRED_KEYS)
3. Remaining keys in ASCII (UTF-16 code unit) order. This is not natural numeric order.

Envelope shape:

- root: version, savedAt, uiDefinition, components
- uiDefinition: version, createdAt, modifiedAt, logicalId, name, description (external last if present)
- components[]: logicalId, type, label, then type-specific keys, then external

createdAt is preserved by buildSnapshotMetaForWrite on first save.

application.yml still loads with js-yaml for now; unify onto eemeli/yaml later.

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
| メタ / snapshot 型 | `src/lib/ir/ui-definition-meta.ts`, `src/lib/ir/snapshot.ts`, `src/lib/ir/snapshot-comment-map.ts` |
| YAML key sort / comments | `src/lib/utils/object-key-sort.ts`, `src/lib/utils/yaml-document.ts`, `src/lib/utils/yaml-comments.ts` |
