# IR snapshot YAML: 運用コメント（キーパス + commentBefore）

Date: 2026-08-24 21:37

## Problem / goal

- snapshot YAML を人間が読む／運用引き継ぎするときに、キー直前へ任意コメントを残したい。
- 対象は **UIDefinition meta / components / external meta / external components / form document（importBase）** の各キー。
- コメントは IR の意味には入れない（Export 成果物や `Component` 型を汚さない）。
- 永続化先は YAML の `#`（eemeli/yaml の `Pair.commentBefore`）。既に Document 経路はあるが、読込は `parse()` のためコメントが落ちる。
- 入力 UI は Monaco を候補とする。代替ライブラリも比較する。

## Current behavior

- 出力: `createYamlDocument` → `sortMapEntries` → `toString`。`commentBefore` フックはあるが未使用（`yaml-document.spec.ts` の将来テストのみ）。
- 入力: `parseYaml` = `yaml.parse`（AST 破棄）。`deserializeIrSnapshot` はプレーン object のみ。
- 自動保存: クライアント `buildSaveHash` とサーバ `normalizeSnapshotForCompare` は uiDefinition + components のみ。コメント変更では skip される。
- Property UI はメタアコーディオン + 属性表。`external` / `importBase` は画面上で編集していない（opaque residual）。
- `components[].id` は snapshot から除去し、読込時に再採番する。コメントの同一性キーに内部 `id` は使えない。

## Proposed approach

### 1. 永続化モデル: YAML コメントが SSOT、メモリはパスマップ

YAML ファイルには `comments:` キーを **置かない**。キー直前の `#` だけがディスク上の SSOT。

メモリ / HTTP はパス → 本文のマップ:

```ts
type YamlCommentMap = Record<YamlKeyPath, string>;
```

空文字・空白のみは「コメントなし」とみなし、出力しない（orphan `#` を増やさない）。

例（出力）:

```yaml
version: 1
savedAt: '2026-08-24T12:00:00.000Z'
uiDefinition:
  # ディレクトリ名になる画面 ID。コピー時は別名にする
  logicalId: userRegistration
  # 顧客向け表示名
  name: ユーザー登録
  description: ''
  version: 1.0.0
  createdAt: '2026-08-07T10:00:00.000Z'
  modifiedAt: '2026-08-24T12:00:00.000Z'
  external:
    im-forma:
      # Export merge の原文。手編集しない
      importBase:
        header:
          # Forma 画面タイトル（ja）
          label_name:
            ja: ユーザー登録
components:
  - # ログイン ID 入力。英数字のみ
    logicalId: userId
    type: textbox
    label: ユーザーID
    external:
      im-forma:
        # 原文 item との突き合わせキー
        item_id: abcdefghijkl
```

`commentBefore` は Pair（キー）に付ける。配列要素そのものへのコメントは、その mapping の **最初の Pair** の `commentBefore` か、YAML Sequence item の `commentBefore` に載せる（実装で一方に固定する）。

### 2. パス言語（マップのキー）

JSON Pointer ではなく、YAML キーを辿る短い表現にする（ユーザー指定の「yamlキーのパス表現」）。

| 規則 | 例 |
|---|---|
| ルートからのドット区切り | `uiDefinition.logicalId` |
| 非 identifier キーはブラケット | `uiDefinition.external['im-forma'].importBase` |
| 配列は index | `components[0].label` |
| ネスト | `components[2].validation.required` |
| form document | `uiDefinition.external['im-forma'].importBase.header.label_name` |

パース規則（案）:

- セグメント: `Ident` / `'quoted'` / `[n]`
- `Ident` = `[A-Za-z_][A-Za-z0-9_]*`
- ハイフン付きキー（`im-forma`, `item_id` は identifier 可。`im-forma` はハイフンがあるので **必ずブラケット**）
- エスケープ: `'` 内の `''` → `'`

**配列 index はディスク上の位置**。エディタ内の安定キーは別層にする（次節）。HTTP の `comments` も **serialize 直前の YAML パス** で送る（サーバは Document に載せるだけ）。

対象スコープ（コメント可）:

| 領域 | パス接頭辞 | 備考 |
|---|---|---|
| UIDefinition meta | `uiDefinition.*`（`external` 以外の直下キー） | `logicalId` / `name` / `description` / `version`。`createdAt` / `modifiedAt` はシステムメタなので **初期は対象外**（運用コメントの価値が低い） |
| components | `components[i].<irKey>` | preferred keys と同じ IR フィールド。`id` は YAML に無いので不可 |
| external meta | `uiDefinition.external['<targetId>'].*` | `importBase` 以外の residual（`sourceStem` 等） |
| external components | `components[i].external['<targetId>'].*` | `item_id` / `item` 等 |
| form document | `uiDefinition.external['<targetId>'].importBase.**` | 深いネスト。UI はツリー + 検索 |

