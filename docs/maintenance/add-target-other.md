---
created: "2026-09-07T04:46:00"
summary: "target 追加の残り作業。Raw JSON Schema / registry 一覧 / application.yml / 既存 spec 修正 / UI / docs"
updated: "2026-09-07T04:46:00"
features:
  - maintenance
  - adapter-target
  - raw-validation
  - application-config
---

# 保守手順: target 追加（その他対応）

最終更新: 2026-09-07 04:46

[Import パイプライン](./add-target-import.md) と [Export パイプライン](./add-target-export.md) に含まれない残りの作業です。**ここを飛ばすと「コードは全部あるのに GUI に出ない」「テストが落ちる」状態になります。**

以下では新 target の id を `<t>` と書きます。

## targetId 定数の置き場所

target 専用の定数ファイル `src/lib/server/io/forma/im-forma-constants.ts` 方式に倣ってください（`<t>-constants.ts`）。

PrimeFaces は定数を shape モジュール内に置き、Writer 側は文字列リテラルを直書きしていて一貫していません。**新 target で真似しないこと。**

## Raw JSON Schema

Import / Export の両方向で 1 枚の schema が使われます。検証は `validateRawDefinition(targetId, raw)`（`src/lib/schema/validate-raw.ts`:13）だけで、失敗は `RawValidationError` → 各 route で 400 + issue 一覧になります。

### 配置と登録

ファイルは `schemas/raw/<t>.schema.json` に置きます。**自動発見はありません**（パストラバーサル対策として意図的）。`src/lib/schema/json-schema-loader.ts`:11 の whitelist に id → ファイル名を追加します。

```typescript
const RAW_SCHEMA_FILENAMES: Record<string, string> = {
	primefaces: 'primefaces.schema.json',
	'im-forma': 'im-forma.schema.json'
};
```

`.yaml` / `.yml` も読めますが、**拡張子まで含めて whitelist に書いた文字列がそのまま使われます**。ここが実体とズレると `ENOENT` になります（実際に一度そうなっていました）。

### schema が満たすべき契約

- `"target": { "const": "<t>" }`
- `required` は `["target", "logicalId", "name", "<配列キー>"]`（配列キーは target 自身のもの。`primefaces` は `fields`、`im-forma` は `items`）
- `logicalId` は `^[a-zA-Z][a-zA-Z0-9_-]*$`
- **すべての階層で `additionalProperties: true`。** 残余が生き残る必要があります
- `basedOn` / `changeReason` は IR 系統キーとして宣言し、ベンダー語彙ではない旨を `description` に書く
- `$defs.external` を `{ type: object, additionalProperties: true }` として定義し、文書と各フィールドから `$ref` する

**厳しさは target の実態に合わせます。** `primefaces` はフィールドの `logicalId` / `label` に `minLength: 1` と id パターンを課しますが、`im-forma` は装飾専用項目のために空文字を許しています。Raw は寛容側に寄せるのが原則で、迷ったら緩くしてください。厳しすぎる schema は実ファイルの取り込みを丸ごと拒否します。

雛形作成には `npm run schema:infer` / `npm run schema:convert` が使えます（作業用の出力先は `schemas/drafts/`）。

## registry 一覧

targetId で引く登録先の全量です。**union 型が無いため登録漏れはコンパイルで検出できません。** ここを表として潰してください。

| # | 登録先 | 場所 | 必要なとき |
|---|---|---|---|
| 1 | `IMPORT_TARGET_REGISTRY` | `src/lib/server/ui/import-target-registry.ts`:23 | 取り込み対応時 |
| 2 | `EXPORT_TARGET_REGISTRY` | `src/lib/server/ui/export-target-registry.ts`:22 | 出力対応時 |
| 3 | `RAW_SCHEMA_FILENAMES` | `src/lib/schema/json-schema-loader.ts`:11 | **常に**（両方向で使う） |
| 4 | `UI_IMPORT_CLIENT_REGISTRY` | `src/lib/store/layout-editor/ui-import-client.ts`:84 | 取り込み対応時 |
| 5 | `UI_EXPORT_CLIENT_REGISTRY` | `src/lib/store/layout-editor/ui-export-client.ts`:143 | 出力対応時 |
| 6 | `preview.transformTarget.options` | `config/application.yml` | **常に**（GUI の選択肢の正） |
| 7 | `app.io.export.templates.<t>.dir` | `config/application.yml` | Writer が Handlebars を使うときだけ |

`arcane:summon` の `--target` は**任意文字列**で、registry 参照はありません。どの `external['<id>']` バッグを射影するかを選ぶだけなので、CLI 側の登録作業はありません。

## application.yml

