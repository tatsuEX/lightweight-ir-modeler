# Rules 見直し: out-of-scope と adapter plugin

- Date: 2026-09-01 07:20 (+09:00)
- Status: proposal (rules 未適用)
- Related: `.cursor/rules/03-out-of-scope.mdc`, `.cursor/rules/01-design-principles.mdc`, `.cursor/rules/02-architecture-boundaries.mdc`

## Problem / goal

初期実装向けの凍結リスト（`03-out-of-scope.mdc`）が、Import / Export が複数 target で動いている現状と食い違っている。  
特に **Plugin framework** は全面禁止のままなので、第 3 target を足すたびに registry を横断して手書きする状態が続く。

ゴール:

1. 「初期実装が終わるまで全部禁止」から、**生きたスコープ方針**へ置き換える
2. プラグインは **フレームワークではなく、first-party の adapter 契約** として視野に入れる
3. YAGNI / KISS は維持する（ランタイムローダ・event bus・第三者 SDK はまだ禁止）

## Current evidence

Core import/export は実装済み（`primefaces` / `im-forma`）。拡張点は既に複数ある:

| 登録場所 | 役割 |
|---|---|
| `server/ui/import-target-registry.ts` | Reader + transform |
| `server/ui/export-target-registry.ts` | transform + Writer |
| `store/layout-editor/ui-import-client.ts` | UI 選択肢・受付拡張子 |
| `store/layout-editor/ui-export-client.ts` | HTTP クライアント |
| `schema/json-schema-loader.ts` の `RAW_SCHEMA_FILENAMES` | Raw JSON Schema ホワイトリスト |
| `config/application.yml` の templates dir | Handlebars 等（target ごと） |

新しい adapter を足す = 上記を横断して同じ `targetId` を書く。これが「同じ技術的アイデアが 3 箇所以上」に該当する。

Preview の type → Svelte マップは **別の変更理由**（IR 要素種、ベンダー adapter ではない）なので、最初の plugin 単位にしない。

## Out-of-scope 項目の判定

| 現行項目 | 判定 | 理由 |
|---|---|---|
| Plugin framework | **再定義して視野に入れる** | 禁止すべきは framework。既存 registry の契約化は今の痛み |
| Event bus | **据え置き** | Context / 直接呼び出し / Toast store で足りている |
| Domain validation engine | **engine のみ据え置き** | 境界の Raw Zod は実装済み。IR 横断エンジンは尚早。局所チェックは許可 |
| Undo/Redo system | **据え置き** | `current` / `history` / `versions` が代替。専用スタックは未要求 |
| Version migration system | **用語を分離して据え置き** | 製品版（`versions/`）は実装済み。IR スキーマ移行エンジンは別物 |
| Complex service layer | **文言を明確化して据え置き** | パイプラインモジュールは既存。汎用 application-service 枠は不要 |

## Proposed plugin meaning

このリポジトリにおける plugin の最初の単位は **UI adapter target**（`targetId`）。

含めてよい:

- Reader / unshape / parse
- Writer / shape / merge / serialize
- Transformer（Raw ⇄ IR）
- Raw JSON Schema
- クライアント registry（ラベル・拡張子）
- 任意: テンプレート根（config）
- target 専用 docs

含めない（別変更理由）:

- Preview 要素レンダラ
- ロガー実装
- store / Svelte ウィジェット
- 実行時の npm / ディスクからの動的ロード
- event bus 経由のプラグイン間通信
- サンドボックス / ライフサイクルフレームワーク

登録は **コンパイル時・リポジトリ内**。発見は手書き 1 箇所（または生成されない明示マニフェスト）に限る。

## Proposed rule edits

適用はユーザ承認後。以下は差分案。

### 1. `03-out-of-scope.mdc` — 全面書き換え

タイトルを Initial Implementation 凍結から Scope Policy へ。

要点:

- Core import/export は動いている前提
- Adapter plugin（first-party, compile-time）は設計・最小スライス実装を許可
- 残りは「明示要求まで実装しない」表
- フォールバック文は残す（deferred 項目が必要に見えても局所解）

### 2. 新規 `16-adapter-plugins.mdc`（alwaysApply: true、短く）

エージェントが「プラグイン」と言ったときに読む契約。

- 単位は `targetId` adapter
- Core（`ir/`）は plugin を import しない
- 形式固有は Reader / Writer / Transformer に閉じる（現行 02 と同じ）
- 新しい target は Core docs を膨らませず target docs を足す（現行 12 と同じ）
- ランタイムローダ・第三者 SDK・event bus は禁止
- 既存 2 target から契約を抽出する。先に空の PluginHost を作らない

### 3. `01-design-principles.mdc` — 1 節追加

現行「Do not add extension points for later unless required by an accepted boundary」は残す。  
accepted boundary として adapter plugin を指名する。

### 4. 追随（小さく）

| ファイル | 変更 |
|---|---|
| `02-architecture-boundaries.mdc` | 拡張モデル = adapter plugin。`io/` 表記を `server/io/` に寄せるのは別 PR でも可 |
| `ir-definition.mdc` | migration engine と snapshot 製品版を混同しない |
| `raw-definition.mdc` | 「Later: IR schema validation」を engine 禁止 + 局所チェック可に |
| `docs/README.md` 現状スコープ表 | プラグイン行を「adapter 契約は視野 / framework は対象外」に |

`02` のパス表（`io/` vs `server/io/`、IR クラス階層は今後）は今回の主眼ではないが、ずれている。承認があれば別コミットで同期してよい。

## Alternatives considered

| 案 | 内容 | 不採用理由 |
|---|---|---|
| A. 03 の Plugin 行だけ削除 | 最短 | 「何を作ってよいか」が残らず、framework に走りやすい |
| B. ランタイム plugin まで許可 | npm / 動的 import | 供給網・信頼境界・YAGNI に反する。adapter が 2 つでは早い |
| C. 03 に長い設計を全部書く | ファイル 1 つ | スコープ方針と契約が混ざる。16 を短く切る方がエージェント向き |
| D. 第 3 target が来るまで待つ | 01 の 3 箇所ルール厳格適用 | 既に 5 箇所以上の手書き登録がある。抽出は投機ではなく重複解消 |

推奨: **A ではなく 03 再定義 + 16 新設 + 01 の境界指名**（上記 Proposed）。

## Open questions

1. 最初の実装スライスは「マニフェスト型の抽出」か「新規 target と同時」か（Rules だけでは決めない）
2. クライアント registry をサーバマニフェストから生成するか、二重登録を当面残すか
3. `02` のパス表同期を同じ変更に含めるか

## Key decisions (if accepted)

1. Plugin = first-party adapter target。framework ではない
2. Event bus / Undo / IR migration engine / 汎用 service 枠は引き続き deferred
3. Domain validation は engine だけ deferred。局所チェックは可
4. Snapshot `versions/` は in scope（migration system とは別）
