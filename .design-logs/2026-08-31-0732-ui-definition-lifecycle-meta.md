# 画面定義メタ: version 自動採番とライフサイクル項目

Date: 2026-08-31 07:32

## Problem / goal

`UiDefinitionMetaAccordion` では `version` をユーザが手入力している。確定フロー実装後、`<main>.<sub>` はシステムが採番する。エディタにはメモどおりのライフサイクル項目を載せ、表示順を ID → 画面名 → 確定版 → 変更概要 → リリース日 → 廃止日 → 廃止理由 → 説明 にする。

## Proposed approach

### 意味

| フィールド | 編集 | 永続化 |
|---|---|---|
| `version` | 表示のみ。確定 / 過去版読込 / 新規作成時のみシステムが更新 | current / versions とも必須 |
| `changeReason?` | ユーザ任意。版の識別名・変更点 | current 自動保存、確定時に versions へコピー |
| `releasedAt?` | ユーザ任意のリリース日 | 同上 |
| `closedAt?` | ユーザ任意の廃止日 | 同上 |
| `closedReason?` | ユーザ任意の廃止理由 | 同上 |
| `basedOn?` | 表示のみ（既存ヒント） | 既存どおり。今回の入力欄には出さない |
| `description` | 既存どおり | 既存どおり |

`createdAt` / `modifiedAt` はファイルライフサイクル用のシステム日時のまま。UI には出さない。

### version UI

- `Input` の `bind:value={uiDefinition.version}` を廃止する。
- 確定版行は **現在の working `version` の読み取り表示** + 既存の確定 / 読込コントロールを 1 行にまとめる。
- `SnapshotVersionControls` 側の「確定版」ラベルは accordion 側に寄せ、二重ラベルを避ける。
- アコーディオン見出しの `ver. ${version}` はそのまま。

### 日付の形

- 画面は日付のみ（`YYYY-MM-DD`）。flowbite-svelte の Datepicker（既存のコンポーネント詳細と同様）。
- YAML にも `YYYY-MM-DD` を書く（`createdAt` の ISO datetime とは別）。空はキー省略。

### `releasedAt` の方針変更

現状 `buildPublishedSnapshotMeta` は確定時刻の ISO を必ず書く。エディタの `toEditorMeta` は `releasedAt` を落とす。

提案: **ユーザ所有の任意項目** にする。

- 確定時はエディタ値をコピーする。空ならキーを書かない（確定時刻で埋めない）。
- current にもユーザが入れた値があれば残す（「予定リリース日」を作業中に持てる）。

### 確定版ファイルの不変性 vs 廃止

`versions/<v>/snapshot.yml` は確定後不変。廃止日を「すでに確定した 1.0 に後から書く」ことは、不変性と衝突する。

MVP: `closedAt` / `closedReason` は **current の編集フィールド**。次の確定でその版の YAML に凍る。既確定ファイルへの後書きはしない。

後から既確定版だけ閉じたい場合は、別途 PATCH（ライフサイクルキーのみ更新）が必要。今回はやらない。

### アコーディオン配置（`md:grid-cols-2`）

1. ID | 画面名
2. 確定版（`md:col-span-2`）: 読み取り `version` + `SnapshotVersionControls`（確定・選択・読込・HEAD / basedOn ヒント）
3. 変更概要 `changeReason`（`md:col-span-2`、短め Textarea または Input）
4. リリース日 | 廃止日
5. 廃止理由 `closedReason`（`md:col-span-2`）
6. 説明（`md:col-span-2`、既存 Textarea）

### YAML キー順（preferred keys）

`logicalId`, `name`, `version`, `changeReason`, `releasedAt`, `closedAt`, `closedReason`, `description`, `basedOn`, …（`external` は末尾寄り既存どおり）

コメント対象ツリーもこの順になる。

### Export / Import

ベンダー定義へは出さない（IR snapshot 専用）。Import 時はキーが無ければ未設定。

## Alternatives

- 確定時に空の `releasedAt` を `now` で埋める（現状に近い）。ユーザ入力を優先したいので不採用。
- 既確定 YAML の `closedAt` だけ更新を許す。不変性の例外が増えるので後回し。
- `releasedAt` を datetime-local にする。メモが「リリース日」なので日付のみ。

## Open questions（実装前に確認したい）

1. 空の `releasedAt` で確定したとき、キー省略でよいか（確定時刻埋めはしない）。
2. 既確定版への後付け廃止は今回スコープ外でよいか。
3. 日付は `YYYY-MM-DD` でよいか。

## Files (when implementing)

See chat proposal table. Living docs: `docs/use-cases/ir-snapshot-auto-save.md`, `docs/use-cases/layout-editor.md`, `docs/architecture/overview.md`.

## 追記（2026-08-31 07:40）選択 UI と cache 形

ユーザ向けの版識別は **changeReason（+ version）**。確定版セレクト・確定ボタン・HEAD / basedOn ヒントは `changeReason (version)` と併記する。

`GET /api/ir/snapshot/versions` は `summaries: { version, changeReason? }[]` を返す。いまは各 `versions/<v>/snapshot.yml` から読む。将来 versions 直下の cache で検索容易性を足しても、この応答形は変えない。
