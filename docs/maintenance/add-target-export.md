---
created: "2026-09-07T04:46:00"
summary: "新 adapter target の Export パイプラインを実装する手順。IR→Raw transform / shape or merge / serialize / Writer"
updated: "2026-09-07T04:46:00"
features:
  - maintenance
  - adapter-target
  - ui-export
---

# 保守手順: target 追加（Export パイプライン）

最終更新: 2026-09-07 04:46

新しい adapter target の**出力**を実装する手順です。横断仕様は [外部 UI 定義の出力](../use-cases/ui-export.md) を参照してください。schema / config / UI / docs は [その他対応](./add-target-other.md) にあります。

以下では新 target の id を `<t>`、パスカルケース名を `<T>` と書きます。

## パイプライン全体

```
POST /api/ui/export                          src/routes/api/ui/export/+server.ts:19
GET  /api/ui/download/[target]/[logicalId]   .../+server.ts:20
  → resolveExportTargetBundle(target)        不明なら 400
  → bundle.transform(editorMeta, components) IR meta+components → RawDefinition
  → validateRawDefinition(targetId, raw)     Import と同じ schema、失敗は 400
  → bundle.writer.toArtifact(raw)            → DefinitionArtifact
  → writeExportedDefinition(...)             <exportDir>/<targetId>/<logicalId>/
```

入口は `exportFromEditorState(targetId, editorMeta, components)` と `exportFromLatestSnapshot(targetId, logicalId)`（`src/lib/server/ui/export-pipeline.ts`）です。

**Import と同じ JSON Schema が Export 方向でも使われます。** つまり schema は 1 target に 1 枚で、両方向の契約になります。

## 1. IR → Raw transform

`src/lib/transform/<t>-transform.ts` に `transformTo<T>Raw(meta, components) → RawDefinition` を作ります（Import 方向と同じファイル）。

```11:22:src/lib/transform/im-forma-transform.ts
export function transformToImFormaRaw(
	meta: UiDefinitionEditorMeta,
	components: unknown[]
): RawDefinition {
	const exported = toVendorExportMeta(meta);

	return {
		target: 'im-forma',
		...exported,
		items: components.map(mapComponentToRawField)
	};
}
```

- メタは必ず `toVendorExportMeta(meta)`（`src/lib/ir/ui-definition-meta.ts`）を通します。これが `logicalId` / `name` / `description` / `version` と IR 系統キー `basedOn` / `changeReason` を供給します。**呼び出し側で `Pick` やフィールド列挙を書かないこと**
- フィールド写像は共有の `mapComponentToRawField`（`src/lib/transform/ir-to-raw-fields.ts`:9）に委譲します
- 配列キーは Import で決めたもの（`fields` / `items` など）と一致させます

## 2. shape か merge か

新 target で最初に決める分岐です。**ベンダー文書が IR よりはるかに多くの状態を持ち、それを失えないなら merge、IR から全量生成できるなら shape** です。

| 方式 | 使う条件 | 実装場所 | 既存例 |
|---|---|---|---|
| **shape** | 形式が IR + 属性単位の残余で完全に表現できる。毎回まるごと生成してよい | `src/lib/server/io/writers/shape/<t>-shape.ts` | `primefaces-shape.ts`（XHTML を全生成） |
| **merge** | ベンダー文書に IR 外の状態が大量にあり、取り込み元を保持して patch する必要がある | `src/lib/server/io/writers/merge/<t>-merge.ts` | `im-forma-merge.ts`（取り込み時の全文を保持して項目単位に patch） |

merge を選ぶ場合は Import 側と対になります。unshape で文書全体を `external['<t>']` の残余キーに退避し、export でそれを deep copy して patch します。IR にしか無い項目には新しいベンダー id を採番し、削除は関連リストへカスケードさせる必要があります。この対称性を崩すと往復でデータが落ちます。

shape を選ぶ場合、**残余を先に spread して IR 側のキーが勝つ**順序にしてください（`primefaces-shape.ts` に WARN 付きでその順序があります）。逆にすると利用者の編集が古い残余に上書きされます。

## 3. serialize

`src/lib/server/io/writers/serialize/` に 3 種あります。

| モジュール | 用途 |
|---|---|
| `serialize-handlebars.ts` | テンプレートから生成。`serializeHandlebarsTemplate(targetId, context, templateFileName?)`。第 3 引数を省くと `components/<context.type>.hbs` を解決し、未知 type は `components/unsupported.hbs` にフォールバック |
| `serialize-forma-json.ts` | Forma 方言の単一行 JSON |
| `serialize-json.ts` | 素の JSON。**現在どの Writer も使っていません**。プレーン JSON の新 target 向けに空いています |

