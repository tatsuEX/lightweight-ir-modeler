# IRDefinition 純クラスと Svelte store の分割

Date: 2026-09-06 23:15

## Problem / goal

`src/lib/store/layout-editor/layout-editor.svelte.ts` の `UIDefinition` は、画面定義（IR）の操作と Svelte 5 `$state` / Context が同一クラスに載っている。

アーキテクチャ上の SSOT（Single Source Of Truth）は `IRDefinition`（`ir/`、Svelte 非依存）であり、store はそれを保持・参照する presentation 端である。現状は store が SSOT を再定義している。

ゴール:

1. ドメイン操作を **Svelte を import しない pure class** に移す
2. `$state` と Context は store 側の薄い工場に閉じる
3. Property 属性表の `bind:value={component.label}` / `bind:value={uiDefinition.name}` は維持する
4. この分割で `Component` クラス階層までは作らない（YAGNI）

## 現状の混在

| 関心 | 今の置き場 | 問題 |
|---|---|---|
| 画面メタ + components の mutate | `UIDefinition`（`$state` フィールド） | ドメインが `.svelte.ts` に閉じる。CLI / 単体テストが Svelte compiler 前提 |
| Context | 同ファイル `createContext<UIDefinition>()` | 妥当（presentation） |
| `createTextbox` 等ファクトリ | 同ファイル | IR 要素の既定値なのに store にある |
| `loadImported` | `UIDefinition` が `ImportedDefinition`（`transform/`）を知る | `ir/` が transform に依存してはいけない |
| `clonePlainData` | store | Proxy 対策。ドメインではなく presentation |
| Export client の引数型 | `import type { UIDefinition } from '...layout-editor.svelte'` | HTTP ポートが Svelte モジュールに型依存 |
| 画面レベルの `id`（nanoid 24） | `UIDefinitionState.id` | getter のみ。呼び出し元なし。snapshot にも出ない |

`docs/architecture/overview.md` も「`IRDefinition` / `Component` クラス階層は今後」と既に書いている。

## 反応性（この分割の核心）

属性表は **配列要素オブジェクトへの直接 bind** に依存している。Svelte 5 では、クラス private を `$state` で包んでも、中の plain class を mutate しただけでは追跡されない。逆に **同じオブジェクトグラフを `$state` で作ってクラスに渡す** と、クラスが Svelte を知らなくても Proxy 経由で bind / `$effect`（auto-save）が動く。

### 採用: 注入ドキュメント（mutable data bag）

```text
store: data = $state(createIrDefinitionData(...))
     → new IRDefinition(data)
     → setUIDefinitionContext(ir)
IRDefinition は data を mutate するだけ（Svelte import なし）
```

- GUI: 注入される `data` が Proxy → 既存 bind がそのまま動く
- テスト / CLI: 普通の plain object を渡す
- `loadSnapshot` 前の `clonePlainData` は store 側に残す（Proxy を structuredClone しない）

### 不採用

| 案 | 理由 |
|---|---|
| store が `IRDefinition` をフィールドで `$state` ラップ | private フィールドの内部 mutate が追跡されない |
|  immutable（操作のたびに新インスタンス） | ネスト bind を全部 setter に書き換える必要がある |
| `UIDefinition extends IRDefinition` で `$state` を上書き | `super()` 前に `$state` を作れない。ゲッター二重定義になる |

## 名前

| 役割 | 名前 | 理由 |
|---|---|---|
| ドメインクラス | `IRDefinition` | 既存ルール（`ir-definition.mdc` / `store-presentation.mdc`） |
| データバッグ | `IRDefinitionData` | メタ + `components`。`UIDefinitionState` を置換 |
| Context | `getUIDefinitionContext` / `setUIDefinitionContext` | 呼び出し点が多い。型だけ `IRDefinition` に替える |
| 旧クラス名 `UIDefinition` | 削除 | store に同名ラッパを残すと SSOT がまた二重になる |

画面の「UI Definition」という語はメタ型 `UiDefinitionEditorMeta` と Context 名に残す。

## 実装先ディレクトリ

```text
src/lib/ir/
  ir-definition.ts              # IRDefinition / IRDefinitionData（新規）
  ir-definition.spec.ts         # 純関数テスト（新規）
  elements/
    factories.ts                # createTextbox … createComponentByType / isPropertyEditableType
  ui-definition-meta.ts         # 変更なし（メタの正規化・snapshot 用）
  snapshot.ts                   # 変更なし

src/lib/store/layout-editor/
  layout-editor.svelte.ts       # $state 工場 + Context + loadImported + clonePlainData
                                # UIDefinition クラスは置かない
```

