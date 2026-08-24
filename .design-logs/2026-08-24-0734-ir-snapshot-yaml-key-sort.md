# IR snapshot YAML: eemeli/yaml + recursive key sort (comment-ready)

Date: 2026-08-24 07:34

## Problem / goal

- IR snapshot の YAML 出力は現状 `js-yaml` の `dump(..., { sortKeys: true })`。
- `sortKeys: true` はアルファベット順のみで、ドメイン上意味のあるキー順（例: `logicalId` → `type` → `label`）を固定できない。
- `js-yaml` はコメント出力に対応しない。将来 snapshot に説明コメントを載せるため、`eemeli/yaml`（Document AST）へ切り替える。
- オブジェクトキーの再帰ソートは snapshot 専用に閉じず、共通モジュールとして再利用可能にする。

## Current behavior

- `src/lib/ir/snapshot.ts`: `serializeIrSnapshot` / `normalizeSnapshotForCompare` / `normalizeComponentsForCompare` / `deserializeIrSnapshot` が `js-yaml` の `dump` / `load` を使用。
- `js-yaml` は引き続き `application-config` 読込・JSON Schema YAML 読込でも使用（本変更の対象外）。
- `yaml` パッケージは既に `package.json` に追加済み（`yaml@^2.9.0`）。

## Proposed approach

### 1. キー比較は YAML 非依存の共通関数にする

`src/lib/utils/object-key-sort.ts`（案）に切り出す。

比較規則:

1. `preferredKeys` に含まれるキーは、その配列順で先に並べる（存在しないキーはスキップ）。
2. それ以外は `String.prototype.localeCompare(other, undefined, { numeric: true })`（英字順 + 数字の自然順。`item2` < `item10`）。
3. 配列の要素順は変更しない。配列要素が object ならその中だけ再帰ソートする。
4. プレーン object 以外（Date, Map, class instance 等）は触らない。IR snapshot はプレーン JSON 相当のみ。

公開 API（案）:

```ts
compareObjectKeys(a: string, b: string, preferredKeys?: readonly string[]): number
sortObjectKeysDeep(value: unknown, preferredKeys?: readonly string[]): unknown
```

`preferredKeys` は呼び出し側が渡す。ユーティリティは「どのキーが重要か」を知らない。

### 2. 優先キーはパス別に解決する（単一リストは不可）

ルートの `version`（エンベロープ）と `uiDefinition.version`（画面定義バージョン）が同名のため、全階層で同じ `preferredKeys` を使うと `uiDefinition` 内で `version` が先頭に来てしまう。

そのため snapshot 層で **パス別** の優先リストを持つ。配列インデックスはパスから除外する。

| path（object キーのみ） | preferredKeys（案） |
|---|---|
| `[]`（root） | `version`, `savedAt`, `uiDefinition`, `components` |
| `['uiDefinition']` | `logicalId`, `name`, `description`, `version`, `createdAt`, `modifiedAt`, `external` |
| `['components']`（各要素） | `logicalId`, `type`, `label`, `hint`, `defaultValue`, `disabled`, `readonly`, `hidden`, `tooltip`, `validation`, 型固有, `external` |
| `validation` | `required`, `pattern`, `minlength`, `maxlength`, `min`, `max`, `step`, `customErrorMessages` |
| それ以外 | `[]`（規則 2 のみ） |

パス解決は snapshot 専用（`$lib/ir/snapshot-key-order.ts` 等）。共通モジュール側は `preferredKeys[]` だけを見る。

パス対応が必要なら、共通側に薄いオーバーロードを足してもよい:

```ts
type PreferredKeysResolver = (objectPath: readonly string[]) => readonly string[];
sortObjectKeysDeep(value, preferredKeys | resolver)
```

実装時は YAGNI: 最初は `compareObjectKeys` + 呼び出し側の再帰でもよい。再利用が 2 箇所目で必要になってから resolver を足す。

### 3. 出力は `Document` 経由にし、コメント挿入のフックを残す

`YAML.stringify` の `sortMapEntries` は `(a: Pair, b: Pair) => number` のみで **パスを受け取れない**。パス別 preferred と将来のコメント維持を両立するため、次のパイプラインにする。

