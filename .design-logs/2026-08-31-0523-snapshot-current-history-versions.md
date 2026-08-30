# Snapshot current / history / versions

- Date: 2026-08-31 05:23 (+09:00)
- Status: Phase 2 implemented
- Related: `docs/.memo/snapshot-version-control.md`, `.design-logs/2026-08-07-1708-ir-auto-save-snapshot.md`

## Problem / goal

現状の snapshot は `<logicalId>/ir-snapshot-*.yml` の一次元世代列で、上限超過時に最も古いファイルを prune する。そのため:

1. 編集中の作業コピーと、捨ててよい履歴が同じ列に混ざる
2. ユーザが「確定版」を prune から守れない
3. `uiDefinition.version` は UI にあるが、ディレクトリ／確定フローに使っていない

ゴールは、画面ディレクトリ直下を用途で 3 分割すること。

| 役割 | 意味 | 寿命 |
|---|---|---|
| `current` | いま編集中の作業コピー（Git の working tree 相当） | 上書き更新。常に 1 ファイル |
| `history` | 自動保存の変更履歴（現状の snapshot 列相当） | `maxGenerations` で prune |
| `versions` | ユーザが確定した版 | immutable。prune しない |

## Why the half-migration broke

途中実装は **読み側だけ** 新しい木を見に行き、**書き側は旧レイアウトのまま** だった。

| 関数 | 現状 | 問題 |
|---|---|---|
| `writeSnapshot` | `<logicalId>/ir-snapshot-*.yml` に `wx` 追加 | `current/` も `history/` も作らない |
| `listSnapshotDirectories` | `current` / `history` / `versions` の **絶対パス** を返す | 型コメントは「ディレクトリ名」。パスと名前が混在 |
| `readLatestSnapshot` | tree を見て `versions` 優先、なければ `current`。その後 `join(dir, latest)` して `readFile` | (1) 旧ファイルは見つからない (2) `latest` は既に絶対パスなので二重 join (3) 値がディレクトリパスなのにファイルとして読む (4) エディタ復元に確定版を優先している（設計メモは常に `current`） |

既存テストは「書いてから `readLatestSnapshot`」なので、新レイアウトのディレクトリが無いと読みが `null` になり落ちる。Cursor 側の `An impossible situation occurred` はリポジトリ内に該当文字列がなく、エージェントセッションの内部エラーと見てよい。アプリ側の実害は上記の読み書き不一致。

## Confirmed policy

設計メモの 3 分割は採用する。ただし **一度に全部はやらない**。

### 読む対象は常に current

エディタ復元・`GET /api/ir/snapshot`・`exportFromLatestSnapshot` は、当面すべて **作業中コピー** を読む。

- 「最新」= `current/snapshot.yml`（無ければ後述の旧レイアウトフォールバック）
- `versions/` の HEAD を「最新」にしない。確定版は prune されない正本であり、編集対象ではない

### 書く対象は current + history（同一内容）

自動保存 1 回につき:

1. `current/snapshot.yml` を上書き（`wx` ではない）
2. 同じ YAML を `history/ir-snapshot-<localTs>.yml` に新規作成（現行の timestamp + `wx` + 衝突 suffix）
3. `history/` だけ `pruneSnapshots(maxGenerations)`

skip 比較の相手は **current の 1 ファイル**。history の最新と二重比較しない。

### versions は別操作

確定は自動保存とは変更理由が違う。`writeSnapshot` に mode を足さない。

- Phase 1: `versions/` は作らない（空ディレクトリも作らない）
- Phase 2: 公開 API を別に足す（例: `publishSnapshot`）。`current` を `versions/<version>/snapshot.yml` へ複製。既存確定ディレクトリは上書き禁止

### 呼び出し側はパス構造を知らない

`writeSnapshot` / `readLatestSnapshot` / `readLatestSnapshotIfEnabled` のシグネチャは維持する。`current` や `history` を HTTP や store に漏らさない（API Encapsulation）。