`src/lib/ir/ui-definitions/v1.0/` には置かない。そちらは snapshot メタの schema 版（進行中）であり、エディタ集約クラスを 1.0 フォルダに凍らせると IR スキーマ移行エンジン相当になる（対象外）。

`src/lib/ir/elements/` に type ごとの `Component` サブクラスは **この分割では作らない**。ファクトリは plain object を返す現状のまま移す。クラス階層は別提案。

## 責務分割

### `IRDefinition`（`ir/`）

持ってよい:

- メタ getter/setter（`logicalId` / `name` / … / `external`）
- `components` の `append` / `remove` / `removeByIds` / `moveItem` / `replaceComponents`
- `loadSnapshot(components, meta?)` — 既に plain な入力を前提
- `toEditorMeta()` — auto-save / export がバラ読みしなくて済むならここで組み立て（`ui-definition-meta.ts` の `toEditorMeta` を呼ぶ）

持ってはいけない:

- `import 'svelte'` / `$state`
- `ImportedDefinition`（transform）
- ファイル I/O、fetch
- `clonePlainData`

画面レベルの未使用 `id` は **ドメインに載せない**（死コード削除）。コンポーネント `id` は既存どおりファクトリ / snapshot restore が採番。

### store（`.svelte.ts`）

```typescript
export function createReactiveIRDefinition(
  logicalId: string,
  name: string,
  description: string,
  version: string
): IRDefinition {
  const data = $state(createIrDefinitionData({ logicalId, name, description, version }));
  return new IRDefinition(data);
}

export const [getUIDefinitionContext, setUIDefinitionContext] =
  createContext<IRDefinition>();

export function loadImported(ir: IRDefinition, imported: ImportedDefinition): void {
  const plain = clonePlainData(imported);
  ir.loadSnapshot(
    plain.components.map((c) => createComponentByType(c)),
    plain.uiDefinition
  );
}
```

`+layout.svelte` は `new UIDefinition(...)` を `createReactiveIRDefinition(...)` に替える。`loadImported` の呼び出しは `uiDefinition.loadImported` から上記ヘルパへ。

ファクトリは `$lib/ir/elements/factories` から re-export してもよい（パレットの import パスを一気に変えなくてよい）。残すなら「互換 re-export のみ」とコメントする。

### 呼び出し側の変更（小）

| ファイル | 変更 |
|---|---|
| `+layout.svelte` | 工場関数で生成 |
| `DefinitionImportModal.svelte` | `loadImported(uiDefinition, imported)` |
| `ComponentToolPalette.svelte` | ファクトリ import 先（または re-export） |
| `ComponentAttributeTable.svelte` | `isPropertyEditableType` の import 先 |
| `ui-export-client.ts` | `import type { IRDefinition } from '$lib/ir/ir-definition'` |
| `ir-auto-save.svelte.ts` | 同上。可能なら `ir.toEditorMeta()` |
| その他 `getUIDefinitionContext()` | 型が `IRDefinition` になる以外、API は同じ |

## 依存方向

```text
components / routes
  → store/layout-editor（Context・loadImported・$state 工場）
    → ir/IRDefinition
    → ir/elements/factories
    → transform/ImportedDefinition（loadImported のみ）

ui-export-client
  → ir/IRDefinition（型のみ。svelte モジュールを import しない）

ir/ は svelte / store / transform を import しない
```

## 実装手順（承認後）

1. `IRDefinition` + `createIrDefinitionData` を `ir/` に追加し、既存 mutate を移植。spec を書く
2. ファクトリを `ir/elements/factories.ts` へ移動
3. `layout-editor.svelte.ts` を工場 + Context + `loadImported` + clone に削る
4. Context 型と export-client / auto-save の import を差し替え
5. `docs/architecture/overview.md` のクラス図と `ir/` 成果物表を更新。`layout-editor.md` の「Context 上の UIDefinition」を `IRDefinition` と明記
6. `store-presentation.mdc` の example を `createReactiveIRDefinition` に合わせる

## やらないこと（この分割）

- `Component` 具象クラス（textbox 等）と `ir/elements/*.ts` の一型一ファイル
- snapshot YAML 形式の変更、`id` 永続化
- Context 名のリネーム（`getIRDefinitionContext`）
- `ui-definitions/v1.0/` への集約クラス配置
- immutable IR

## Open questions

1. **ファクトリの公開パス:** パレットは `$lib/ir/elements/factories` を直接 import するか、store から互換 re-export するか（推奨: 直接 ir。store は GUI 状態だけ）
2. **`toEditorMeta` を `IRDefinition` に持たせるか:** auto-save / export のバラ読みを減らすなら Yes。メタ正規化自体は既存 `ui-definition-meta.ts` に残す
3. **`components` の `any[]`:** この分割では現状維持。型付けは Component 階層のときにやる
