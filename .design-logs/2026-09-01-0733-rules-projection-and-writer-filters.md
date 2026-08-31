# Rules 再検討: 射影プラグイン / Writer フィルター / 注入

- Date: 2026-09-01 07:33 (+09:00)
- Status: accepted and applied (2026-09-01 07:41)
- Supersedes (for plugin meaning): `.design-logs/2026-09-01-0720-rules-scope-and-adapter-plugins.md`
- Related: `.cursor/rules/03-out-of-scope.mdc`, `01-design-principles.mdc`, `13-api-encapsulation.mdc`

## Problem / goal

07:20 案は plugin を **adapter target 一式**（Reader/Writer/Transformer）に寄せすぎた。  
次に実装を検討したい機能は、target バンドルとは別の拡張単位である:

1. **射影プラグイン** — `components[]` を `logicalId` キーの map などへ変形し、Handlebars / `arcane:summon` から参照しやすくする
2. **external target specified writer プラグイン** — レイアウト既定、external residual からの復元、ドメインからの vendor 情報導出を、フィルターパイプラインとして組む
3. **注入** — 再利用するもの（特に射影）を config / CLI / その他の指定で選べるようにする

07:20 の「コンパイル時登録のみ・PluginHost 禁止・単位は targetId だけ」だと、上記はまだ out-of-scope に見える。Rules を緩めて、これらを **視野に入れる**。実装はこのセッションではしない。

## Current evidence

| 現状 | 痛み |
|---|---|
| summon context は `components` 配列のみ（`scripts/lib/summon.ts`） | テンプレートが logicalId で引けない。`{{#each}}` 前提 |
| Export Handlebars は shape 後の `fields[]` | 同様。lookup 用 view が無い |
| `im-forma-merge.ts` が巨大 | 既定矩形・residual 復元・item_id 導出が 1 関数に同居 |
| PrimeFaces は shape が別モジュール | merge ほどではないが、段はパイプライン化されていない |
| arcane は Export を通らない | 射影を Writer 内に閉じると CLI から再利用できない |

## Revised plugin kinds（閉じた集合）

plugin の単位は「何でもホスト」ではない。**今視野に入れる kind は次の 3 つだけ**:

| Kind | 入力 | 出力 | 所有 | 変更理由 |
|---|---|---|---|---|
| **projection** | 復元済み IR（`uiDefinition` + `components[]`） | テンプレート/下流向け **view**（例: `componentsByLogicalId`） | Core。IR を書き換えない | 配列→参照しやすい形。target 非依存が基本 |
| **writer-filter** | 検証済み Raw + residual +（任意）射影 view | 次段へ渡す payload | Adapter target | 既定値・residual 復元・vendor 導出 |
| **adapter-target** | 既存の Reader/Writer/Transformer 一式 | Import/Export バンドル | Adapter | ベンダー形式の出入り |

Preview レンダラ・ログ・store は kind にしない（変更理由が違う）。

### 射影は IR ではない

- IR の SSOT（Single Source Of Truth）は従来どおり `components[]`
- 射影は読み取り専用 view。結果を snapshot に書き戻さない
- target 袋の flatten（現行 summon の `external` 投影）は、パラメータ付きの射影として扱ってよい（Core が `targetId` を引数に取る。具象 Writer は import しない）

### Writer フィルターは event bus ではない

順序付き `payload → filter → payload`。購読・発火・グローバルバスは作らない。  
`im-forma-merge` を段に分けるのが第一候補。汎用 FilterHost を先に作らない。

## Injection（07:20 からの主な緩和）

再利用プラグイン（特に projection）の **実装** は in-repo の id → 関数マップ（コンパイル時）。  
**どれを・どの順で使うか** は実行時に注入してよい。

許可する注入チャネル（全部を同時実装しなくてよい。最初の利用者が要るチャネルだけ）:

| チャネル | 例 | 備考 |
|---|---|---|
| `application.yml` | `plugins.projections: [by-logical-id]` や target ごとの writer-filter 列 | Export の既定 |
| CLI | `arcane:summon --projection by-logical-id` | テンプレ実験・上書き |
| 呼び出し引数 | API / 関数の optional `projectionIds?` | 13 の optional override。省略時は config 既定 |

「任意の指定方法」は **チャネルを 1 つに凍結しない** という意味。  
**任意のユーザー JS を eval / 動的 import する** ことではない。

まだ禁止:

- リポジトリ外・信頼できないパスからのコードロード
- npm プラグインマーケット / 第三者 SDK
- ライフサイクル付き汎用 PluginHost（init/destroy/sandbox）

注入するのは **id と順序**。実装本体は registry が解決する。  
呼び出し側は `applyProjections(snapshot, ids?)` のように **適用まで 1 API**（13: resolve してから use を強制しない）。ids 省略時は config 既定。

## 07:20 判定の更新

| 項目 | 07:20 | 再検討 |
|---|---|---|
| Plugin framework | adapter 契約のみ許可 | **kind 付き first-party plugin + パイプライン + id 注入を許可**。framework / 非信頼コードは禁止のまま |
| Event bus | 据え置き | **据え置き**。フィルター列はバスではない、と明記 |
| Domain validation engine | engine のみ据え置き | 変更なし |
| Undo/Redo | 据え置き | 変更なし |
| IR schema migration | 据え置き | 変更なし |
| Complex service layer | 文言明確化 | **パイプライン runner は service 枠ではない**（許可）。汎用 application-service は禁止のまま |

## Proposed rule edits（07:20 からの差分）

### `03-out-of-scope.mdc`

「adapter plugin だけ in view」をやめ、上記 3 kind + 注入 + パイプラインを in view にする。  
deferred 表は残す。event bus 行に「ordered filter pipeline はここに入らない」と書く。

### 新規 `16-adapter-plugins.mdc` → 名称を `16-plugins.mdc` に

内容を adapter 専用から、projection / writer-filter / adapter-target の契約ファイルにする。  
ファイル名を `16-plugins.mdc` にする（adapter 以外が主対象になったため）。

### `01-design-principles.mdc`

accepted boundary を「adapter だけ」ではなく「閉じた plugin kinds + id 注入」にする。  
kind を増やすのは 3 箇所ルールを満たしてから。共通 Plugin 基底は 3 実装が同じホストを必要にしてから。

### `13-api-encapsulation.mdc`

追記不要でも可。必要なら「plugin id の解決は apply API の内側」の例を 1 つ。

### `02` / `ir-definition` / docs README

射影は IR を置き換えない、と 1 行。スコープ表を 07:20 より具体的に。

## Alternatives

| 案 | 内容 | 不採用理由 |
|---|---|---|
| 07:20 のまま | target 一式だけ | 射影も writer 段もルール上まだ「framework」に見える |
| 汎用 Plugin インターフェースを先に作る | 全 kind 共通 | 変更理由が違う。YAGNI |
| ユーザー任意 JS ロードまで許可 | `--plugin ./my.js` | 信頼境界・06 供給網。明示要求まで deferred |
| 射影を Writer 内に置く | Export だけ楽 | arcane が使えない。再利用要求と矛盾 |
| 射影結果を IR に書き戻す | snapshot に map を永続化 | SSOT が配列と map で割れる |

## Open questions（Rules では決めない）

1. 最初のスライスは `by-logical-id` 射影 + summon CLI か、im-forma merge のフィルター分割か
2. writer-filter が射影 view を読むか（logicalId lookup が必要なら読む。そのときだけ依存）
3. config キーの置き場所（`app.plugins` vs target 配下）— 実装時に最小で決める
