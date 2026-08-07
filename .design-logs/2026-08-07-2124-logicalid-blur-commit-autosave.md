# logicalId blur-only snapshot directory commit

- Date: 2026-08-07 21:24 (+09:00)
- Status: implemented (local draft in accordion)

## Problem / goal

`UiDefinitionMetaAccordion` の ID (`logicalId`) 入力中も `attachIrAutoSave` が debounce 保存を走らせ、`ir-snapshot-io.writeSnapshot` が **入力途中の logicalId をディレクトリ名** にして snapshot を量産している。

**Goal:** snapshot ディレクトリ（= 永続化に使う logicalId）は **blur 確定時のみ** 更新する。name / description / version / components は従来どおり debounce 自動保存を維持する。

## Root cause

```
Autocomplete bind:value → uiDefinition.logicalId (every keystroke)
    ↓
ir-auto-save $effect watches logicalId
    ↓
POST /api/ir/snapshot → writeSnapshot(editorMeta.logicalId)
    ↓
resolveSnapshotDirForLogicalId(logicalId)  // partial ID dirs created
```

`onblur` では hydrate のみ行っており、保存タイミングとは未連動。

## Recommended approach: committed `snapshotLogicalId` in store

編集中の `logicalId` と、snapshot 保存に使う **確定済み ID** を分離する。

| Field | Role |
|---|---|
| `logicalId` | UI 編集用（Autocomplete に bind、ヘッダ表示もこちら） |
| `snapshotLogicalId` | auto-save / snapshot ディレクトリ名にのみ使用 |

### Behavior

1. **初期化・hydrate 時:** 両方を同じ値にセット
2. **入力中:** `logicalId` のみ変化 → auto-save は **再実行しない**（effect が `snapshotLogicalId` のみ参照）
3. **blur / autocomplete 選択時:** `commitLogicalId()` で trim + `isValidLogicalId` 検証 → 有効なら `snapshotLogicalId` を更新 → effect が走り保存
4. **logicalId 編集中に name 等を変更:** 直前の `snapshotLogicalId` ディレクトリへ保存（YAML 内 logicalId も確定値）

### `commitLogicalId()` (UIDefinition)

```typescript
commitLogicalId(): boolean {
  const trimmed = this.logicalId.trim();
  if (!isValidLogicalId(trimmed)) return false;
  this.logicalId = trimmed;
  if (this.snapshotLogicalId === trimmed) return false;
  this.snapshotLogicalId = trimmed;
  return true;
}
```

### `ir-auto-save` payload

- `uiDefinition.logicalId` → **`snapshotLogicalId`**
- `$effect` は **`logicalId` を読まない**（入力中の再保存を防ぐ）

## Alternative (lighter): local draft in accordion only

`UiDefinitionMetaAccordion` 内に `logicalIdInput` を持ち、`uiDefinition.logicalId` へは blur/onselect 時のみ反映。

- **Pros:** store / auto-save 変更なし（1 ファイル）
- **Cons:** ヘッダーは blur まで旧 ID 表示、store に「編集中 ID」が載らない、意図が auto-save 側に見えにくい

本件は ID が **永続化キー** であるため、store 分離（推奨案）を優先。

## Out of scope

- 既に作成された中途半端な logicalId ディレクトリの削除・マイグレーション
- logicalId 変更時の旧ディレクトリ rename
- ID フィールドのバリデーション UI

## Files to change

| File | Change |
|---|---|
| `src/lib/store/layout-editor/layout-editor.svelte.ts` | `snapshotLogicalId` 追加、`commitLogicalId()`、`loadSnapshot` / constructor で同期 |
| `src/lib/store/layout-editor/ir-auto-save.svelte.ts` | payload に `snapshotLogicalId` 使用、effect から live `logicalId` 除外 |
| `src/lib/components/UiDefinitionMetaAccordion.svelte` | blur / `onselect` で `commitLogicalId()` + hydrate |
| `src/lib/store/layout-editor/ir-auto-save.svelte.spec.ts` (new) | logicalId 入力中は保存ペイロードが変わらないこと |
| `src/lib/store/layout-editor/layout-editor.svelte.spec.ts` (new, optional) | `commitLogicalId()` の trim / 検証 |

**変更不要:** `ir-snapshot-io.ts`, `+server.ts`（クライアントが確定 ID のみ送れば現行のまま）
