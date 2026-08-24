---
created: "2026-08-08T22:54:00"
updated: "2026-08-24T23:50:00"
summary: "IR snapshot と UI import/export/download の HTTP エンドポイント契約"
features:
  - http-api
  - ir-snapshot
  - ui-export
  - ui-import
  - yaml-comments
---

# HTTP API

最終更新: 2026-08-24 23:50

SvelteKit `src/routes/api/**/+server.ts` が提供するエンドポイント一覧。

## IR Snapshot

### `POST /api/ir/snapshot`

編集中メタ + components + 任意の `comments`（YAML キーパス → Markdown）を YAML snapshot として保存する。

- **403**: `ir.autoSave.enabled` が false
- **400**: JSON 不正 / `components` 非配列 / メタ不正
- **201**: 新規書込
- **200**: 内容同一のため skip（`skipped: true`）

### `GET /api/ir/snapshot?logicalId=<id>`

指定 logicalId の最新 snapshot を JSON で返す。`comments` は YAML から抽出したパスマップ（ファイル内の `#` コメント）。

- **404**: 無し
- **400**: logicalId 不正
- **403**: 自動保存無効

### `GET /api/ir/snapshot/logical-ids`

`{ logicalIds: string[] }` を返す。自動保存無効時は空配列（403 にしない）。

## UI Export

### `POST /api/ui/export`

Body 例（仮想。`target` は registry 登録済み targetId）:

```json
{
  "target": "<targetId>",
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
  "target": "<targetId>",
  "logicalId": "sampleForm",
  "relativePath": "<targetId>/sampleForm/<filename>",
  "filename": "<filename>",
  "writtenAt": "2026-08-08T13:39:29.652Z"
}
```

失敗:

- **403**: `app.io.exportDir` 未設定
- **400**: 未対応 target / Raw 検証失敗（`issues[]` 付き）
- **500**: その他

成果物の拡張子・相対パスの詳細は各 target の Export ドキュメントを参照。

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
| `target` | Reader 実装済み targetId（`IMPORT_TARGET_REGISTRY`） |
| `file` | 定義ファイル本体（2MB 以下。受付拡張子は各 Reader の `acceptExtensions`） |

成功 **200**（仮想例。`external` の中身は target 固有の不透明残余）:

```json
{
  "target": "<targetId>",
  "uiDefinition": {
    "logicalId": "sampleForm",
    "name": "Sample Form",
    "description": "",
    "version": "1.0.0",
    "external": {
      "<targetId>": {}
    }
  },
  "components": [
    {
      "logicalId": "field1",
      "type": "textbox",
      "label": "Field 1",
      "external": {
        "<targetId>": {}
      }
    }
  ]
}
```

`components` にエディタ用 `id` は含まれない（クライアントのファクトリが採番する）。  
`external['<targetId>']` のキー構成・意味は各 target の Import ドキュメントを参照。

失敗:

- **400**: 未対応 target / `file` 未指定 / サイズ超過 / 拡張子不一致 / パース失敗 / target 固有の読取拒否 / Raw 検証失敗（`issues[]` 付き）
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
- [im-forma Import](../use-cases/im-forma-import.md)
- [im-forma Export](../use-cases/im-forma-export.md)
- [PrimeFaces Import](../use-cases/primefaces-import.md)
- [PrimeFaces Export](../use-cases/primefaces-export.md)