エンベロープ `version` / `savedAt` は対象外（システム）。

未知パス（手編集 YAML のコメント）は extract してマップに残し、同じパスのキーが再出力されれば再添付する（preserve unknown）。キーが消えたコメントは drop（orphan 専用ストアは作らない）。

### 3. エディタ内の安定バインディング（index の脆さ）

`components[0]` は並べ替え・挿入・削除でずれる。YAML へ書く瞬間だけ index パスに解決する。

メモリ上:

```ts
type CommentOwner =
  | { kind: 'meta'; path: string }           // uiDefinition.logicalId など
  | { kind: 'component'; id: string; path: string }  // id はエディタ内部。YAML には出ない
  | { kind: 'external'; yamlPath: string };  // residual / importBase は構造パスのまま
```

- Property のセルは `component.id` + 相対パス（`label`, `validation.required`）でコメントを持つ。
- serialize: 現在の `components[]` 順で `components[i].…` に写像。
- deserialize: YAML index → `restoreSnapshotComponents` 後の **同じ index の新 id** へ割り当て。
- `logicalId` 変更はパスに使わない（空や重複があり得る）。内部 `id` のみ。
- 行削除: その `id` のコメントを捨てる。
- DnD 並べ替え: owner が `id` なのでコメントは行に付いて動く。

`logicalId` 未設定の新規行も内部 `id` があるのでコメント可能。

### 4. snapshot read / write

#### Write

```text
UIDefinition + CommentIndex
  → createIrSnapshot（現行どおりプレーン object）
  → createYamlDocument（キーソート）
  → attachYamlComments(doc, yamlPathMap)   // visit Pair / Seq item
  → toString({ lineWidth: 0 })
```

`attachYamlComments` はパスを辿ってノードを探し、`pair.commentBefore = text`（先頭スペースは eemeli の慣習に合わせる。既存テストは `' snapshot'` → `# snapshot`）。

複数行は `\n` 区切り。出力は各行 `# …`。

#### Read

```text
yamlText
  → parseDocument（parse() は使わない）
  → extractYamlComments(doc) → YamlCommentMap（index パス）
  → doc.toJS() → parseIrSnapshot
  → restoreSnapshotComponents
  → rebind comments: components[i] → 新 id
```

`deserializeIrSnapshot` の戻りを広げないなら、IO 層で:

```ts
type LoadedSnapshot = {
  snapshot: IrSnapshot;
  comments: YamlCommentMap;
};
```

`parseYaml`（JS 値だけ）は application.yml 等用に残す。snapshot 専用 API を `yaml-document.ts` に足す:

- `parseYamlDocument(text): Document`
- `extractYamlComments(doc): YamlCommentMap`
- `attachYamlComments(doc, map): void`

パス解決と snapshot キー集合の知識は `src/lib/ir/snapshot-comments.ts`（YAML 非依存のパス parse + owner 変換）。AST visit は `src/lib/utils/yaml-comments.ts`。コメント本文の意味は IR に入れない。

#### Skip 判定 / auto-save

コメントも世代の一部。

- クライアント `buildSaveHash`: `comments` を含める。
- サーバ `isSameAsLatestSnapshot`: 最新 YAML から extract したマップと、今回 attach 予定のマップを正規化比較（パスソート、trim、空削除）。
- POST body:

```json
{
  "uiDefinition": {},
  "components": [],
  "comments": {
    "uiDefinition.logicalId": "ディレクトリ名になる画面 ID",
    "components[0].label": "顧客向け表示名"
  }
}
```

GET は JSON なので `#` を返せない。同じく `comments` マップを同梱する。`UiDefinitionMetaAccordion` の restore と `loadSnapshot` が comments を受け取る。

`normalizeSnapshotForCompare` は IR 比較用のままにし、コメント比較は別関数 `normalizeCommentsForCompare` にする（IR と注釈で変更理由が違う）。

#### 手編集との共存

自動保存は毎回 JS → 新規 Document。キーに載らない **文書先頭コメント / キー間の空行の意味** は落ちる。運用コメントは Pair の `commentBefore` のみ保証する、と割り切る（現状の rebuild モデルと一致）。

### 5. UI / UX

Property 表は既に dense。セル内に Monaco を並べない（バンドル・フォーカス・矢印ナビが壊れる）。

#### 推奨インタラクション（共通）

