# UIDefinition 分割・メタ投影・系統の Export 引き回し・Rules

Date: 2026-09-06 23:51

## Goal

1. GUI 用 `$state` と UI 定義ドメイン（`UIDefinition`）を分ける。クラス名 / ファイル名に `IRDefinition` / `ir-definition` は使わない
2. メタの用途別投影は `src/lib/ir/ui-definition-meta.ts` に集約する（クラスへ便宜メソッドを足さない）
3. `basedOn` 等の系統は transform 後の Raw に残り、vendor Writer が成果物へ埋め込める
4. Rules を、命名・短絡的局所変更の抑制・YAGNI と拡張の両立、に合わせて直す

実装は確認後。

## やらないこと

- `Component` 具象クラス階層
- Writer に第 2 引数 `context` を足す（Rule 13: Writer が既に受け取る Raw から導ける）
- 系統を `external['<targetId>']` に入れる（ベンダー残余と混ざる）
- JSON に不正なコメントを足す（im-forma）
- `ui-definitions/v1.0/` への投影の引っ越し（スキーマ版管理は別作業。現行は `ui-definition-meta.ts`）
- 射影プラグイン（`applyProjections`）とメタ DTO 投影を同じ「projection」機構にしない

## メタ投影（`ui-definition-meta.ts`）

既存の `toEditorMeta` / `UiDefinitionSnapshotMeta` は残す。足すのは **名前の付いた投影と、空文字 → キー省略を含む変換関数**。

| 型 | 用途 | 任意項目 | 系統 (`basedOn` 等) |
|---|---|---|---|
| `UiDefinitionLiveMeta`（新規） | GUI / クラス data。bind 向けに空文字可 | 必須キー + `''` 可 | 持つ |
| `UiDefinitionEditorMeta`（既存） | snapshot API・正規化済み DTO | 空ならキー省略 | 持つ |
| `UiDefinitionSnapshotMeta`（既存） | YAML。上記 + `createdAt` / `modifiedAt` | キー省略 | 持つ |
| `UiDefinitionVendorExportMeta`（新規） | transform → Raw → Writer | キー省略 | **載せる**（`logicalId` / `version` / `basedOn` / `changeReason` + 既存の name / description / external） |

ライフサイクル日付（`releasedAt` / `closedAt` / `closedReason`）は snapshot 用のまま。ベンダー成果物の検索キーにはしない（今回の意図は snapshot.yaml との紐づけ）。

関数:

- `toEditorMeta` — 既存。snapshot 日時を剥がし任意キー省略
- `toEditorMetaFromLive(live)` — `buildSaveMeta` のフィールド列挙をここに移す
- `toVendorExportMeta(meta)` — Editor / Snapshot / Live からベンダー向け投影

`UIDefinition` に `toEditorMeta()` は置かない。クラスは live 状態を保持し、投影は meta モジュールが行う。

## 系統の Export 経路

```text
Live / Editor
  → toVendorExportMeta
  → POST /api/ui/export の uiDefinition（いま欠ける basedOn を含める）
  → parseEditorMetaFromRecord（既存。欠けは ''）
  → transformTo*Raw が VendorExport のキーを Raw にコピー
  → JSON Schema（optional basedOn / changeReason を明示）
  → Writer.toArtifact(raw)
       PrimeFaces: shape が form コンテキストへ渡す → form.hbs の HTML コメント
       im-forma: Raw には残す。JSON コメントは方言が無いので埋め込まない
```

Import の `transformFrom*Raw` は `basedOn` をベンダーファイルから復元しない（系統は snapshot 側の知識）。

Writer の `toArtifact(raw)` シグネチャは変えない。`PrimeFacesWriter` が `{ formId, name, fields }` だけテンプレに渡しているのが系統を落とす直接原因。shape / form context に description / version / basedOn / changeReason を通す。`form.hbs` は既に `{{description}}` をコメント内で参照しているが、Writer が渡していない。

コメントに載せる検索用トークン（Core。パスは環境依存なので書かない）:

```text
logicalId=<id> version=<ver> basedOn=<ver>   （basedOn が無い作業中 HEAD は basedOn を省略）
```