```text
plain object
  → new Document(value)
  → sortYamlMaps(doc, compareByPath)   // YAMLMap.items を in-place ソート。Pair の comment は付いたまま移動
  → (将来) attachComments(doc)         // visit で commentBefore / comment を付与。本変更では未実装
  → doc.toString({ lineWidth: 0 })     // js-yaml の lineWidth: -1 相当（折り返し無効）
```

読み込みは `parse()`（または `parseDocument().toJS()`）で JS に戻し、既存の `parseIrSnapshot` へ渡す。コメントのラウンドトリップは将来（parseDocument を保持する）までやらない。

YAML ラッパの置き場所（案）:

- `src/lib/utils/yaml-document.ts` — `createYamlDocument` / `stringifyYamlDocument` / `sortYamlMaps`
- 新規 `src/lib/yaml/` は、yaml 利用が snapshot 以外に広がるまで作らない（YAGNI）

`sortYamlMaps` は `compareObjectKeys` を使う。Pair のキーは Scalar なら `.value`、それ以外は `String(key)`。

### 4. snapshot.ts の差し替え範囲

| 関数 | 変更 |
|---|---|
| `serializeIrSnapshot` | `dump` → Document + Map ソート + `toString` |
| `normalizeSnapshotForCompare` / `normalizeComponentsForCompare` | 同じ stringify 経路（比較ハッシュの安定性を出力と一致させる） |
| `deserializeIrSnapshot` | `js-yaml.load` → `yaml.parse` |

`ir-snapshot-io.ts` の呼び出し契約は変えない。

### 5. コメント挿入は今は実装しない

フックだけ用意する:

- stringify が必ず `Document` を経由する
- `serializeIrSnapshot` 内に「コメント付与は未実装」と分かる空の拡張点を置かない（死んだ関数は作らない）
- 将来は `visit(doc, …)` でノードに `commentBefore` を足すだけ、と docs / design log に書いておく

## Alternatives considered

| 案 | 採用しない理由 |
|---|---|
| `sortMapEntries: true` のみ | アルファベット順固定。preferred 順が不可。パス不可。 |
| JS オブジェクトを先にソートして `stringify` | 新規出力では動くが、将来「既存 YAML を parse → コメント維持して再ソート」するときに Pair 再構築が必要。Document 上で Map をソートする方がコメント向き。 |
| snapshot 内にソートを直書き | 再利用要求に反する。 |
| このタイミングで `js-yaml` を全廃 | application-config / schema loader は読込専用でコメント不要。範囲を snapshot に閉じる。 |

## Open questions

1. `uiDefinition` / component の preferred 順を、上表の案でよいか。
2. 未指定キーの大小比較を `localeCompare(..., { numeric: true })` でよいか（ASCII 符号位置順にするか）。
3. 共通モジュールを `src/lib/utils/` 置きでよいか（`src/lib/yaml/` を先に切るか）。

## Files to change (when implementing)

| Path | Action |
|---|---|
| `src/lib/utils/object-key-sort.ts` | **新規** 比較 + 再帰ソート |
| `src/lib/utils/object-key-sort.spec.ts` | **新規** ユニットテスト |
| `src/lib/utils/yaml-document.ts` | **新規** Document 生成 / Map ソート / stringify |
| `src/lib/ir/snapshot-key-order.ts` | **新規** snapshot 用 preferred リストとパス解決（小さく済むなら `snapshot.ts` 内定数でも可） |
| `src/lib/ir/snapshot.ts` | `js-yaml` → `yaml`。serialize / normalize / deserialize を Document 経路へ |
| `src/lib/ir/snapshot.spec.ts` | キー順のゴールデン YAML、round-trip |
| `docs/use-cases/ir-snapshot-auto-save.md` | `sortKeys` 記述を preferred + 残り numeric localeCompare に更新。ライブラリを `yaml` に |
| `docs/architecture/overview.md` | `utils/` のキーソート / YAML Document ラッパを 1 行追記（実装後） |

変更しない（本スコープ外）:

- `package.json` / lockfile（`yaml` は導入済み）
- `src/lib/server/config/application-config-yaml.ts` 等の `js-yaml` 読込
- コメント本文の挿入
- `ir-snapshot-io.ts` のファイル名 / skip 判定ロジック（stringify 結果が安定すればそのまま動く）
