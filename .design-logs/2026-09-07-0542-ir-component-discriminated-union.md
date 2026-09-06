# IR component の Zod discriminatedUnion 化

日付: 2026-09-07 05:42
状態: Phase 1–2 実装済み（Phase 3 import 境界 parse / Phase 4 GUI は未着手）

## 問題 / 目的

`components` が `any[]` のままで、component の増減・改修をコンパイラが検知できない。

- `src/lib/ir/elements/factories.ts` の 12 ファクトリすべてが `(info: any) => any`
- `src/lib/ir/ui-definition.ts` の `components: any[]` / `append(info: any)` / `replaceComponents(items: any[])`
- `src/lib/preview/preview-types.ts`:20 に `WARN: IR 型確定までは store の any[] をこの型で受ける` と、この作業の受け皿が明示されている

目的は 3 つ。

1. 汎用項目（`logicalId` / `type` / `label` …）を共通基底として共通化する
2. `type` による具体型判定（discriminated union）を成立させる
3. `id` は外部ファイル永続化に使わないため、**内部と外部を型上で厳密に分ける**

## 着手前に確定した事実

### F1. `type` は現在 open string で、ベンダー値が IR に流入している

これが閉じた union の最大の障害。`src/lib/server/io/forma/im-forma-type-map.ts`:2-5 の WARN が明示している。

```
WARN: ここに無い item_type は IR type にベンダー文字列をそのまま載せる（パススルー）。
```

`formaItemTypeToIr`（同 :34）は対応表に無い `item_type` をそのまま返し、`unshapeImFormaItem`（`im-forma-unshape.ts`:159,168）が `type: irType` として Raw に載せる。`mapRawFieldToComponent`（`raw-to-ir-fields.ts`:27）も空文字のときだけ `'unknown'` にするので、`product_72_shape` / `product_80_header` / `product_72_formaAutoNo` / `product_72_func` などが IR `type` に入る。

対応表は 7 種のみ（textbox / textarea / number / radio / checkbox / selectbox → dropdown / label / calendar → datepicker）。実サンプルの残りは全部パススルー。

### F2. `id` の内部専用化は既に**実装済み**

型で固定するのは既存挙動の明文化であり、挙動変更ではない。

- `SNAPSHOT_COMPONENT_EXCLUDE_TREE = { id: true }`（`snapshot.ts`:91）で書き込み時に strip
- `SNAPSHOT_RESTORE_GENERATORS = { id: () => nanoid(16) }`（同 :99）で読み込み時に再採番
- `snapshot-migration.ts`:8-9 の WARN が「step は `id` を参照できない」と既に依存している

ただし採番長が不統一。ファクトリ `nanoid(24)`（`factories.ts`:11）、`append` `nanoid(16)`（`ui-definition.ts`:75）、restore `nanoid(16)`（`snapshot.ts`:100）。

### F3. 増減検知の仕組みは既に実証済み

`PreviewComponentRenderer.svelte`:33 が `satisfies Record<PreviewComponentType, Component<PreviewRendererProps>>` を使っている。ただし `PreviewComponentType`（`preview-types.ts`:2-16）は date/time 系 4 種がコメントアウトされた**独自の狭い union** で、IR と一致していない。

### F4. Zod は v4、かつ手書きスキーマが 1 つも無い

`zod: ^4.4.3`。`z.fromJSONSchema`（`json-schema-loader.ts`:89）と `zod/v4/locales/ja.js`（`zod-locale.ts`:2）で v4 確定。`z.object` / `z.discriminatedUnion` は未使用で、既存スキーマはすべて JSON Schema から生成。**IR union は本リポジトリ初の手書き Zod スキーマになる。**

### F5. 5 フィールドが snapshot 専用（export で落ちる）

`defaultValue` / `defaultValueFrom` / `defaultValueTo` / `tooltip` / `autosize` は `SNAPSHOT_YAML_PREFERRED_KEYS` にあり YAML には出るが、`ir-to-raw-fields.ts` の allowlist に無いため Raw へ行かない。逆に `mapRawFieldToComponent` も生成しないので、**import 由来の component はこれらのキーを持たない**。

### F6. `label` だけ基底を共有していない

