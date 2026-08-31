# 過去版 / 確定版まわりの表示削減

日付: 2026-09-01 06:25

## 問題

`UiDefinitionMetaAccordion` と `SnapshotVersionControls` が、同じ `changeReason (version)` を複数箇所に出している。常時表示が多く、過去版・確定版の操作行が散らかって見える。

## ゴール

- `SnapshotVersionControls` を「確定 / 読込の操作部品」に保つ
- 画面メタの編集項目はアコーディオン側に残す
- 常時同義に見えるキャプションを削り、差分があるときだけ状態を出す

## 現状の表示（同じラベルが何回も出る）

| 場所 | 何を出しているか | 正体 |
|---|---|---|
| アコーディオン header | `name (id) - changeReason (version)` | `uiDefinition.version` + `changeReason` |
| アコーディオン本体「確定版」 | 同じラベル（読取専用） | 同上 |
| 過去版 Select | 確定版一覧。HEAD は選択肢末尾に `(HEAD)` | ローカル `selectedVersion`（次に読む版） |
| `HEAD: …` | 最新確定版 | `listing.head` |
| `読込元: …` | 作業コピーの読み込み元 | `uiDefinition.basedOn` |

## 同義に見えるか（結論）

よくある画面（読込直後 / HEAD 作業中）では、次はほぼ同じ文字列になる。

- `selectedVersion` ≈ `basedOn`（読込した版）
- `selectedVersion` ≈ アコーディオン「確定版」（`version`）
- `HEAD` ≈ `version`（HEAD 作業中）

ただし常に同義ではない。

| 状態 | `version`（確定版） | `basedOn`（読込元） | `selectedVersion` | HEAD |
|---|---|---|---|---|
| 未確定の新規 | 既定 `1.0`（未 publish） | なし | 空 | なし |
| 過去版を読んだ直後 | 読んだ版 | 同じ | 同じ | 別（新しい） |
| 過去版をパッチ確定したあと | 新しい sub（例 `1.1`） | 元の読込元（例 `1.0`） | 一覧 refresh で HEAD に飛びうる | 別 |
| HEAD を改版確定したあと | 新しい main | 消える | 残るか HEAD へ | `version` と一致しがち |

`selectedVersion` は「次に読む版」の入力であり、永続化されない。`basedOn` は publish 系統（past / head）の判定に使う永続メタ。責務は違う。

## SnapshotVersionControls の責務

残すもの:

- 操作: 確定、過去版 Select、読込
- 確定系統モーダル（既存）
- **差分があるときだけ** の状態（過去版編集中であること）

持たないもの:

- 画面メタの編集（変更概要・日付・説明）
- working copy の版識別の常時コピー（header と重複する「確定版」）

## 提案（必要最小限）

1. **アコーディオン本体の「確定版」を削除**  
   header が同じ情報。`version` は手入力しない。変更概要は編集項目なので残す。

2. **常時の `HEAD:` 行を削除**  
   Select の選択肢が既に `(HEAD)` を付ける。

3. **常時の `読込元:` 行を削除し、`publishContext === 'past'` のときだけ 1 行**  
   例: `過去版を編集中（読込元: … / HEAD: …）`  
   HEAD 作業中・初回は出さない。過去版パッチ後の `basedOn !== version` はここで残る。

4. **Select 初期値は `basedOn` 優先**（任意）  
   一覧再取得時、`basedOn` が selectable ならそれを選ぶ。常時同期はしない（ユーザが「次に読む版」を変えられなくなるため）。

## レイアウト（アコーディオン grid）

現状: 確定コントロール `col-span-4` の横に「確定版」1 列。

変更後案:

- 1 行目: ID / 画面名（現状どおり）
- 2 行目: `SnapshotVersionControls` を `col-span-4`、横に変更概要 `col-span-2`（確定ラベルと隣接）
- 以降: リリース日 / 廃止日 / 廃止理由 / 説明

## 変更対象

| ファイル | 内容 |
|---|---|
| `src/lib/components/UiDefinitionMetaAccordion.svelte` | 「確定版」ブロック削除。grid を上記へ。header の版ラベルは残す |
| `src/lib/components/SnapshotVersionControls.svelte` | 常時 HEAD / 読込元を削除。past 時だけ 1 行。Select 初期値を basedOn 優先 |
| `docs/use-cases/layout-editor.md` | 項目順から「確定版」を外し、past 時キャプションを書く |

触らない: ドメイン（`basedOn` / `version` / publish API）、`ConfirmPublishKindModal`、ストア。

## 削らないもの

- 確定 / 読込ボタンと過去版 Select
- 変更概要（次の確定ラベルの入力）
- アコーディオン header の版ラベル（折りたたみ時の識別）
- 確定系統モーダル
