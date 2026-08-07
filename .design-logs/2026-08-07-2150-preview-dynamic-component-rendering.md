# Preview Dynamic Component Rendering

**Date:** 2026-08-07

## Problem / Goal

`Preview.svelte` のテーブル 2 列目に、現状の `logicalId` 文字列表示の代わりに、`component.type` に応じた UI ウィジェット（textbox / textarea / number 等）を動的に描画したい。

- Svelte 5（runes）の慣習に沿う
- 型追加時の拡張が局所化される
- IR（domain）とプレビュー描画（presentation）の境界を保つ

## Proposed Approach

### Directory layout

```
src/lib/components/preview/
  preview-component-registry.ts   # type → Svelte Component のマップ
  PreviewComponentRenderer.svelte # ディスパッチャ（Preview から呼ぶ唯一の入口）
  PreviewTextbox.svelte
  PreviewTextarea.svelte
  PreviewNumber.svelte
  PreviewUnknown.svelte           # 未対応 type のフォールバック
  preview-types.ts                # 共通 props 型（任意・小さく始める）
```

Presentation 層専用。`ir/elements/`（将来の domain SSOT）とは分離する。

### Data flow

```
Preview.svelte
  └─ {#each uiDefinition.components}
       └─ PreviewComponentRenderer {component}
            └─ $derived → registry[component.type]
                 └─ PreviewTextbox | PreviewTextarea | PreviewNumber | PreviewUnknown
```

### Registry (TypeScript)

```typescript
import type { Component } from 'svelte';
import PreviewTextbox from './PreviewTextbox.svelte';
import PreviewTextarea from './PreviewTextarea.svelte';
import PreviewNumber from './PreviewNumber.svelte';

/** 現時点でプレビュー対応している IR component type */
export type PreviewComponentType = 'textbox' | 'textarea' | 'number';

export type PreviewRendererProps = {
  component: Record<string, unknown> & { type: string };
};

export const PREVIEW_COMPONENT_REGISTRY: Record<
  PreviewComponentType,
  Component<PreviewRendererProps>
> = {
  textbox: PreviewTextbox,
  textarea: PreviewTextarea,
  number: PreviewNumber,
};

export function resolvePreviewRenderer(type: string): Component<PreviewRendererProps> {
  return (PREVIEW_COMPONENT_REGISTRY as Record<string, Component<PreviewRendererProps>>)[type]
    ?? PreviewUnknown;
}
```

- 新 type 追加 = レンダラ 1 ファイル + registry 1 行
- YAGNI: プラグイン機構・動的 import は不要（型が 3 種のみ）

### Dispatcher (Svelte 5)

```svelte
<script lang="ts">
  import PreviewUnknown from './PreviewUnknown.svelte';
  import { resolvePreviewRenderer } from './preview-component-registry';

  let { component }: { component: Record<string, unknown> & { type: string } } = $props();

  const Renderer = $derived(resolvePreviewRenderer(component.type));
</script>

{#key component.id}
  <Renderer {component} />
{/key}
```

- `$derived` で type 変更に追従
- `{#key component.id}` で行の差し替え・復元時に内部 state をリセット
- Svelte 5 では `<Renderer />` の直接タグが推奨（`<svelte:component>` も可）

### Individual renderers

各ファイルは **セマンティック HTML**（`<input>` / `<textarea>`）+ **識別クラスのみ** で構造を表現する。見た目はテーマ CSS が担当（Flowbite はエディタ UI 用と分離）:

| IR field | Preview behavior |
|---|---|
| `label` | 1 列目で表示済み → 2 列目では placeholder または aria-label のみ |
| `hint` | `.preview-field__hint` で表示 |
| `disabled` / `readonly` | 属性として反映（入力可能がデフォルト、`disabled`/`readonly` IR 値を尊重） |
| `hidden` | **非対応（MVP）** — IR フィールドは残す（将来の論理削除用） |
| `validation.required` | ラベル横に `*` 等（任意） |
| `validation.maxlength` | `maxlength` 属性 |
| `rows` (textarea) | `rows` 属性 |
| autocomplete | `autocomplete="off"` 固定 |

**Preview 値の扱い:** IR を mutate しない。各レンダラ内で `let value = $state('')` を持ち、**入力可能**（使用感確認用）。将来 export 前確認に使う場合は Context で別管理。