`createLabel`（`factories.ts`:385）は `id` / `logicalId` / `type` / `label` / `defaultValue` のみ。`hint` / `disabled` / `readonly` / `hidden` / `tooltip` / `validation` を持たない。一方 `ir-to-raw-fields.ts`:26-28 は type を問わず `disabled` / `readonly` / `hidden` を出すので、export 時点では差が消えている。

## 提案

### D1. 型は 2 層に分け、片方から機械的に導出する

```
componentShapes（型ごとの Zod field 定義。単一の真実）
  ├─→ PersistedComponent  = discriminatedUnion（id なし）  … snapshot YAML / transform 境界
  └─→ EditorComponent     = discriminatedUnion（id あり）  … store / GUI / preview
```

**`EditorComponent` を `PersistedComponent` から導出する**ことで 2 つが drift しない。逆向き（Editor から `Omit<…, 'id'>`）は union に対する `Omit` が分配されず潰れるので採らない。

命名案:

| 型 | 意味 | `id` |
|---|---|---|
| `PersistedComponent` | 外部ファイルに出る形 | **持たない** |
| `EditorComponent` | store / GUI が持つ形 | `ComponentId` |
| `ComponentType` | `type` の literal union | — |

`PersistedComponent` 側を `z.strictObject`（v4）にすると、`id` の混入が**実行時にも**検出できる。`stripSnapshotComponents` の出力を `PersistedComponentSchema` で parse するテストを 1 本書けば「`id` を永続化しない」が回帰テストで守られる。

IR は allowlist 経由（`mapRawFieldToComponent`）でしか外部データを取り込まないので、strict は成立する。ベンダー残余は宣言済みの `external` に入るため衝突しない。

### D2. 共通基底は「shape の spread」で作る

`z.object().extend()` の連鎖ではなく、plain object の field 定義を spread する。各 member のフィールド全量がその場で読めるほうが保守しやすい。

```typescript
/** 全 component 共通の項目 */
const baseShape = {
	logicalId: z.string().default(''),
	label: z.string().default(''),
	hint: z.string().default(''),
	disabled: z.boolean().default(false),
	readonly: z.boolean().default(false),
	hidden: z.boolean().default(false),
	tooltip: z.string().default(''),
	external: ExternalResidualSchema.optional()
};

/** validation の共通項目 */
const validationBaseShape = {
	required: z.boolean().default(false),
	customErrorMessages: z.record(z.string(), z.string()).default({})
};
```

**`.default()` を積極的に使うのが要点。** 既存 snapshot に無いキーは parse 時に埋まるので、Phase 1 を**追加のみ**に保てば `schemaVersion` の改訂が不要になる（[schemaVersion 改訂手順](../docs/maintenance/schema-version-revision.md)の判断基準で言えば sub 改訂すら不要）。

F6 の `label` は基底を共有させる方向を推奨する。`.default()` があるので既存ファイルは parse で埋まり、GUI の `disabled` / `readonly` 列の特別扱いも消える。

### D3. 未知 type は専用 member に正規化する（要決定・最大の論点）

F1 のため、閉じた union は「ベンダー type をそのまま載せる」現状と両立しない。3 案。

| 案 | 内容 | 評価 |
|---|---|---|
| **A** | `type: z.literal('unsupported')` の member を置き、元のベンダー型名を `sourceType: z.string()` に退避。正規化は `mapRawFieldToComponent` の 1 箇所 | **推奨。** discriminant が閉じたまま情報を失わない |
| B | `type: z.string()` の catch-all member | **不可。** discriminant が `string` になり全 member への narrowing が壊れる。`primefaces-shape.ts`:84 の `PrimeFacesUnknownFieldShape` が既にこの誤りを踏んでいる（真似しない） |
| C | IR は typed、`RestoredIrSnapshot.components` は `unknown[]` のまま | 目的（増減のコンパイラ検知）が snapshot 経路で効かない |

案 A の**必須検証項目**: im-forma の export が `item_type` を IR `type` からではなく残余 base（`item_snapshot` / `importBase`）から復元していること。IR type から引いているなら byte-roundtrip が壊れる。`irTypeToFormaItemType(irType, fallback)`（`im-forma-type-map.ts`:48）が `fallback` を取る形なので復元元は残余だと推測できるが、**実装前に merge 経路を読んで確認する。**

