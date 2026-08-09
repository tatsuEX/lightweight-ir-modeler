# IR コンポーネント payload 命名レビュー

- Date: 2026-08-09 18:35 (+09:00)
- Status: proposal / review
- Source: `src/lib/store/layout-editor/layout-editor.svelte.ts` factories

## Problem / goal

UI コンポーネント種別拡充に伴い、旧来の汎用 `value` を `text` / `selected` / `number` 等へ改名した。  
「HTML/DOM の value は IR として意味が具体的すぎる」という動機の妥当性と、現状データモデルが IR（SSOT）として足りるかをレビューする。

## Verdict

- **動機は妥当**: IR キーから HTML/JSF の `value` 語彙を外す方向は正しい。
- **現状は途中段階**: 意味別プロパティ方針は維持してよいが、`selected` の過負荷・初期値と bind の同居・`number` の type 名衝突を先に揃える。

## Proposed vocabulary

| カテゴリ | IR キー | 備考 |
|---|---|---|
| 文字列 | `text` | textbox / textarea / label |
| 数値 | `text` または `numberValue` | `type: 'number'` との衝突回避 |
| 単一選択 | `selected: string` | radio / dropdown |
| 複数選択 | `selected: string[]` | checkbox / multi |
| 日付・日時・時刻 | `date` / `dateTime` / `time` as `string \| null` | `Date` は IR に載せない |
| 期間 | `dateFrom` / `dateTo` | `selected*` 接頭辞は使わない |
| バインド | `binding?: string` | リテラル初期値と分離 |

## Key decisions / open questions

1. `selected` を選択肢専用にするか（推奨: Yes）
2. 初期値と `binding` を分けるか（推奨: Yes、最小は optional `binding`）
3. number プロパティ名（`numberValue` vs `text` 統一）
4. dropdown は単一選択か複数選択か（既定が `[]` なのは要確認）
5. 時刻系を `string | null` にするか（推奨: Yes）

## Alternatives discussed

- **B. 型付き単一スロット** (`defaultValue` union): 汎用処理向きだが属性 UI が抽象的。MVP では不採用。
- 汎用 `value` 復帰: エクスポート adapter との語衝突が再発するため非推奨。

## Notes

- `items[].value`（選択肢識別子）はフィールド payload の `value` 問題とは別。残してよい。
- ファクトリの `ir/elements/` 移設は語彙確定後でよい。
