# IR: defaultValue 統一と binding 非搭載

- Date: 2026-08-09 18:47 (+09:00)
- Status: decided (author)
- Relates: 2026-08-09-1835-ir-component-payload-naming.md

## Problem / goal

前回レビューで「初期値」と「双方向バインドする View モデル」の同居を指摘した。  
作者側で意図を明確化し、IR 上の扱いを確定する。

## Decisions

1. **初期値**はコンポーネント横断で `defaultValue` に統一する（`text` / `selected` / `number` 等の意味別キーは使わない）。
2. **バインドモデル**（外部 UI フレームワーク / プラットフォーム依存の双方向バインド）は IR の責務外とし、`layout-editor.svelte.ts`（IR ファクトリ）には載せない。
3. エクスポート先の `value="#{...}"` 等への写像は、必要になった時点で Raw / Writer / target 固有レイヤで扱う（YAGNI）。

## Rationale

- IR はポータブルな UI 定義の SSOT（Single Source Of Truth）。バインド式の構文・解決はターゲットごとに変わる。
- 初期値だけを IR に残すと、プレビュー・オーサリング・スナップショットの意味が単純になる。
- 汎用キー `defaultValue` は type ごとの値型（string / number / string[] / …）と組み合わせる discriminated union として自然。

## Current shape (factories)

| type | defaultValue（現状） |
|---|---|
| textbox / textarea / label / radio | `''` |
| number | `0` |
| checkbox | `[]` |
| dropdown | `[]` + `multiple: false` |
| datepicker / datetimepicker / timepicker | `new Date()` |
| date-span | `defaultValueFrom` / `defaultValueTo`（`''`） |

## Follow-ups (non-blocking)

- date 系の `Date` オブジェクトを IR/snapshot に載せるか（string | null 推奨は前回どおり、未決）
- dropdown: `multiple: false` なのに既定が `[]` — 単一時は `''`、複数時は `[]` に揃えると型が素直
- date-span: `defaultValue: { from, to }` に畳むか、`From`/`To` サフィックスを許容するか
- label に `defaultValue` を持たせるか（表示文言なら `text` / `caption` の方が意味が近い可能性）

## Alternatives rejected (for now)

- IR に `binding` / `modelPath` を持つ — ターゲット依存が強いため見送り
- 意味別キー（`text` / `selected`）維持 — 初期値用途なら横断キーの方が汎用処理に有利
