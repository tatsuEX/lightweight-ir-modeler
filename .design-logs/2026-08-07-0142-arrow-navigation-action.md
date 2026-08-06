# 矢印キーによるプロパティ表フォーカス遷移（arrowNavigation action）

- Date: 2026-08-07 01:42 (+09:00)
- Status: implemented

## Problem / goal

`ComponentAttributeTable` の編集セル間を、マウスなしで矢印キーにより移動したい。共通の Svelte action として切り出し、他テーブルでも再利用可能にする。

## Proposed approach

### 1. 共通 action

新規: `src/lib/action/arrowNavigation.ts`

- Svelte action シグネチャ:

```ts
type ArrowNavigationParams = {
  field: string; // 列 / 入力項目の識別名
  row: number;   // 行 index（0-based）
};

export function arrowNavigation(
  node: HTMLElement,
  params: ArrowNavigationParams
): { update(params: ArrowNavigationParams): void; destroy(): void };
```

- `node`（またはその内部の実フォーカス対象）に次を付与する:
  - `data-field` — `params.field`
  - `data-row` — `String(params.row)`
  - `data-focusable` — 存在マーカー（値は `"true"`）
- `keydown` で `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` を処理し、同一ルート内の `[data-focusable]` を探索して `focus()` する。

### 2. フォーカス対象の解決（Flowbite 対策）

Svelte 5 では `use:` は DOM 要素にしか付けられない。Flowbite の `Input` / `Toggle` はコンポーネントのため、セル内ラッパーに action を付ける。

```svelte
<span use:arrowNavigation={{ field: 'label', row: index }}>
  <Input ... />
</span>
```

action 内:

1. `resolveFocusable(node)` — `node` 自身が `input` / `textarea` / `button` / `[tabindex]:not([tabindex="-1"])` ならそれ、否则 `node.querySelector(...)` で子孫を取る
2. data 属性と listener は **解決したフォーカス要素** に付与（ラッパーではなく実入力へ）

### 3. 移動ルール（MVP）

| キー | 挙動 |
|---|---|
| ↑ / ↓ | 同じ `data-field`・`row ± 1` の `[data-focusable]` へ |
| ← / → | 同じ `row` 内で、定義済み field 順の前後へ |

- 移動先が無い場合は何もしない（ラップしない）。
- **Ctrl 同時押し必須**: 通常の ←→ は input 内キャレット移動のため、**Ctrl + 矢印** のときのみセル遷移する。
- `Toggle`（button）は常に矢印でセル移動。
- 対象ルートは `node.closest('[data-arrow-nav-root]')` または `closest('table')`。テーブル側に `data-arrow-nav-root` を付けるとスコープが明確。

### 4. 本テーブルでの field 定義

編集可能な列のみ（`type` / Badge は対象外）:

| field | UI |
|---|---|
| `logicalId` | Input |
| `label` | Input |
| `hint` | Input |
| `required` | Toggle |

横移動の順序は上記配列を action 側の定数、またはルート要素の `data-arrow-nav-fields="logicalId,label,hint,required"` で渡す。MVP は **テーブル側で順序定数を持ち、action は DOM 上の同 row の `[data-focusable]` を DOM 順（または field リスト順）で辿る** 方が単純。DOM 順 = セル出現順で足りるなら field リストは不要（KISS）。

推奨（KISS）: 同一 `data-row` の `[data-focusable]` を `querySelectorAll` し、現在要素の index ± 1 で ←→。↑↓ は field + row で直接検索。

### 5. update / destroy

- `update`: row/field 変更時に data 属性を書き直す（行削除・並び替えに備える）。
- `destroy`: listener 削除。data 属性は残しても害は薄いが、対称のため削除してよい。

## Alternatives considered

| 案 | 内容 | 不採用理由 |
|---|---|---|
| コンポーネント内にキー処理直書き | テーブル専用 | 再利用不可・要求と不一致 |
| 全セルを native input 化 | action を直付けしやすい | Flowbite 規約に反する |
| ←→ 常時セル移動 | 実装が最短 | テキスト編集 UX が壊れる |

## Open questions

1. ←→ のキャレット端判定を MVP に含めるか（推奨: 含める。コスト小）
2. action ファイルを `arrowNavigation.ts` 単体にするか `arrowNavigation/index.ts` にするか（推奨: 単体 `.ts`）
3. `src/lib/index.ts` からの再エクスポートは不要（直接 `$lib/action/arrowNavigation` を import）

## 変更対象ファイル

1. **新規** `src/lib/action/arrowNavigation.ts` — action 本体・型・フォーカス解決・キー処理
2. **更新** `src/lib/components/ComponentAttributeTable.svelte` — 各編集セルに `use:arrowNavigation`、テーブルに `data-arrow-nav-root`、`{#each}` の index を `row` に渡す

## やらないこと（今回）

- Tab / Shift+Tab のカスタム（ブラウザ既定のまま）
- セル追加・削除後のフォーカス復帰ロジック専用処理（data-row の update に任せる）
- ユニットテスト追加（動作確認後に必要なら）
- store / IR 変更
