# Property 属性テーブル: Basic / Details / Validation

- Date: 2026-08-09 23:45
- Status: implemented
- Related: `.design-logs/2026-08-09-2306-property-attribute-column-groups.md`

## Problem

`Basic | Items | DateTime` は type 家族ごとに ButtonGroup が増える粒度で、関心（共通 / 個別 / 検証）と合っていなかった。

## Decision

**案1**: `[ Basic | Details | Validation ]` に固定。案2（type フィルタ）は不採用。

- 固定列: 選択 / id / type / label
- Basic: `hint`
- Details: type 別スタック（items / format / cols·rows）
- Validation: required + type 別制約

## IR: 日付系 format 統合

- Factory から `placeholder` を削除。SSOT は `format` のみ
- PrimeFaces shape のテンプレ用 `placeholder` は `format` から導出
- `ir-to-raw-fields` は `placeholder` を載せない

## Details / Validation 対応（実装時）

| グループ | type | フィールド |
|---|---|---|
| Details | choice | items |
| Details | date 系 | format |
| Details | textarea | cols, rows |
| Validation | 共通 | required（ある type） |
| Validation | textbox | pattern, minlength, maxlength |
| Validation | textarea | maxlength |
| Validation | number | min, max |
| Validation | date 系 | min/max 境界 |

## Files

- `ComponentAttributeTable.svelte`
- `ComponentDetailsCell.svelte` / `ComponentValidationCell.svelte`
- `layout-editor.svelte.ts`（date factory）
- `primefaces-shape.ts` / `ir-to-raw-fields.ts`
- `docs/use-cases/layout-editor.md` / `primefaces-export.md`
