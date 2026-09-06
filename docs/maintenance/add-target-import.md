---
created: "2026-09-07T04:46:00"
summary: "新 adapter target の Import パイプラインを実装する手順。unshape / Reader / Raw→IR transform / registry"
updated: "2026-09-07T06:40:00"
features:
  - maintenance
  - adapter-target
  - ui-import
---

# 保守手順: target 追加（Import パイプライン）

最終更新: 2026-09-07 06:40

新しい adapter target の**取り込み**を実装する手順です。横断仕様は [外部 UI 定義の取り込み](../use-cases/ui-import.md) を参照してください。schema / config / UI / docs は [その他対応](./add-target-other.md) にあります。

以下では新 target の id を `<t>`、パスカルケース名を `<T>` と書きます。

## パイプライン全体

```
POST /api/ui/import                       src/routes/api/ui/import/+server.ts:17
  → resolveImportTargetBundle(target)     不明なら 400
  → acceptsFilename(reader, filename)     拡張子不一致なら 400
  → bundle.reader.toRaw(source)           → RawDefinition
  → validateRawDefinition(targetId, raw)  JSON Schema → Zod、失敗は 400
  → bundle.transform(raw)                 → ImportedDefinition
```

入口は `importFromUploadedFile(targetId, source)`（`src/lib/server/ui/import-pipeline.ts`:17）です。アップロードは 2 MB 上限（`MAX_IMPORT_FILE_BYTES`）です。

**Reader は Raw を作るだけで、検証はしません。** 検証は pipeline が JSON Schema で行います。Reader 内で独自の妥当性判定を作り込まないでください。

## 1. parse 層（多くの場合は流用）

`src/lib/server/io/readers/parse/` に共有パーサがあります。

| ファイル | 用途 |
|---|---|
| `parse-json.ts` | `parseJson`、BOM 除去 `stripUtf8Bom` |
| `parse-xml.ts` | `parseXml` と順序保持 XML アクセサ群（`getXmlTagName` / `getXmlAttribute` / `getXmlChildren` / `findXmlNodeByTag` など） |

JSON でも XML でもない形式（YAML など）のときだけ、ここに新しい parse モジュールを追加します。

## 2. unshape

`src/lib/server/io/readers/unshape/<t>-unshape.ts` に `unshape<T>(payload, options?) → RawDefinition` を作ります。雛形は `im-forma-unshape.ts` / `primefaces-unshape.ts` です。

ここでやることは 4 つです。

1. **`raw.target = '<t>'` を設定する。** Raw schema が `const` で突き合わせます
2. **`logicalId` と `name` を決める。** ベンダー側に画面 ID があればそれを、無ければファイル名 stem から導出します（`im-forma-unshape.ts` は stem 方式、`primefaces-unshape.ts` は `h:form/@id` 方式）
3. **フィールド配列を target 自身のキーで出す。** ここは標準化されていません（`primefaces` は `fields`、`im-forma` は `items`）。**新 target が選んだキーを schema・transform・shape/merge で一貫させてください**
4. **モデル化しないベンダー情報を `external['<t>']` に退避する。** `buildTargetResidual`（`src/lib/ir/external-residual.ts`:42）を使います