`listSnapshotDirectories` は IO モジュール内部のヘルパに留める。返すなら **絶対パス** に統一し、呼び出し側で `join` し直さない。

## Directory layout (target)

```text
<data/ir>/<logicalId>/
  current/
    snapshot.yml                 # 常に 1 ファイル。上書き
  history/
    ir-snapshot-YYYYMMDDTHHmmss.yml
    ir-snapshot-YYYYMMDDTHHmmss-2.yml   # 同一秒衝突時（現行どおり）
  versions/                      # Phase 2 以降
    1.0.0/
      snapshot.yml
```

拡張子は現行どおり `.yml`（メモの `.yaml` には合わせない。既存 serialize / テストを動かさないため）。

history のファイル名規則は現行 `ir-snapshot-*` を流用する。`listSnapshotFilenames` / `pruneSnapshots` / `snapshotSortKey` を history ディレクトリに対してそのまま使える。

`current` の固定名は `snapshot.yml`。時刻をファイル名に入れない（「最新」判定が不要になる）。

## Phased implementation

### Phase 1 — ディレクトリ分割（今回の実装対象）

自動保存と復元だけを新レイアウトへ移す。確定 UI・確定 API・メタ追加（`basedOn` / `changeReason` / `releasedAt` 等）は入れない。

公開操作:

| 操作 | 実体 |
|---|---|
| 保存 (`writeSnapshot`) | current 上書き + history 追加 + history prune |
| 読込 (`readLatestSnapshot`) | `current/snapshot.yml` |
| 存在確認 (`GET` 404) | current ファイルが無いとき 404（フォールバック後も無しなら 404） |
| logical-ids 一覧 | 現行どおり `<data/ir>` 直下のディレクトリ名 |

内部ヘルパ（案。名前は実装時に合わせてよい）:

- `resolveCurrentFile(logicalIdDir) → join(dir, 'current', 'snapshot.yml')`
- `resolveHistoryDir(logicalIdDir) → join(dir, 'history')`
- `ensureSnapshotLayout(logicalIdDir)` — `mkdir` current / history
- skip 比較・`readLatestSnapshotMeta` は current ファイルを見る

`readLatestSnapshot` の擬似フロー:

1. `current/snapshot.yml` を読む
2. 無ければ旧レイアウト: `listSnapshotFilenames(logicalIdDir)[0]`（`<logicalId>/ir-snapshot-*.yml`）
3. それも無ければ `null`

旧ファイルの **自動移動はしない**（YAGNI。読みフォールバックで足りる）。次の成功した `writeSnapshot` から新レイアウトに書き始める。旧ファイルは残るが prune 対象から外れる（history に入っていないため）。必要なら後で手動整理か、別タスクで migrate。

HTTP:

- `POST /api/ir/snapshot` の body / 201 / 200 skip は変えない
- `GET /api/ir/snapshot` は current（または旧 latest）を返す。契約文面の「最新」を「編集中コピー」に言い換える

クライアント:

- `attachIrAutoSave` はそのまま（POST 先を変えない）
- `+layout.server.ts` はそのまま（`readLatestSnapshotIfEnabled`）
- Export の `exportFromLatestSnapshot` も current を読む（名前は後で `exportFromCurrentSnapshot` に直してもよいが Phase 1 必須ではない）

テスト (`ir-snapshot-io.spec.ts`) の期待を新パスへ:

- 書込後の実体は `join(tempDir, logicalId, 'current', 'snapshot.yml')`
- prune は `history/` 内の `ir-snapshot-*` 件数
- skip 時は current が 1 ファイルのまま、history も増えない
- コメントのみ変化 → current 上書き + history が 1 件増える
- `readLatestSnapshot` が current を返す

### Phase 2 — 確定版（別タスク）

前提: Phase 1 が通っていること。

