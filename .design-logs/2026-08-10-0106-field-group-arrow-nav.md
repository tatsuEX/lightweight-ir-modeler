# fieldGroup 矢印ナビと固定スロット列

Date: 2026-08-10 01:06

## Problem / goal

Details / Validation を 1 セルに複数入力すると、左右がセル内を跨ぎ、上下が「同 field を遠い行まで探す」と textbox → number 行を飛ばして次の textbox へ飛ぶ。編集速度を落とさず、関心な表構造と予測可能な矢印遷移にする。

## Proposed approach

1. Details / Validation を固定スロット `td` に分割（ヘッダは `colspan`）。
2. 各入力に一意 `field` + 任意 `fieldGroup`（`details` / `validation`）。
3. 上下（group あり）: 最寄り行で group メンバーがある行を確定 → 同行内で同 field → ordinal / 先頭。同 field の遠方スキャンはしない。
4. 左右: 同一行の focusable のみ（従来どおり）。
5. Basic は fieldGroup なし（同 field スキップのまま）。

## Alternatives considered

- 可変 td 数: HTML 表が崩れるため不採用。
- DOM 近傍のみで field を推定: マークアップ依存・脆いため不採用。`field` / `fieldGroup` 明示を採用。

## Key decisions

- prop 名は Svelte 予約語回避のため `slotId`。
- Validation の `required` は Basic 側（ユーザー配置）。Validation グループは境界・pattern 系のみ。
- 未対応スロットは `- not supported -`（focusable にしない）→ group 行としてスキップ対象。