**Export で元文書を復元する必要があるなら、退避キーを export された定数にしてください。** merge 側が同じ定数で読み戻します（`im-forma-unshape.ts` の `IM_FORMA_IMPORT_BASE_KEY` 等がその形）。詳細は [Export パイプライン](./add-target-export.md#shape-か-merge-か) を参照。

### 文書族の判定

**target 横断のフォーマット推測は存在しません。** target は利用者が明示的に選び、registry で検証されます。

同一 target 内で「読めない文書」を弾く必要がある場合は unshape の先頭で判定して `DefinitionReadError` を投げます（`im-forma-unshape.ts` は top-level `item_list` の不在で別文書族を拒否）。**メッセージは利用者に出るので日本語で書いてください。**

## 3. Reader

`src/lib/server/io/readers/<t>-reader.ts` に実装します。interface は 3 メンバだけです。

```14:22:src/lib/server/io/readers/definition-reader.ts
export interface DefinitionReader {
	readonly targetId: string;
	/** 受け付ける拡張子（UI の accept 属性とサーバー側検査に使う） */
	readonly acceptExtensions: readonly string[];
	/**
	 * 外部定義ファイルを RawDefinition へ変換する
	 */
	toRaw(source: DefinitionSource): RawDefinition;
}
```

既存 Reader は「parse → unshape → `DefinitionReadError` 以外の throw を `DefinitionReadError` で包む」という同じ形をしており、各段を `runLogged` で囲んでいます。これに倣ってください。

`acceptExtensions` は**サーバ側の拡張子検査**とクライアント側の `accept` 属性の両方に使われます。[その他対応](./add-target-other.md) のクライアント登録で同じ値を書くので、食い違わせないこと。

## 4. Raw → IR transform

`src/lib/transform/<t>-transform.ts` に `transformFrom<T>Raw(raw) → ImportedDefinition` を作ります（Export 方向の関数と同じファイルに置くのが既存の形です）。

- フィールド配列は unshape で決めたキーから読みます
- 各フィールドの写像は共有の `mapRawFieldToComponent`（`src/lib/transform/raw-to-ir-fields.ts`）に委譲します。**target 固有の写像をここに足さないこと**
- `mapRawFieldToComponent` は `parsePersistedComponent` で `PersistedComponent` にする（`id` は付けない）。未知の Raw `type` は `unsupported` + `sourceType`
- 残余は `normalizeExternalResidual` で正規化します
- 戻り値型は `src/lib/transform/imported-definition.ts` の `ImportedDefinition`（`components: PersistedComponent[]`）

ベンダー type → IR type の対応表が必要なら、target 専用ファイル（`src/lib/server/io/forma/im-forma-type-map.ts` に相当）に切り出します。

## 5. registry 登録（サーバ + クライアント）

### サーバ

`src/lib/server/ui/import-target-registry.ts`:23 の `IMPORT_TARGET_REGISTRY` に追加します。

```typescript
'<t>': {
	targetId: '<t>',
	reader: new <T>Reader(),
	transform: (raw) =>
		runLogged(logger, 'transformFrom<T>Raw', { targetId: '<t>' }, () =>
			transformFrom<T>Raw(raw)
		)
}
```

同ファイルの WARN どおり、**Reader が実装済みの target だけを登録してください。**

### クライアント

`src/lib/store/layout-editor/ui-import-client.ts`:84 の `UI_IMPORT_CLIENT_REGISTRY` に追加します。`HttpUiImportClient` を継承し、コンストラクタで id と受付拡張子を渡すだけです（既存 2 クラスがその形）。

**この registry が取り込みモーダルの選択肢を絞ります。** ここに無い target は `application.yml` に載っていても取り込み UI に出ません。

## 6. テスト

雛形にする既存 spec:

| 層 | 例 |
|---|---|
| Reader | `src/lib/server/io/readers/primefaces-reader.spec.ts` |
| unshape | `src/lib/server/io/readers/unshape/im-forma-unshape.spec.ts` |
| 実ファイル往復 | `src/lib/server/ui/im-forma-roundtrip.spec.ts`・`primefaces-import-roundtrip.spec.ts` |

**往復テストを必ず書いてください。** 「取り込んで、編集せずに出力したらバイト一致する」という形が、残余の取りこぼしを最も早く検出します。取りこぼしは import 側で `external` に入れ忘れても export まで進まないと露見しません。

加えて、既に target ごとのケースを持つ共有 spec にケースを足します。一覧は [その他対応](./add-target-other.md#既存-spec-の修正) にあります。

## よくある落とし穴

- **`external` を transform で通し忘れる。** `src/lib/transform/ir-to-raw-fields.ts` の WARN のとおり、`external` を渡さないとベンダー残余が export で黙って消えます
- **`acceptExtensions` の不一致。** サーバ Reader とクライアントで違うと、ファイル選択はできるのに 400 になります
- **空の残余バッグ。** `external: { '<t>': {} }` はキーがあっても「残余なし」と数えられます（`hasTargetResidual` はキー数で判定）
- **登録漏れがコンパイルで見つからない。** targetId の union 型が無いため `npm run check` は通ります。registry 6 箇所を手で確認してください