- 新 API（案）: `POST /api/ir/snapshot/publish` または `publishSnapshot(logicalId)`
- `versions/<sanitizedVersion>/snapshot.yml` へ current を複製。既存ディレクトリは `EEXIST` で拒否
- ディレクトリ名は `uiDefinition.version` を path-safe にしたもの（`..` と区切り文字を拒否）
- エディタに「確定」ボタン。自動保存では書かない
- GET に `?slot=current|version&version=` を足すのは、過去版ロード UI が必要になってから

未決（Phase 2 で決める。Phase 1 を止めない）:

- 既定 version は `1.0.0`（semver 3 段）。メモは `1.0`（main.sub）。ディレクトリ名をユーザ入力のままにするか、main/sub 自動採番にするか
- 過去版ロード後の main++ / sub++ の分岐 UI
- ダウンロード名 `snapshot-v1.0.yaml`
- `basedOn` / `changeReason` / `releasedAt` / `closedAt`

### Phase 3 — メタと UX（メモのドメインモデル追加）

`UiDefinitionSnapshotMeta` へのフィールド追加は IR 永続化の破壊変更になり得るので、確定フローと一緒かその後。

## Suggested internal write flow (Phase 1)

```text
writeSnapshot(meta, components, comments)
  dir = resolveSnapshotDirForLogicalId(...)
  currentFile = join(dir, 'current', 'snapshot.yml')
  historyDir = join(dir, 'history')
  mkdir currentDir, historyDir (recursive)

  if currentFile exists and content-equal → return skipped

  previousMeta = from currentFile (or old flat latest)
  yaml = serialize(...)

  writeFile(currentFile)          # overwrite
  writeFile(historyDir/timestamp) # wx, retry suffix
  pruneSnapshots(historyDir, maxGenerations)
```

read は `readFile(currentFile)`。ディレクトリを `readFile` しない。

## Files to change (Phase 1)

| ファイル | 変更 |
|---|---|
| `src/lib/server/io/ir-snapshot-io.ts` | パスヘルパ、write を current+history、read を current（旧フォールバック）、`listSnapshotDirectories` は内部用にパス意味を固定。versions 優先ロジックを削除 |
| `src/lib/server/io/ir-snapshot-io.spec.ts` | 上記のパス・prune・skip 期待を更新。current 上書きと history 件数を分けるケースを追加 |
| `src/routes/api/ir/snapshot/+server.ts` | 原則変更なし（コメントの「最新」を current に合わせる程度） |
| `docs/use-cases/ir-snapshot-auto-save.md` | ディレクトリ図・write シーケンス・「最新」の意味 |
| `docs/api/http-endpoints.md` | GET が編集中コピーであること |
| `docs/.memo/snapshot-version-control.md` | 実装後に生きた docs へ移す。メモ自体は履歴 |

触らない（Phase 1）:

- `ir-auto-save.svelte.ts` / layout-editor store
- `ui-definition-meta.ts` の version 型
- 確定ボタン UI
- `+server.ts` の POST 契約
- `package.json` 等の config

## Alternatives considered

| 案 | 採否 | 理由 |
|---|---|---|
| current にも timestamp ファイルを置く | 不採用 | 「最新」判定が残り、今の一次元列と同じ複雑さ |
| 汎用 recursive walk | 不採用 | 深さ 2・役割固定。`readdir({ withFileTypes: true })` を 2 回 |
| writeSnapshot に `slot: 'current' \| 'version'` | 不採用 | 自動保存と確定は変更理由が違う。API を分けた方がよい |
| 初回 write で旧ファイルを history へ移動 | 延期 | 読みフォールバックで足りる。移動失敗が保存を止める |
| Phase 1 から versions を読む | 不採用 | エディタが確定版を開いて上書きする事故になる |

## Open questions (do not block Phase 1)

1. 既存 flat ファイルを、初回 write 時に history へ移すか（推奨は移さない）
2. Phase 2 の version ディレクトリ名（自由文字列 vs main.sub 自動採番）
3. `exportFromLatestSnapshot` のリネーム時期

