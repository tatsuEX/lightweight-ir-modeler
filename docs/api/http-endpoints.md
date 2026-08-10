---
created: "2026-08-08T22:54:00"
updated: "2026-08-10T06:20:00"
summary: "IR snapshot と UI import/export/download の HTTP エンドポイント契約"
features:
  - http-api
  - ir-snapshot
  - ui-export
  - ui-import
---

# HTTP API

最終更新: 2026-08-10 06:20

SvelteKit `src/routes/api/**/+server.ts` が提供するエンドポイント一覧。

## IR Snapshot

### `POST /api/ir/snapshot`

編集中メタ + components を YAML snapshot として保存する。

- **403**: `ir.autoSave.enabled` が false
- **400**: JSON 不正 / `components` 非配列 / メタ不正
- **201**: 新規書込
- **200**: 内容同一のため skip（`skipped: true`）

### `GET /api/ir/snapshot?logicalId=<id>`

指定 logicalId の最新 snapshot を JSON で返す。

- **404**: 無し
- **400**: logicalId 不正
- **403**: 自動保存無効

### `GET /api/ir/snapshot/logical-ids`

`{ logicalIds: string[] }` を返す。自動保存無効時は空配列（403 にしない）。

## UI Export

### `POST /api/ui/export`

Body 例:

```json
{
  "target": "primefaces",
  "uiDefinition": {
    "logicalId": "sampleForm",
    "name": "Sample",
    "description": "",
    "version": "1.0.0"
  },
  "components": []
}
```

成功 **201**:

```json
{
  "target": "primefaces",
  "logicalId": "sampleForm",
  "relativePath": "primefaces/sampleForm/sampleForm.xhtml",
  "filename": "sampleForm.xhtml",
  "writtenAt": "2026-08-08T13:39:29.652Z"
}
```

失敗:

- **403**: `app.io.exportDir` 未設定
- **400**: 未対応 target / Raw 検証失敗（`issues[]` 付き）
- **500**: その他

### `GET /api/ui/download/[target]/[logicalId]`

成果物バイトを `Content-Disposition: attachment` で返す。

カスタムヘッダ:

| Header | 値 |
|---|---|
| `X-Ui-Export-Auto` | `true` / `false`（今回サーバが自動 export したか） |
| `X-Ui-Export-Source` | `existing` / `snapshot` |

成果物が無いときのみ最新 snapshot から `exportFromLatestSnapshot` を実行する。

## UI Import

### `POST /api/ui/import`

`multipart/form-data` でアップロードした外部 UI 定義ファイルを IR へ変換して返す。ファイルは保存しない。

| フィールド | 内容 |
|---|---|
| `target` | Reader 実装済み targetId（`im-forma` / `primefaces`） |
| `file` | 定義ファイル本体（2MB 以下。`im-forma` は `.json`、`primefaces` は `.xhtml`） |

成功 **200**:

```json
{
  "target": "im-forma",
  "uiDefinition": {
    "logicalId": "applyForm",
    "name": "申請フォーム",
    "description": "",
    "version": "1.0.0",
    "external": { "im-forma": { "formSystemId": "IMF-FORM-0001" } }
  },
  "components": []
}
```

`components` にエディタ用 `id` は含まれない（クライアントのファクトリが採番する）。

失敗:

- **400**: 未対応 target / `file` 未指定 / サイズ超過 / 拡張子不一致 / パース失敗 / Raw 検証失敗（`issues[]` 付き）
- **500**: その他

## ページルート（参考）

| Path | 説明 |
|---|---|
| `/` | TOP |
| `/layout-editor` | → `/layout-editor/property` へ 302 |
| `/layout-editor/property` | 属性編集 |
| `/layout-editor/layout` | 配置編集 |
| `/layout-editor/preview` | プレビュー / 出力 |

## 関連ドキュメント

- [IR snapshot ユースケース](../use-cases/ir-snapshot-auto-save.md)
- [UI Export ユースケース](../use-cases/ui-export.md)
- [UI Import ユースケース](../use-cases/ui-import.md)