### Preview.svelte change

```svelte
<div class="preview-root preview-theme--{selectedTheme}">
  <table>...</table>
</div>
```

```svelte
<td class="...">{component.label}</td>
<td class="...">
  <PreviewComponentRenderer {component} />
</td>
```

`selectedTheme` は Preview ルートの class にのみ反映。各 PreviewComponent には渡さない。

### Theme styling (案 1 採用)

**方針:** 識別クラス + テーマ別外部 CSS。PreviewComponent はテーマ名を知らない。

**DOM / class 契約:**

```
.preview-root.preview-theme--{value}          ← Preview.svelte が付与
  └─ .preview-field.preview-field--{type}    ← 各 Preview* が付与
       ├─ .preview-field__control             ← input / textarea
       └─ .preview-field__hint                ← hint テキスト
```

**ファイル構成:**

```
src/lib/preview/
  preview-classes.ts              # クラス名定数・ヘルパ
  themes/
    tailwind-light.css
    tailwind-dark.css
    bootstrap-light.css
    bootstrap-dark.css
  preview-theme-styles.ts         # theme value → CSS import（Vite がバンドル）
```

**CSS ルール:**

- 各テーマ CSS は `.preview-theme--{value}` 配下にのみスタイルを書く
- セレクタは `.preview-field__control` 等の**識別クラスのみ**を対象にする（Svelte/Flowbite 内部 class は使わない）
- 全テーマ CSS をビルド時 import し、ルート class の切替で表示を切り替える（`<link>` 動的ロードは YAGNI）

**案 3（CSS カスタムプロパティ / デザイントークン）:**

共通プロパティ（padding, border, radius, font-size）は `--preview-control-*` トークン化し、テーマ CSS はトークン定義 + 差分セレクタのみ。Bootstrap 等で markup 差が必要な type だけ、案 1 のフルセレクタ override にフォールバック。

```css
/* themes/bootstrap-light.css */
.preview-theme--bootstrap-light {
  --preview-control-padding: 0.375rem 0.75rem;
  --preview-control-border: 1px solid #ced4da;
  --preview-control-radius: 0.375rem;
}
.preview-theme--bootstrap-light .preview-field__control {
  padding: var(--preview-control-padding);
  border: var(--preview-control-border);
  border-radius: var(--preview-control-radius);
}
```

**PreviewComponent は Flowbite を使わない理由:** Flowbite/Tailwind の utility class と Bootstrap テーマ CSS の override が競合しやすい。プレビューは「出力先に近い素の HTML + テーマ CSS」の方が責務分離に合う。

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| `{#if type === 'textbox'} ... {:else if}` in Preview.svelte | 単ファイルで完結 | type 増加で Preview が肥大化 |
| `<svelte:component>` のみ、registry なし | 最小 | 型安全・フォールバックが弱い |
| 動的 `import()` per type | コード分割 | 3 型のみで過剰（YAGNI 違反） |
| IR 要素クラスに `.render()` | domain に UI 依存 | architecture boundary 違反 |

## Key Decisions

1. **Registry + 薄い Dispatcher** を採用（拡張点は registry のみ）
2. **Preview は presentation** — store / IR を編集しない
3. **Preview 描画はセマンティック HTML + 識別クラス** — 見た目はテーマ CSS（案 1、必要に応じ案 3 のトークン併用）
4. **`selectedTheme` は Preview ルート class のみ** — PreviewComponent にテーマ prop を渡さない
5. **入力は可能** — ローカル `$state`、`autocomplete="off"`、`disabled`/`readonly` は IR 値を反映
6. **`hidden` は MVP 非対応** — IR フィールドは削除しない（将来の論理削除用）
7. **`component` は現状 `any[]`** — registry 側は `Record<string, unknown>` で受け、IR 型確定後に union に絞る

## Resolved Questions (2026-08-07)

| Topic | Decision |
|---|---|
| `hidden` | 非対応のまま。IR の `hidden` フィールドは温存 |
| `selectedTheme` | 案 1（識別クラス + 外部 CSS）。案 3（CSS 変数トークン）を併用可 |
| プレビュー入力 | 入力可能。`autocomplete="off"` |