## Implementation order (to avoid another stuck state)

1. `readLatestSnapshot` を **旧挙動に戻す**（または current ファイル + 旧フォールバックだけにする）。この時点でテストとエディタが再び動く
2. パス定数と `resolveCurrentFile` / `resolveHistoryDir` を足す
3. `writeSnapshot` を current 上書き + history 追加へ切り替え
4. spec を新パスへ更新して通す
5. docs を更新する

2 の前に 3 だけやると、また読み書きが割れる。

---

## Use case × directory × editor state（確認用・Phase 2 含む）

編集対象は **常にメモリ上の IR + `current/`**。`versions/` は確定済みの immutable な正本で、エディタの「今いる場所」にはならない。過去版を開くとは、その YAML を `current` へコピーしてから編集を続けること。

### 用語

| 名前 | 実体 |
|---|---|
| メモリ IR | `UIDefinition`（logicalId / name / description / version / components / external）+ 運用コメント |
| `current` | `<logicalId>/current/snapshot.yml`。作業コピー。常に高々 1 ファイル |
| `history` | 自動保存の世代。prune 対象。エディタの読込元にはしない |
| `versions/<main.sub>` | 確定版。上書きしない |
| HEAD | `versions/` のうち **main が最大** の版（同 main なら sub 最大）。いまの「最新確定版」 |
| `basedOn` | 今回の作業コピーがどの確定版から来たか（未確定の新規は無し） |

### 編集 state（エディタ側）

ディスクの `versions/` の有無と、メモリが何から来たかを分けて持つ。

| state | いつ | メモリ IR の由来 | `current` | `versions` | HEAD |
|---|---|---|---|---|---|
| `nil` | その logicalId の作業がまだ無い | 空 / デフォルト | 無い | 無い | 無し |
| `editing-unpublished` | 一度も確定していない | `current`（または新規入力） | 有る（編集の都度更新） | 無い | 無し |
| `editing-on-head` | 確定済みの系譜を続けて編集 | `current`（HEAD から分岐した作業） | 有る。内容は HEAD と一致しないことがある | 1 件以上 | 有る |
| `editing-from-past` | 過去の確定版を読み込んだあと | 読込した `versions/<main.sub>` を `current` に載せたもの | 上書き済み | 変わらない | 読込元とは限らない（古い main のことがある） |

メモの state 図との対応: `nil` = 未作成、`cur` = 上表の editing-* 全部、`v_old` / `v_new` は **ディスク上の確定版** でありエディタ mode ではない。

### ユースケース対応

凡例: `R` 読込 / `W` 上書き / `A` 追加 / `—` 触らない / `copy` 複製（先は immutable）

#### Phase 1（自動保存のみ）

| ID | ユースケース | 前 state | 後 state | メモリ | current | history | versions |
|---|---|---|---|---|---|---|---|
| P1-1 | 完全新規作成（初回 auto-save） | `nil` | `editing-unpublished` | ユーザ入力 | 新規 W | 同じ内容を A | — |
| P1-2 | 編集の都度 auto-save | `editing-*` | 同じ | 既にメモリにある | W | A → prune | — |
| P1-3 | 未確定のまま再オープン | `editing-unpublished` | 同じ | **current を R** | R | — | — |
| P1-4 | 確定後の作業コピーを再オープン（Phase 2 後も同じ読込） | `editing-on-head` | 同じ | **current を R**（HEAD ではない） | R | — | — |

Phase 1 の「最新」は常に current。history / versions は開かない。

#### Phase 2（確定・過去版）