1. 各コメント対象フィールドのラベル横に小さなコメントボタン（未記入: outline、記入済: 塗り + 件数/有無）。
2. クリックで **画面内シングルインスタンス** のエディタを開く（Drawer 右、または Modal）。
3. ヘッダにパスを表示（`components[2].validation.pattern`）。コピー可能。
4. フォーカス中フィールドでショートカット（案: `Alt+/`）で同じエディタを開く。`arrowNavigation` と衝突しないキーにする。
5. debounce 後に既存 auto-save へ乗る（コメント変更も hash 対象）。

#### 画面別

| 場所 | 付け方 |
|---|---|
| `UiDefinitionMetaAccordion` | 各 `Label` 横。パス `uiDefinition.logicalId` 等 |
| `ComponentAttributeTable` Basic | `logicalId` / `label` / `hint` の Input 横。type は Badge 横でも可 |
| required / readonly / disabled | Toggle ラベル相当が無いのでセル右上にアイコンのみ |
| `ComponentDetailsCell` / `ComponentValidationCell` | 既存 `fieldLabelClass` の右 |
| external / form document | Property 表には出さない。別パネル |

#### form document / external（必須だが別 UI）

`importBase` はキーが多い。属性表へ列を増やさない。

案: Property のメタアコーディオンの下、または「Comments」タブ相当の Accordion「運用コメント（external）」:

- 左: キーツリー（targetId → importBase 階層 / コンポーネント logicalId → item residual）
- 右: 選択ノードのコメントエディタ
- フィルタ（パス部分一致）
- コメント付きノードだけ表示トグル

コンポーネント行から「この行の external コメント」でツリーをその `components[i].external` にスクロール。

#### Monaco の使い方（採用する場合）

- **1 インスタンス**を Drawer にマウント。フィールドごとに dispose/create しない。
- language: `plaintext` または `markdown`（YAML コメント本文は `#` を含めない。serialize 側が付ける）。
- モデルは `setValue` で差し替え。パスが変わったらモデル切替。
- テーマは Flowbite dark に追従。
- 高さ: 8〜16 行相当。全画面 YAML エディタにはしない（snapshot 全体編集は auto-save rebuild と衝突する）。

Monaco で **snapshot YAML を直接編集**する案は初期対象外。コメント以外のキー順・値を壊し、skip 判定と二重 SSOT になる。

### 6. ライブラリ

#### YAML（確定）

既存 `yaml@^2.9.0`（eemeli）。`visit` + `Pair.commentBefore`。追加の YAML ライブラリは不要。`js-yaml` はコメント出力不可のまま application.yml 用。

#### コメント入力

| ライブラリ | 向き | サイズ感 | 本案件での評価 |
|---|---|---|---|
| **Flowbite `Textarea`** | 数行の運用メモ | 既存依存のみ | **MVP 推奨**。表の UX と一致。承認が早い |
| **CodeMirror 6** (`@codemirror/view` + `lang-markdown` or plaintext) | 埋め込みエディタ | Monaco より小さい | 行番号・折り返し・ダークが必要なら次点。Svelte とは相性が良い |
| **Monaco** (`monaco-editor`) | IDE 級 | 数 MB + worker | ユーザー想定。**Drawer 1 基なら妥当**。セル埋め込みは不可 |
| monaco-yaml | YAML 言語サーバ | さらに重い | snapshot 全体編集用。本要件（コメント本文）には過剰 |
| TinyMCE / Quill / Milkdown | リッチテキスト | 中〜大 | YAML `#` に HTML が混ざる。不採用 |

Monaco を使う場合の実装メモ（SvelteKit + Vite）:

- `monaco-editor` は Web Worker 必須。`vite-plugin-monaco-editor` または公式の worker 設定。
- `package.json` 追加はユーザー承認が必要（ecosystem ルール）。
- SSR: `onMount` でのみ `import('monaco-editor')`。
- ラッパを自前で薄く書く（メンテの薄い `svelte-monaco*` に依存しない）。

**おすすめの切り分け**

1. **本文入力の第一選択は Textarea**（運用コメントは数行日本語が主）。Monaco は「パスツリー + 長文」の external/importBase パネルだけに遅延ロード。
2. 全体を Monaco に揃えるなら、最初から Drawer 1 基で meta/components も同じエディタに載せる（学習コストは下がるが初期コストは上がる）。
3. CodeMirror 6 は「Monaco ほど重くしたくないが Textarea では足りない」ときの中間。Markdown プレビューが要らないなら Textarea で足りる。

### 7. モジュール配置