Handlebars を使う場合は `templates/export/<t>/` にテンプレート木が必要です。`templates/export/primefaces/` が雛形で、`form.hbs` + `components/*.hbs`（`textbox` / `textarea` / `number` / `label` / `checkbox` / `radio` / `dropdown` / `datepicker` / `timepicker` / `unsupported` など）という構成です。あわせて `config/application.yml` の `app.io.export.templates.<t>.dir` を追加します（未設定だと `resolveExportTemplateDir` が throw します）。

> `arcane:summon` の Handlebars は**別インスタンス**で、helper もキャッシュも共有しません。混同しないでください（[summon テンプレート](./add-summon-template.md)）。

## 4. Writer

`src/lib/server/io/writers/<t>-writer.ts` に実装します。

```18:28:src/lib/server/io/writers/definition-writer.ts
export interface DefinitionWriter {
	readonly targetId: string;
	/**
	 * logicalId に対する成果物のファイル名と Content-Type を返す（本文は作らない）
	 */
	describeArtifact(logicalId: string): Pick<DefinitionArtifact, 'filename' | 'contentType'>;
	/**
	 * Raw を成果物へ変換する
	 */
	toArtifact(raw: RawDefinition): DefinitionArtifact;
}
```

ファイル名と MIME は **Writer が決めます**。共有 IO 層は拡張子を一切解釈しません（interface のコメントがその方針を明記しています）。

`describeArtifact` の実装で必ず `assertSafeLogicalIdPathSegment`（`src/lib/ir/ui-definition-meta.ts`）を通してください。パストラバーサル対策です。

**`describeArtifact` は本文に依存しない純粋な関数にしてください。** download route が「ファイルが既にあるか」を本文生成の**前**に判定するために単独で呼びます。

出力パス自体（`<exportDir>/<targetId>/<logicalId>/`）は `src/lib/server/io/definition-export-io.ts` が target 非依存で扱うので、変更は不要です。

## 5. registry 登録（サーバ + クライアント）

### サーバ

`src/lib/server/ui/export-target-registry.ts`:22 の `EXPORT_TARGET_REGISTRY` に追加します。

```typescript
'<t>': {
	targetId: '<t>',
	transform: (meta, components) =>
		runLogged(
			logger,
			'transformTo<T>Raw',
			{ targetId: '<t>', logicalId: meta.logicalId, componentCount: components.length },
			() => transformTo<T>Raw(meta, components)
		),
	writer: new <T>Writer()
}
```

### クライアント

`src/lib/store/layout-editor/ui-export-client.ts`:143 の `UI_EXPORT_CLIENT_REGISTRY` に追加します。

**注意:** 取り込みモーダルは import client の有無で選択肢を絞りますが、`Preview.svelte` の出力側には同等のフィルタがありません。`application.yml` に載っていて export client が無い target は、ボタンが `disabled` になるだけで選択肢としては見えます。

## 6. テスト

| 層 | 雛形 |
|---|---|
| Writer | `src/lib/server/io/writers/definition-writer.spec.ts` |
| shape / merge | `src/lib/server/io/writers/shape/primefaces-shape.spec.ts`・`merge/im-forma-merge.spec.ts` |
| serialize | `serialize/serialize-handlebars.spec.ts`・`serialize/serialize-forma-json.spec.ts` |
| 実ファイル往復 | `src/lib/server/ui/im-forma-roundtrip.spec.ts` |

**往復テスト（取り込み → 無編集 export でバイト一致）が最重要です。** 加えて「IR にだけある component を足して export したら妥当な骨組みが増える」ケースを書いてください。merge 方式ではこの 2 つが仕様の本体です。

## よくある落とし穴

- **`external` を transform で通し忘れる。** `ir-to-raw-fields.ts`:52 の WARN のとおり、渡さないとベンダー残余が黙って消えます。往復テストが無いと気づけません
- **shape の spread 順序を逆にする。** 残余が IR より後に来ると利用者の編集が失われます
- **`describeArtifact` を本文依存にする。** download route の存在判定が壊れます
- **`application.yml` の template dir 忘れ。** Handlebars 利用時、`resolveExportTemplateDir` が throw します
- **`preview.transformTarget` への追加忘れ。** コードが全部揃っていても GUI に出ません（[その他対応](./add-target-other.md)）