| ID | ユースケース | 前 state | 後 state | メモリ | current | history | versions |
|---|---|---|---|---|---|---|---|
| P2-1 | 現在版を初めて確定 | `editing-unpublished` | `editing-on-head` | そのまま | —（コピー元。消さない） | — | `1.0` を copy 新規。HEAD=1.0 |
| P2-2 | 過去版を読む（sub は各 main の最新だけ選べる） | `editing-*` | `editing-from-past` | 選んだ確定版で **置き換え** | 確定版を W。`basedOn` を記録 | **全クリアしてリセット** | R のみ。書き換えない |
| P2-3 | 過去版を編集（auto-save） | `editing-from-past` | 同じ | ユーザ編集 | W | A → prune | — |
| P2-4 | 過去版を **最新（正本）として確定** | `editing-from-past` | `editing-on-head` | そのまま | — | — | `<(旧HEADの main)+1>.0` を copy。旧 HEAD はファイルとして残す（系譜廃止は meta の closedAt 等。削除しない） |
| P2-5 | 過去版を **パッチとして確定**（最新にはしない） | `editing-from-past` | `editing-from-past`（HEAD は変わらない） | そのまま | — | — | `<読込元 main>.<(その main の最新 sub)+1>` を copy。HEAD は元のまま |

メモ本文の番号: P2-4 = 「正本として最新」、P2-5 = 「修正パッチ」。mermaid 注釈の 1/2 はこれと入れ替わっているが、**本文の番号に合わせる**。

#### ディスクにだけある操作（ユーザが直接編集しない）

| 対象 | ユーザ操作 | システム |
|---|---|---|
| history 個別ファイル | 無し（復元 UI はメモに無い） | auto-save の A と prune のみ |
| versions 配下の YAML | 読込と copy による新規ディレクトリ作成のみ | 既存ディレクトリは上書き禁止 |

### 具体例（main.sub）

初期: 何も無い → P1-1 で current + history。state = `editing-unpublished`。

初めて確定 P2-1:

```text
current/snapshot.yml          # 作業中（1.0 と同じ内容）
history/ir-snapshot-….yml
versions/1.0/snapshot.yml     # HEAD
```

その後 current を編集（P1-2）: versions/1.0 は変わらない。state = `editing-on-head`（current ≠ HEAD になり得る）。

1.0 を読んで 2.0 系が既に HEAD のとき、1.0（main=1 の最新 sub が 1.0 なら選択可）を P2-2:

```text
current/          ← versions/1.0 の内容で置き換え。basedOn=1.0
history/          ← 空（クリア）
versions/1.0/     不变
versions/2.0/     HEAD のまま
```

そこから P2-4（最新化）: `versions/3.0/` が新 HEAD。1.0 も 2.0 も残る。  
そこから P2-5（パッチ）: `versions/1.1/` を追加。HEAD は 2.0 のまま。以降 main=1 の選択は 1.1 のみ（1.0 は選べない）。

### 確認済み（2026-08-31）

確定は 3 系統。version は `<main>.<sub>`（第 3 段は使わない。既定 `1.0`）。

| 系統 | いつ | 採番 |
|---|---|---|
| 通常の改版 | HEAD の続きを新しいバージョンとして確定 | HEAD `v1.0` → `v2.0`、HEAD `v2.3` → `v3.0`（main+1, sub=0） |
| 過去版の修正パッチ | not HEAD を読み、main を維持して確定 | `v1.0` (not HEAD) → `v1.1`、`v2.3` (not HEAD) → `v2.4` |
| 過去版を新たな正本 | not HEAD を読み、旧 HEAD の次の main を新 HEAD にする | `v1.0` (not HEAD, 旧 HEAD が `v2.x`) → `v3.0`。`v2.3` (not HEAD, 旧 HEAD が `v5.x`) → `v6.0` |

P2-2（過去版読込）の訂正: version が破壊的に変わるので **history は全クリアしてリセット**する（退避して残さない）。将来 undo/redo と接続する前提。`basedOn` に選択元の過去版を記録する。`createdAt` / `modifiedAt` は対象の `snapshot.yml` のファイルシステム上のライフサイクルに合わせて更新する。

その他:

- Export は current から
- history 復元 UI は今は作らない（manual restore の資産。nice to have）
- 旧 flat ファイルの自動移動はしない（read フォールバックのみ）

