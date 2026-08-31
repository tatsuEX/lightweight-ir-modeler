---
created: "2026-09-01T06:59:00"
updated: "2026-09-01T06:59:00"
summary: "自コード MIT と第三者 NOTICE の置き場、static 経由の成果物掲載"
features:
  - licensing
---

# ライセンス方針

最終更新: 2026-09-01 06:59

| 対象 | 置き場 | ライセンス |
|---|---|---|
| 自作ソース | ルート `LICENSE`、`package.json` の `"license": "MIT"` | MIT |
| 第三者パッケージ | `THIRD_PARTY_NOTICES.md` | 各パッケージの SPDX（ISC / MIT / BSD / Python-2.0 等） |

第三者（例: `yaml` の ISC）を使うことは、本プロジェクト自身を ISC にすることではない。自コードは MIT のままとする。

## ビルド成果物への掲載

Vite / SvelteKit は許諾文を自動出力しない。再配布物へ載せる文面は `static/` に置き、クライアント成果物へコピーする。

| 正本 | 成果物用コピー |
|---|---|
| `LICENSE` | `static/LICENSE` |
| `THIRD_PARTY_NOTICES.md` | `static/THIRD_PARTY_NOTICES.md` |

`npm run build` 後は `.svelte-kit/output/client/LICENSE` と `.svelte-kit/output/client/THIRD_PARTY_NOTICES.md` に出る（`static/robots.txt` と同じ経路）。`npm run dev` では `/LICENSE` と `/THIRD_PARTY_NOTICES.md` で読める。

ルートと `static/` は同一内容を保つ。内容を変えたら両方を更新する。