| モジュール | 責務 |
|---|---|
| `src/lib/ir/snapshot-comments.ts` | パス parse/stringify、owner ↔ YAML パス、空コメント正規化 |
| `src/lib/utils/yaml-comments.ts` | Document visit、extract / attach |
| `src/lib/ir/snapshot.ts` | serialize が comments を受け取れるようにする。deserialize は IO が Document を使う |
| `src/lib/server/io/ir-snapshot-io.ts` | 読込で comments 返却、書込で attach、skip に comments を含める |
| `src/routes/api/ir/snapshot/+server.ts` | GET/POST に `comments` |
| `src/lib/store/layout-editor/` | `UIDefinition` に混ぜず、`snapshot-comments.svelte.ts` + Context。auto-save が読む |
| `src/lib/components/FieldCommentButton.svelte` | アイコン + 開閉 |
| `src/lib/components/YamlCommentEditor.svelte` | Textarea または Monaco の差し替え口 |
| `src/lib/components/ExternalCommentTree.svelte` | importBase / residual ツリー（後半） |

`UIDefinition` / `Component` に `comment` フィールドを足さない。Export / transform は無変更。

### 8. 実装フェーズ（YAGNI）

| Phase | 内容 |
|---|---|
| 1 | パス言語 + extract/attach + IO/API + skip。メタ + Basic 列（logicalId/label/hint + toggles）を Textarea Drawer |
| 2 | Details / Validation の表示中スロットキー |
| 3 | external + importBase ツリー。ここで Monaco を足すなら遅延ロード |
| 4 | ショートカット、コメント付きフィルタ、手編集 unknown パスの警告 |

Phase 1 だけで YAML round-trip と自動保存が閉じる。

## Alternatives considered

| 案 | 採用しない理由 |
|---|---|
| IR / Raw に `comments` オブジェクトをネスト | SSOT 汚染。Export に漏れる。YAML の「キー直前」にならない |
| サイドカー `comments.yml` | 世代ファイルと対が壊れる。運用者が snapshot だけ見てもコメントが無い |
| JSON Pointer (`/components/0/label`) | 可だが読みにくい。ユーザー指定は YAML キーパス |
| `components[logicalId=userId].label` をディスクキーにする | logicalId 空・重複で壊れる。index + 内部 id 再バインドの方が snapshot の実形に近い |
| Monaco で YAML 全文編集 | auto-save の JS rebuild と二重 SSOT。キーソート・id 除去と衝突 |
| 全セルに Monaco | 性能・矢印キー・viewport スクロールを壊す |

## Key decisions (proposal)

1. ディスクは `#` / `commentBefore` のみ。HTTP とメモリはパスマップ。
2. ディスクパスは index 付き YAML パス。エディタは component 内部 `id` で保持し、读写で変換。
3. コメントは IR 外（snapshot 注釈）。Export 対象外。
4. 入力は Drawer 1 基。MVP は Textarea。Monaco は任意・遅延・主に form document。
5. コメント変更は新しい snapshot 世代を作る（skip に含める）。

## Open questions

1. メタの `createdAt` / `modifiedAt` / エンベロープ `savedAt` にもコメントを許すか（提案は不可）。
2. 配列要素コメントを「最初のキーの commentBefore」にまとめるか、Sequence item の commentBefore にするか。
3. コメント本文を Markdown として扱うか（プレビューが要るなら CodeMirror/Monaco、不要なら plaintext）。
4. Phase 1 から Monaco を入れるか、Textarea で閉じるか。
5. importBase のコメントを Forma Export JSON に載せるか（JSON にコメントは無い。**載せない**が整合的）。

## Files to change (when implementing)

| Path | Action |
|---|---|
| `src/lib/ir/snapshot-comments.ts` | 新規。パスと owner 変換 |
| `src/lib/ir/snapshot-comments.spec.ts` | 新規 |
| `src/lib/utils/yaml-comments.ts` | 新規。extract/attach |
| `src/lib/utils/yaml-comments.spec.ts` | 新規。ゴールデン YAML |
| `src/lib/ir/snapshot.ts` | serialize が comments を受け取れるように |
| `src/lib/server/io/ir-snapshot-io.ts` | Document 読込、skip に comments |
| `src/lib/store/layout-editor/ir-auto-save.svelte.ts` | hash / POST に comments |
| `src/lib/store/layout-editor/snapshot-comments.svelte.ts` | 新規 Context |
| `src/lib/store/layout-editor/layout-editor.svelte.ts` | `loadSnapshot` が comments を受け取れるよう呼び出し側を拡張（クラス自体には持たせない） |
| `src/routes/api/ir/snapshot/+server.ts` | GET/POST `comments` |
| `src/lib/components/*` | ボタン + Drawer。対象セル |
| `docs/use-cases/ir-snapshot-auto-save.md` | コメント契約・compare |
| `docs/use-cases/layout-editor.md` | Property のコメント UX |
| `package.json` | Monaco 採用時のみ。承認後 |

変更しない（初期）:

- Export / Reader / Writer / transform
- `application.yml` の js-yaml
- IR element 型への comment フィールド
