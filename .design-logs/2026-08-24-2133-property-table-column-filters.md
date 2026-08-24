# Property 属性テーブル: 列ヘッダフィルタ

Date: 2026-08-24 21:33  
Status: proposal  
Related: `ComponentAttributeTable.svelte`, `.design-logs/2026-08-24-0737-property-table-viewport-scroll.md`

## Problem / goal

Property 属性表の行数が増えると、特定 type / logicalId の行を探すコストが高い。  
**単一入力欄の列ヘッダにフィルタを置き、表示行を絞り込む。** Details / Validation の複合列は対象外。

フィルタは presentation のみ。IR / snapshot には載せない（行選択・列グループと同じ）。

## Current table

常時列: 行選択 / `id`（`logicalId`） / `type` / `label`  
Basic 追加: `hint` / `required` / `readonly` / `disabled`  
Details / Validation: 固定スロット複合列（ヘッダはグループ名のみ）

既存の絞り込みは Toggle「編集可能な項目のみ」のみ。パイプライン:

```
components → showEditableOnly → visibleComponents → 描画
```

## Proposed approach

フィルタを `showEditableOnly` の後段に挟む。列横断は **AND**、type 複数選択は **OR**。

```
components → showEditableOnly → columnFilters (AND) → displayedComponents
```

`select-all` / 選択削除 / 空状態 / `arrowNavigation` の `rowIndex` は **フィルタ後の行** を対象にする。

### 列ごとのフィルタ種別

| 列 | コントロール | マッチ |
|---|---|---|
| 行選択 | なし | — |
| id (`logicalId`) | モード切替 + テキスト | 前方 / 部分 / 後方（既定: 部分）。大小無視 |
| type | 複数チェックの Dropdown | 選択 type の OR。**未選択 = 全件** |
| label / hint | テキストのみ | 部分一致・大小無視 |
| required / readonly / disabled | 3 値 Select | すべて / ON / OFF。非対応行は ON/OFF 時に除外 |
| Details / Validation | なし | — |

Boolean も「単一入力」なので含める。ラベル類は id ほど厳密検索しない想定なので、モード切替は **id だけ**（YAGNI）。

### ヘッダ UI（同一 `th` にタイトル + フィルタ）

Excel の第 2 ヘッダ行や、アイコン奥のポップオーバーより、**常時見えるインライン**を優先する。スキャンしながら絞る用途ではクリック数が少ない。

```
┌─────────────┐  ┌──────────┐  ┌─────────────┐
│ id          │  │ type     │  │ label       │
│ [部分▾][  ] │  │ [Type 2▾]│  │ [        ]  │
└─────────────┘  └──────────┘  └─────────────┘
```

- タイトルは現状どおり小さなラベル。その下に `size="sm"` コントロール。
- フィルタ中の列は枠色 or 小さな件数 Badge でアクティブを示す。
- thead は既存どおり sticky。フィルタ行が増えても 1 セル内に収める（2 行 thead は作らない）。

**id のモード切替:** 入力左のコンパクト Dropdown（Flowbite）。項目は「前方一致 / 部分一致 / 後方一致」。プレースホルダは「ID で絞り込み」。完全一致は部分一致で足りるため初期は置かない。

**type:** トリガは `type` または `type · n`。中身は Checkbox リスト + 「すべて解除」。選択肢は **いまの `showEditableOnly` 後に存在する type**（件数つき）。登録済み全 type を常時出すと 0 件 type を選べてしまうので出さない。未知 type（Toggle OFF 時のパススルー）もデータにあれば出す。

**Boolean:** `Select` 3 項目（すべて / ON / OFF）。幅が狭い列なのでラベルはアイコン無し・短い文言。

### ツールバー

列グループ切替の近くに:

- 表示件数: `12 / 40`（フィルタ後 / フィルタ前。`showEditableOnly` 適用後を母数にする）
- いずれかの列フィルタがアクティブなら「フィルタをクリア」

空 tbody は既存の「コンポーネントなし / 編集可能なし」と分け、**「フィルタに一致する行がありません」+ クリア** を出す。

### 列グループ切替との関係

Basic を離れて Details / Validation を見ても、hint / boolean フィルタは **効いたまま**（Excel / AG Grid と同じ）。required=ON の行だけ Details を編集する、が自然。隠れ列にフィルタが残っているときはツールバーの件数とクリアで気づける。