なお im-forma の byte-roundtrip は現在 label の非対称マッピングで既に失敗している（`.articles/2026-09-07.md` 03:31 節）。ここを直す前後で判断が変わるため、先に片付けるほうが安全。

### D4. 増減をコンパイラで検知する 3 つの仕掛け

これが本題の実装手段。

1. **ファクトリ registry を exhaustive にする。** `COMPONENT_FACTORY_REGISTRY`（`factories.ts`:398）に `satisfies Record<ComponentType, ComponentFactory>` を付ける。union に type を足してファクトリを書き忘れるとコンパイルエラー
2. **preview registry を IR の union に揃える。** `PreviewComponentRenderer.svelte`:33 は既に `satisfies` を使っているので、`PreviewComponentType` を `ComponentType` に置き換えるだけ。未実装の date/time 系が即エラーになるので、`PreviewUnknown` へ明示的にフォールバックする形にする
3. **ベンダー type マップは `Partial<Record<ComponentType, string>>` にする。** target が全 IR type を対応する義務はないので exhaustive にはしない。ただしキーの綴り間違いは捕まる（`IR_TYPE_TO_FORMA_ITEM_TYPE` / primefaces 側）

加えて `switch (component.type)` の網羅性を `assertNever(value: never): never` で担保する。

### D5. スキーマの置き場所（要決定）

推奨: `src/lib/ir/elements/component-schema.ts`（+ 型が増えたら型別ファイルに分割）。

- 変更理由が「IR が進化するとき」であり、`ir/` の change reason と一致する（`.cursor/rules/14`）
- クライアント（Svelte）が型を import するので server-only には置けない
- `schema/` の change reason は「外部形式の信頼境界・target ごと」で別物

対案は `src/lib/schema/ir/`。ただし `.cursor/rules/02` の `schema/` は「Raw の信頼境界」と定義されており、IR の**ドメイン型定義**を混ぜると層の意味がぼやける。`docs/architecture/overview.md` の層表も更新が必要になる。

### D6. parse は 1 箇所だけで走らせる

Zod を入れる価値は「境界で 1 回 parse して既定値を埋め、drift を検出する」ことにある。全アクセスで parse しない。

| 場所 | 扱い |
|---|---|
| `restoreSnapshotComponents`（snapshot 読込） | **parse する。** 既定値補完 + 構造検証 |
| `mapRawFieldToComponent`（import 境界） | **parse する。** 未知 type の正規化もここ |
| store / GUI / preview | parse しない。型を信頼する |
| `projection/`・`scripts/lib/summon.ts` | **現状維持（`Record<string, unknown>`）。** 復元済み snapshot record を触る層で、IR の live 型とは別物 |
| `snapshot.ts` の record walker（`stripByExcludeTree` / `deleteByPath` / `setByPath`）・`comment-target-tree.ts` | **現状維持。** 正当な generic walker。境界で 1 回 `as Record<string, unknown>` を documented cast として置く |

### D7. `ComponentId` の branded type（任意）

```typescript
export type ComponentId = string & { readonly __brand: 'ComponentId' };
```

任意の文字列を `id` に代入できなくなる。ただし DnD（`svelte-dnd-action` は item に `id` プロパティを要求）や DOM id 生成で string 化が頻発するため、費用対効果は中程度。**Phase 1 では入れず、採番長の統一（F2）だけ先に行う**ことを推奨。

## 変更対象

### Phase 1 — 型の新設と registry の exhaustive 化（挙動不変）

| ファイル | 変更 | リスク |
|---|---|---|
| `src/lib/ir/elements/component-schema.ts`（新規） | `baseShape` / 型別 shape / `PersistedComponentSchema` / `EditorComponentSchema` / `ComponentType` / `assertNever` | — |
| `src/lib/ir/elements/factories.ts` | 12 ファクトリの `any` を型付け。`satisfies Record<ComponentType, …>`。`SYSTEM_ID_LENGTH` を 16 に統一 | 低 |
| `src/lib/ir/elements/component-schema.spec.ts`（新規） | 既存 snapshot 相当の fixture が parse できること、`id` 混入が strict で弾かれること、ファクトリ出力が parse できること | — |

### Phase 2 — 集約と store の署名

