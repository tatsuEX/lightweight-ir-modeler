# UI Definition Meta Accordion (Property)

- Date: 2026-08-07 19:43 (+09:00)
- Status: implemented

## Problem / goal

Property 画面（`ComponentAttributeTable`）で、コンポーネント属性テーブルに加え **`UIDefinitionState`（画面定義メタデータ）** を編集できる UI が必要。Flowbite `Accordion` を使い、折りたたみ時にも入力内容がヘッダから分かるようにする。

## Proposed UI

```
┌─ Accordion header ─────────────────────────────────────┐
│  ユーザー登録 (userRegistration) - ver. 1.0.0    ▼  │  ← 入力あり
└──────────────────────────────────────────────────────┘
  logicalId   [ Input ]
  name        [ Input ]
  description [ Textarea rows=2 ]
  version     [ Input ]

┌─ Accordion header ─────────────────────────────────────┐
│  画面の基本情報を入力                              ▼  │  ← 未入力
└──────────────────────────────────────────────────────┘
```

### Accordion header ルール

| 条件 | 表示 |
|---|---|
| `name` / `logicalId` / `version` がすべて trim 後空 | `画面の基本情報を入力` |
| それ以外 | `{name} ({logicalId}) - ver. {version}` |

- `description` はヘッダには出さない（折り畳み時の要約用に name / logicalId / version のみ）。
- 部分入力（例: name のみ）でもテンプレート形式をそのまま使う（空部分は空文字のまま表示）。

### 編集フィールド

| フィールド | 編集 | 備考 |
|---|---|---|
| `logicalId` | `Input` | |
| `name` | `Input` | |
| `description` | `Textarea`（`rows={2}`） | 複数行想定 |
| `version` | `Input` | |
| `id` | **非表示** | システム生成（nanoid）。ユーザー編集対象外 |

### バインディング

- 既存 Context `getUIDefinitionContext()` から取得した `UIDefinition` インスタンスへ、コンポーネント行と同様 **getter/setter 経由で `bind:value`**。
- store への新メソッド追加は不要（YAGNI）。

### 初期 open 状態

- MVP: **`open = true`（展開）** で開始。未入力ユーザーが最初に気づけるようにする。
- 将来: localStorage 等で折りたたみ状態を記憶する案はスコープ外。

### 配置

- `ComponentAttributeTable.svelte` 内、既存 `Table` の **直上** に Accordion を 1 セクション追加。
- `property/+page.svelte` は変更不要（引き続き `<ComponentAttributeTable />` のみ）。

## Component structure (sketch)

```svelte
<script lang="ts">
  import { Accordion, AccordionItem, Input, Label, Textarea, ... } from 'flowbite-svelte';
  const uiDefinition = getUIDefinitionContext();

  let metaOpen = $state(true);

  const isMetaEmpty = $derived(
    !uiDefinition.name.trim() &&
    !uiDefinition.logicalId.trim() &&
    !uiDefinition.version.trim()
  );

  const accordionHeader = $derived(
    isMetaEmpty
      ? '画面の基本情報を入力'
      : `${uiDefinition.name} (${uiDefinition.logicalId}) - ver. ${uiDefinition.version}`
  );
</script>

<Accordion class="mb-4">
  <AccordionItem bind:open={metaOpen}>
    {#snippet header()}{accordionHeader}{/snippet}
    <!-- Label + Input/Textarea × 4 -->
  </AccordionItem>
</Accordion>

<Table>...</Table>
```

## Files to change

| ファイル | 変更内容 |
|---|---|
| `src/lib/components/ComponentAttributeTable.svelte` | Accordion + メタデータ入力フォーム追加、ヘッダ `$derived` |

## Out of scope (MVP)

- `uiDefinition` メタデータの snapshot / application.yml 永続化（現状 snapshot は `components[]` のみ）
- Accordion 内フィールドへの `arrowNavigation` 連携
- 別コンポーネントへの切り出し（`UiDefinitionMetaAccordion.svelte` 等）— ファイルが肥大化したら再検討
- メタデータのバリデーション（logicalId 重複等）

## Open questions

- ヘッダの「未入力」判定に `description` を含めるか → **含めない**（ヘッダ形式に description がないため）
- `description` を `Input` 単行にするか `Textarea` にするか → **Textarea**（説明文向け）
