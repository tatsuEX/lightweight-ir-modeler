# 運用コメント autoSave debounce の分離

Date: 2026-08-28 07:54

## Problem / goal

Property / Layout の編集と、運用コメント（Monaco Markdown）の編集が **同じ `ir.autoSave.delay`** だと、設定値によってどちらかが犠牲になる。

- `delay` を短くする（例: 500ms）→ Property は軽いが、コメント確定が続くと YAML シリアライズ＋世代ファイル書き込みが頻繁になる
- `delay` を長くする → コメント側は楽だが、Property / Layout の自動保存が鈍い

コメント側だけ **`delay` に 1000〜2000ms を足した待ち** にしたい。snapshot は 1 ファイル（IR + コメント）のまま。

## 現状（実装位置）

debounce は **サーバ IO には無い**。クライアントの `$effect` が止まってから `POST /api/ir/snapshot` する。

| 層 | 役割 | delay を持つか |
|---|---|---|
| `attachIrAutoSave` | 1 本の `debounce(options.delay)` で payload 送信 | **ここだけ** |
| `POST /api/ir/snapshot` / `writeSnapshot` | 届いた内容を即比較・書込 | 持たない |
| `ir-snapshot-file.ts` | 任意パスからの復元 | 無関係 |
| `MonacoMarkdownEditor` | キー入力のたびに bindable `value` を更新 | 持たない |
| `SnapshotComments` | `#editor.draft` は下書き。`#map` に載るのは確定時 | 下書きは autoSave 対象外 |

確定して `#map` が変わるタイミング:

1. モーダルの **保存**（`commitEditor`）
2. 左ツリー切替（`selectEditor` が直前の draft を `#map` へ書く）

キー入力そのものは snapshot を走らせない。遅延分離の効果が出るのは **コメント map が変わったあと**。

## Proposed approach

### 1. 設定: extra（既定 1500）

`delay` は Property / Layout（IR メタ + components）用のまま。  
コメント **だけ** が変わったときは `delay + commentDelayExtra`。

```yaml
ir:
  autoSave:
    enabled: true
    delay: 500
    commentDelayExtra: 1500   # 省略時 1500。0 なら IR と同じ
    dir: ./data/ir
    maxGenerations: 10
```

実効待ち:

| 変化 | 待ち |
|---|---|
| IR（meta / components）が変わる | `delay` |
| コメント map だけ | `delay + commentDelayExtra`（既定 500+1500=2000ms） |
| 両方 | `delay`（短い方。payload に最新コメントを載せる） |

- extra の既定 **1500**（依頼の 1000〜2000 の中央）
- パース: 整数かつ `>= 0`。未指定は 1500。負はエラー
- 1000〜2000 をスキーマで強制しない（運用で extra=0 も可）

キー名は **加算** が分かる `commentDelayExtra` を推奨。絶対 ms の `commentDelay` は、`delay` より短くできて意味が曖昧になるので採らない。

### 2. クライアント: 変化種別で debounce を分ける

`attachIrAutoSave` で hash を 2 本にする。

- `irHash` — meta + components
- `commentsHash` — `toYamlMap(...)`

既存の `debounce()` を 2 本（`delay` と `delay + extra`）。本体の `POST` は今と同じ 1 関数。

```
IR 変化     → comment 側 timer を cancel → delay 後に保存
コメントのみ → IR 側 timer を cancel（IR 未変化なら no-op）→ delay+extra 後に保存
```

直近の成功保存の hash と比べる（effect の前回値ではない）。  
IR 変化が残っている間にコメントが確定しても、IR 分岐のまま短い delay で両方載せる。

`$effect` の cleanup では両方 `cancel()`（unmount 時に POST しない、現行と同じ）。

### 3. 下書きは autoSave しない（現行維持）

`#editor.draft` を payload に含めない。キャンセルは今どおり map を触らない。

ツリー切替で直前 draft が `#map` に載ったときはコメント変化なので **長い delay**。入力中のノード hop が短い delay で世代を増やしにくい。

Monaco / モーダルに debounce は置かない（表示は即時、保存遅延は store 側）。

### 4. サーバ IO / YAML loader は触らない

`writeSnapshot` の skip 比較は既に IR + comments。delay をサーバに移すと「誰が待つか」が二重になる。

`application-config.ts`（load ファサード）と `application-config-yaml.ts`（deep merge）もキー追加だけでは変更不要。パースは `application-config-parse.ts`。

## Alternatives considered

| 案 | 採用しない理由 |
|---|---|
| Monaco / `setEditorDraft` を debounce | 入力遅延に見える。YAML 負荷は `#map` 更新後の POST |
| 下書きをライブ保存 | **キャンセル** と衝突。別プロダクト判断 |
| サーバで sleep | クライアントが連打するとキューが溜まる。責務がずれる |
| `commentDelay` を絶対 ms | `delay` との大小が不明。依頼は「delay に加算」 |
| extra をコード定数のみ | YAML で delay を触る運用と揃わない。既定 1500 + 上書き可能が小さい |
| コメント専用 YAML | snapshot は 1 ファイルが SSOT 運用。変更理由が別でもファイルを分けない |

## 変更対象

実装時。提案段階ではコードを変えない。

| ファイル | 内容 |
|---|---|
| `src/lib/config/application-types.ts` | `IrAutoSaveConfig.commentDelayExtra` |
| `src/lib/server/config/application-config-parse.ts` | 既定 1500、整数 `>= 0` |
| `src/lib/server/config/application-config.spec.ts` | 既定・上書き・不正値 |
| `config/application-dev.yml` | `commentDelayExtra: 1500` とコメント |
| `src/routes/layout-editor/+layout.server.ts` | クライアントへ extra を渡す |
| `src/lib/store/layout-editor/ir-auto-save.svelte.ts` | hash 分離、debounce 2 本、合流 |
| `docs/use-cases/ir-snapshot-auto-save.md` | 設定とシーケンス |
| `docs/architecture/overview.md` | `ir.autoSave.*` の一言があれば追記 |

**変更しない（この案）**

- `MonacoMarkdownEditor.svelte` / `MarkdownCommentModal.svelte`
- `ir-snapshot-io.ts` / `ir-snapshot-file.ts`
- `application-config.ts` / `application-config-yaml.ts`
- ベース `config/application.yml`（`ir.autoSave` は dev overlay 側）

テスト: parse spec 必須。`attachIrAutoSave` に単体が無ければ、debounce 2 本の分岐は実装後の手動確認でも MVP として足りる（コンポーネント `$effect` を vitest するコストが高い）。必要なら hash 分岐だけ純関数に切り出してテストする。

## Open questions

1. extra 既定は **1500** でよいか（1000 / 2000 にするか）
2. キー名 `commentDelayExtra` でよいか
3. 下書きライブ保存は **しない** でよいか（するならキャンセル意味の再定義が先）