| ファイル | 変更 | リスク |
|---|---|---|
| `src/lib/ir/ui-definition.ts` | `components: EditorComponent[]`、`append` / `remove` / `replaceComponents` / `loadSnapshot` の署名 | 低 |
| `src/lib/store/layout-editor/layout-editor.svelte.ts` | `$state` の型、`loadImported` | 低 |
| `src/lib/store/layout-editor/ir-auto-save.svelte.ts` | payload 型（`readonly unknown[]` のままでよい） | 低 |
| `src/lib/ir/snapshot.ts` | `restoreSnapshotComponents` で parse。record walker は現状維持 | 中 |

### Phase 3 — transform 境界と未知 type 正規化

| ファイル | 変更 | リスク |
|---|---|---|
| `src/lib/transform/raw-to-ir-fields.ts` | 未知 type → `unsupported` + `sourceType` の正規化。parse | **高**（D3 の検証が前提） |
| `src/lib/transform/ir-to-raw-fields.ts` | `unsupported` から元 type を復元。F5 の 5 フィールドを載せるかの決定 | **高** |
| `src/lib/server/io/forma/im-forma-type-map.ts` | `Partial<Record<ComponentType, string>>` 化。パススルー WARN の書き換え | 中 |
| `src/lib/server/io/writers/merge/im-forma-merge.ts` | `item_type` の復元元が残余であることの確認（変更不要なら触らない） | 中 |

### Phase 4 — GUI（最大の churn）

| ファイル | 変更 | リスク |
|---|---|---|
| `src/lib/preview/preview-types.ts` | `PreviewComponentData` を撤去し `EditorComponent` に置換。`Record<string, unknown> &` の交差を外す（これを外さないと exhaustiveness が無意味） | 中 |
| `src/lib/components/preview/PreviewComponentRenderer.svelte` | `PreviewComponentType` → `ComponentType`。未実装 type の明示フォールバック | 中 |
| `src/lib/components/preview/Preview*.svelte`（9 本） | props 型。`items` の optional 解消 | 中 |
| `src/lib/components/ComponentAttributeTable.svelte` | `component.hint !== undefined` の presence guard + `bind:` パターン。**union の narrowing では解けない** | **高** |
| `src/lib/components/ComponentDetailsCell.svelte` | `component: any` を撤去。`ITEMS_TYPES` / `FORMAT_TYPES` の `Set<string>` 判定を discriminant 判定へ | **高** |
| `src/lib/components/ComponentValidationCell.svelte` | `component: any` を撤去。`component.validation[key]` の computed-key write（`'minDateTime' \| 'maxDateTime'`） | **高** |
| `src/lib/components/ComponentLayoutBuilder.svelte` | `$state<any[]>` と 2 箇所の `as any[]`（DnD 由来） | 中 |

## 主要な落とし穴

### `bind:` と presence guard は narrowing にならない

Phase 4 の高リスクの正体。

```svelte
{#if component.hint !== undefined}
	<Input bind:value={component.hint} />
{/if}
```

`component` が union で `hint` が一部 member にしか無い場合、`!== undefined` は**型を絞らない**（`$derived` 配列要素なので TS は再代入を想定する）。`bind:` は writable な非 optional 参照を要求するのでエラーになる。

解き方の候補:
- **推奨:** 共通項目（`hint` / `disabled` / `readonly` / `validation.required`）を全 member 必須にする（D2 の `.default()` があるので既存資産は parse で埋まる）。属性表が触るのは共通項目だけなので、これで大半が消える
- type 固有項目を触るセル（`ComponentDetailsCell` / `ComponentValidationCell`）は `switch (component.type)` で分岐し、各分岐内で narrowed なローカルに `bind:` する
- 最後の手段として type 別セルコンポーネントへ分割

### `Record<string, unknown>` の交差を外さないと意味がない

`preview-types.ts`:22 の `Record<string, unknown> & {…}` を残すと、union を代入しても任意キーが通り exhaustiveness が消える。Phase 4 でここを外すのが preview 側の本質。

### `primefaces-shape.ts` を雛形にしない

`PrimeFacesFieldShape`（:91）は既に手書きの discriminated union で参考になるが、`PrimeFacesUnknownFieldShape`（:84）が `type: string` を持つため union 全体の discriminant が緩んでいる。**この形を IR で真似しない**（D3 案 B）。

### F5 の 5 フィールドをどうするか（要決定）

`defaultValue` / `defaultValueFrom` / `defaultValueTo` / `tooltip` / `autosize` は snapshot に出るが Raw へ行かない。