### `preview.transformTarget`

```yaml
preview:
  transformTarget:
    default: primefaces
    options:
      - name: PrimeFaces
        value: primefaces
      - name: IM-Forma
        value: im-forma
```

**この一覧が両方の GUI ピッカーを作ります。** ここに無い target はコードが完全に揃っていても画面に出ません。

`default` が `options[].value` のどれとも一致しないと `resolvePreviewSelect` が throw して起動しません。

### `app.io.export.templates`

Handlebars を使う Writer のときだけ、テンプレート根を追加します。

```yaml
app:
  io:
    export:
      templates:
        <t>:
          dir: ./templates/export/<t>
```

## 既存 spec の修正

**必ず落ちるテストが 1 件あります。** `src/lib/server/config/application-config.spec.ts`:346-350 が `preview.transformTarget.options` の件数と値を固定で検証しています。

```typescript
expect(config.preview.transformTarget.options).toHaveLength(2);
expect(config.preview.transformTarget.options.map((option) => option.value)).toEqual([
	'primefaces',
	'im-forma'
]);
```

3 つ目を追加したらここを更新してください。

target ごとのケースを既に持っている共有 spec にも、新 target のケースを足します。

- `src/lib/schema/validate-raw.spec.ts`
- `src/lib/server/ui/import-pipeline.spec.ts`
- `src/lib/transform/ir-to-raw.spec.ts`・`raw-to-ir-fields.spec.ts`
- `src/lib/server/io/writers/definition-writer.spec.ts`
- `src/lib/server/io/definition-export-io.spec.ts`
- `src/lib/ir/external-residual.spec.ts`

なお `vite.config.ts` は `expect: { requireAssertions: true }` なので、アサーションの無いテストは失敗します。

## UI の確認

コード変更は不要ですが、挙動を確認してください。

| 画面 | ファイル | 挙動 |
|---|---|---|
| 出力 / ダウンロード | `src/lib/components/Preview.svelte` | `preview.transformTarget` を**そのまま全部**出す。export client が無い target はボタンが `disabled` になるだけ |
| 取り込みモーダル | `src/lib/components/DefinitionImportModal.svelte` | import client を持つ target だけに絞る。`accept` 属性はクライアントの `acceptExtensions` から作る |

つまり **export 専用 target は取り込みモーダルから正しく消えますが、import 専用 target は出力側に見えたままになります。** 片方向だけ対応する場合は覚えておいてください。

## `external` 残余の型

**追加作業はありません。** `src/lib/ir/external-residual.ts` の `ExternalResidual` は `Record<string, Record<string, unknown>>` で、target id を名前空間キーとして使うだけです。

IR はこれを型の付かないバッグとして扱い、中身を解釈してよいのは Reader / shape / merge だけです。IR 層に target 固有の型を足さないでください。`RawDefinition` も `Record<string, unknown>` で、形の保証は JSON Schema だけが持ちます。

## docs（省略不可）

`.cursor/rules/12-docs-maintenance.mdc` により、target 専用文書の追加は実装の一部です。

1. `docs/use-cases/<t>-import.md` と `docs/use-cases/<t>-export.md` を作る（雛形は `primefaces-import.md` / `im-forma-export.md`）
2. frontmatter（`created` / `updated` / `summary` / `features`）と本文の `最終更新: YYYY-MM-DD HH:mm` を入れる。`updated` と分まで一致させる
3. `docs/README.md` の「Adapter target」一覧と frontmatter の `features` にリンク・項目を追加する

**横断文書（`ui-import.md` / `ui-export.md` / `architecture/`）にベンダー語彙を書かないこと。** 語彙・type マップ・serialize 方言・文書族判定は target 専用文書に置きます。横断側は「registry 登録済み adapter として名前が出る」程度に留めます。

## 完了チェックリスト

- [ ] `<t>-constants.ts` を作った
- [ ] `schemas/raw/<t>.schema.json` を作り、whitelist に登録した
- [ ] unshape / Reader / Raw→IR transform（取り込み対応時）
- [ ] IR→Raw transform / shape or merge / serialize / Writer（出力対応時）
- [ ] registry 一覧の該当行すべてを登録した（**型では守られない**）
- [ ] `application.yml` の `transformTarget`（+ 必要なら `templates`）
- [ ] `application-config.spec.ts` の件数アサーションを更新した
- [ ] 往復テスト（取り込み → 無編集 export でバイト一致）が緑
- [ ] 共有 spec に新 target のケースを足した
- [ ] `npm run test` / `npm run check` が着手前から悪化していない
- [ ] target 専用 docs 2 本 + `docs/README.md` のリンク
- [ ] `.articles/` に作業記録を追記した