### クリップ対策

テーブル領域は `overflow-auto`（viewport スクロール案で導入済み）。Datepicker と同様、ヘッダ Dropdown が切れる。  
type / マッチモードは既存 `Autocomplete` と同じ Flowbite `Dropdown`（trigger + overlay）にする。セル内 `Select` の native メニューは OS 次第で表の外に出るので Boolean はそれで足りる。

### `arrowNavigation`

フィルタコントロールは行グリッドに入れない。Tab でヘッダ → tbody。フィルタで行が消えても `rowIndex` は表示配列基準のまま。

### 状態

```ts
type TextMatchMode = 'startsWith' | 'contains' | 'endsWith';

type ColumnFilters = {
  logicalIdQuery: string;
  logicalIdMode: TextMatchMode; // default 'contains'
  types: Set<string>;           // empty = all
  labelQuery: string;
  hintQuery: string;
  required: 'all' | 'on' | 'off';
  readonly: 'all' | 'on' | 'off';
  disabled: 'all' | 'on' | 'off';
};
```

- `ComponentAttributeTable` の `$state`（IR に出さない）
- 永続化しない（リロードでリセット）。URL / localStorage は YAGNI
- 行数が少ない想定なのでデバウンスなし（即時）

### モジュール

| 置き場 | 役割 |
|---|---|
| `src/lib/utils/text-match.ts` | 大小無視の前方/部分/後方。単体テスト可 |
| `src/lib/components/ComponentAttributeTable.svelte` | フィルタ state、AND 合成、ヘッダ UI、件数 |
| 汎用フィルタ部品 | **初期は切らない。** 同種 UI が 3 箇所を超えたら抽出 |

type の Checkbox Dropdown だけマークアップが厚い場合は `TypeFilterDropdown.svelte` を同ディレクトリに出してよい。抽象フィルタフレームワークは作らない。

マッチは `logicalId` / `label` / `hint` を `String(... ?? '')` して比較。Boolean は `=== true` / `=== false`。`undefined`（非対応）は ON/OFF どちらにもマッチしない。

## Alternatives considered

| 案 | 却下理由 |
|---|---|
| 漏斗アイコン → ポップオーバー | 列の数だけクリックが増える。主用途は「打ちながら絞る」 |
| クエリ演算子だけ（`^foo` / `foo$`） | 省スペースだが発見しにくい |
| type もテキスト部分一致 | 閉集合（~12 type）なので Checkbox の方が速い |
| 未選択 type = 0 件 | 「全部外すと消える」が驚き。空 = 全件がデファクト |
| Details/Validation をスロット単位でフィルタ | 複合列・type 別フィールドでマッチ定義が発散する。今回対象外 |
| フィルタを store / snapshot へ | 編集対象ではなく表示状態 |

## Open questions

実装前に確認したい点（推奨を括弧書き）:

1. Boolean 列（required 等）も 3 値フィルタするか、テキスト + type だけにするか（**含める**）
2. label / hint も id と同じモード切替にするか（**部分一致のみ**）
3. 完全一致モードを id に足すか（**初期は無し**）
4. 列グループ切替後も隠れ列フィルタを残すか（**残す**）

## Out of scope

- Details / Validation 複合列のフィルタ
- 正規表現 / 大小区別トグル
- フィルタの URL・localStorage 永続化
- 列ディスクリプタ再導入
- 選択行のみ表示
- npm 依存追加（Melt, AG Grid 等）

## Files to change (when implementing)

| File | Change |
|---|---|
| `src/lib/utils/text-match.ts` | 新規。マッチ純関数 |
| `src/lib/utils/text-match.spec.ts` | 新規 |
| `src/lib/components/ComponentAttributeTable.svelte` | ヘッダフィルタ、`displayedComponents`、空状態、件数 |
| `docs/use-cases/layout-editor.md` | Property 属性テーブル節にフィルタ契約を追記 |

## Implementation (2026-08-24 23:54)

Approved as proposed (Boolean 3 値、label/hint は部分一致のみ、完全一致なし、隠れ列フィルタは残す).

Header filter controls are **not** on `arrowNavigation`. Future UX: arrow (or similar) from header filter fields into the same column's row inputs and back. Out of scope for this change; noted in `docs/use-cases/layout-editor.md`.