- **必須 + `.default()`** にすると、import 由来の component も parse 時に埋まって構造が揃う。GUI の分岐が減る。ただし export で落ちる状態は変わらないので、`ir-to-raw-fields.ts` に載せるかを別途決める必要がある
- **optional** のままにすると、factory 生成と import 生成で構造が違う状態が続き、GUI 側の presence guard が残る

**必須 + `.default()` を推奨。** GUI の churn を最も下げる。`tooltip` / `autosize` は現在どこも読んでいない dead field なので、この機会に削除する選択肢もある（削除は破壊的なので `schemaVersion` main 改訂の対象になる → 今回は温存を推奨）。

## 決定事項（2026-09-07 利用者確認済み）

| 論点 | 決定 |
|---|---|
| D3 未知 type | **案 A**。`type: z.literal('unsupported')` + `sourceType`。正規化は `mapRawFieldToComponent` の 1 箇所。im-forma の `item_type` 復元元の検証を Phase 3 の前提とする |
| D5 置き場所 | **`src/lib/ir/elements/component-schema.ts`** |
| F5 5 フィールド | **`tooltip` / `autosize` は削除**。`defaultValue` / `defaultValueFrom` / `defaultValueTo` は GUI に実エディタがあるため「必須 + `.default()`」 |
| Phase | **Phase 1 のみ実装してレビュー**（`component-schema.ts` 新規 + `factories.ts`） |

### `tooltip` / `autosize` の削除経路（2026-09-07 追確認）

**graceful removal を採る。** Zod `z.object` の未知キー除去で消し、`schemaVersion` は上げない。同意フローの実装も待たない。

### 決定 F5 に伴う論点: 削除は `schemaVersion` main 改訂に当たるか

[schemaVersion 改訂手順](../docs/maintenance/schema-version-revision.md) の判断基準では「情報の欠落を伴う」変更は `main` + 1 かつ同意必須。しかし同手順の「手順 B」が明記しているとおり**同意フローは未実装で、`main` を上げると auto-save が 500 になる**（`ir-snapshot-io.ts`:362 / :387 / :406 の 3 経路が `confirmMigration` なしで `deserializeIrSnapshotDocument` を呼ぶ）。

回避策として **Zod の既定のキー除去（strip）を使った graceful removal** を採る。

- Zod v4 の `z.object` は**未知キーを黙って除去する**（`z.strictObject` と違いエラーにしない）
- したがって `tooltip: ''` を持つ既存 snapshot は parse を通り、`tooltip` は in-memory から消える。次回 auto-save で YAML からも消える
- **migration step も `schemaVersion` 改訂も不要**

これが正当化できる根拠は、両フィールドが「書き手も読み手もいない」ことにある。`tooltip` / `autosize` には GUI エディタが無く、`ir-to-raw-fields.ts` の allowlist にも無い。よって on-disk の値は常にファクトリ既定値（`''` / `false`）で、利用者が入力した情報は存在しない。手作業で YAML を編集した場合のみ欠落するが、その値はどこからも参照されていない。

代償として、**typo したフィールド名も黙って除去される**。これを補うため、`z.strictObject` は使わずに次のテストで代替する。

- ファクトリ出力を `PersistedComponentSchema` で parse し、入出力のキー集合が一致すること（= ファクトリが未宣言キーを出していないこと）
- `stripSnapshotComponents` の出力が `id` を持たないこと

なお Phase 1 は parse を読み取り経路に配線しないため、この論点が実際に効くのは Phase 2（`restoreSnapshotComponents` での parse 導入）から。Phase 1 の時点ではファクトリが両キーを出さなくなるだけで、既存ファイルは無変更のまま残る。

### 残る前提確認

- im-forma の byte-roundtrip 失敗（label 非対称マッピング）は Phase 3 着手前に解消する。Phase 1〜2 とは独立

## 対象外（今回やらない）

- ドメイン検証エンジン（`.cursor/rules/03`）。Zod は境界の構造検証に限る
- `ComponentId` の branded type（D7）。採番長統一のみ先行
- レイアウト IR など 2 種目の IR kind
- `validation` の型別厳格化を超えた意味検証（`min <= max` 等）
- `projection/` の型付け。復元済み record 層は `Record<string, unknown>` のまま