`data/ir/<logicalId>/current` と `versions/<version>/` / `versions/<basedOn>/` を手で追えるようにする。

## ドメイン / store 分割

| 役割 | 置き場 |
|---|---|
| 純クラス `UIDefinition` + `UIDefinitionData`（live meta + components） | `src/lib/ir/ui-definition.ts` |
| ファクトリ | `src/lib/ir/elements/factories.ts` |
| `$state` 工場 `createReactiveUIDefinition`、Context、`loadImported`、`clonePlainData` | `src/lib/store/layout-editor/layout-editor.svelte.ts` |
| 投影 | `src/lib/ir/ui-definition-meta.ts` |

反応性は data bag を `$state` で作ってクラスに渡す（前回採用案）。

## Rules

| ファイル | 変更 |
|---|---|
| `00-project-purpose.mdc` | SSOT を種類名のない `IRDefinition` にしない。現行の UI 定義集約は `UIDefinition`。`ir/` に別種類（layout IR 等）を足すときは種類名のクラスにする |
| `01-design-principles.mdc` | (1) `IRDefinition` / `ir-definition` を型・ファイル名に使わない (2) 同じデータの用途違いを、呼び出し点の便宜メソッドや局所 Pick で済ませない。呼び出しが 2 経路以上ある投影はドメイン横のモジュールに名前を付ける (3) YAGNI: 呼び出しの無い投影・第 4 のプラグイン種は作らない |
| `02-architecture-boundaries.mdc` | `IRDefinition` / `IRDefinitionStore` を `UIDefinition` と layout-editor store に置換。データフローも同様 |
| `ir-definition.mdc` | **`ir-domain.mdc` に改名**。パッケージ規則（Svelte / ベンダー / I/O 禁止、種類は固有名、要素は `elements/`） |
| `store-presentation.mdc` | store は `ir/` の `UIDefinition` を `$state` 注入して Context に置く。SSOT を再定義しない。example を `createReactiveUIDefinition` に |
| `reader-writer.mdc` | Writer は `UIDefinition` を import しない。Raw 上の系統キーは IR 由来でベンダー語彙ではない。コメント埋め込みは target 方言が許すときだけ |
| `transformer.mdc` | Export は `toVendorExportMeta` 相当を Raw に載せる。Import はベンダー値から `basedOn` を作らない |
| `12-docs-maintenance.mdc` | 系統キーは Core（横断）。コメントの書き方（XHTML vs JSON 不可）は target 文書 |

## 実装順（確認後）

変更理由が近いものをまとめる。局所パッチを先に打たない。

1. **Rules** — 以降の実装が命名と投影の置き場を守る
2. **投影 + Export 引き回し** — `ui-definition-meta.ts`、auto-save / export-client、transform、schema、PrimeFaces shape/writer/`form.hbs`、docs（Core export + primefaces-export。im-forma は Raw 保持・コメントなし）
3. **純クラス + ファクトリ移動** — `ui-definition.ts`、store 工場、パレット直 import、export-client の型を `ir/` へ

2 の時点で系統コメントは動く（クラス分割より先でも可）。3 は presentation 境界。

## 変更ファイル（予定）

| 領域 | ファイル |
|---|---|
| Rules | 上記 `.mdc`（`ir-definition.mdc` は改名） |
| 投影 | `src/lib/ir/ui-definition-meta.ts` + spec |
| ドメイン | `src/lib/ir/ui-definition.ts` + spec（手順 3） |
| ファクトリ | `src/lib/ir/elements/factories.ts`（手順 3） |
| store | `layout-editor.svelte.ts`、`ir-auto-save.svelte.ts`、`ui-export-client.ts`、`+layout.svelte`、`DefinitionImportModal.svelte`、`ComponentToolPalette.svelte` |
| transform | `primefaces-transform.ts`、`im-forma-transform.ts` |
| schema | `schemas/raw/primefaces.schema.json` |
| writer | `primefaces-shape.ts`、`primefaces-writer.ts`、`templates/export/primefaces/form.hbs` |
| docs | `architecture/overview.md`、`use-cases/ui-export.md`、`use-cases/layout-editor.md`、`use-cases/primefaces-export.md`（コメント例）、`use-cases/im-forma-export.md`（コメント不可） |
