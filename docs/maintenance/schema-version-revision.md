---
created: "2026-09-07T04:46:00"
summary: "IR snapshot の schemaVersion を改訂するときの作業手順。sub 改訂 3 箇所と main 改訂の同意フロー"
updated: "2026-09-27T05:30:00"
features:
  - maintenance
  - ir-snapshot
  - schema-version
---

# 保守手順: `schemaVersion` 改訂

最終更新: 2026-09-27 05:30

IR snapshot（`snapshot.yml`）の**構造**を変えるときの手順です。現行仕様は [IR スナップショット自動保存](../use-cases/ir-snapshot-auto-save.md) を参照してください。

## 前提: 2 つの version を混ぜない

| キー | 位置 | 意味 | 誰が上げるか |
|---|---|---|---|
| `schemaVersion` | snapshot root | UI IR 定義の**構造**の版 | **保守者**（本手順） |
| `version` | `uiDefinition` 内 | ユーザ意図の**画面定義の製品版** | 利用者（GUI の確定操作） |

両者は無関係です。`schemaVersion` を上げても利用者の `uiDefinition.version` は動きません。逆も同じです。`src/lib/ir/snapshot-version.ts`（製品版のユーティリティ）を `schemaVersion` の処理に**流用しないでください**。2 概念がコード上で融合します。

## sub と main の判断

| 変更の性質 | 採番 | 同意 |
|---|---|---|
| 機械的に安全（キー追加、既定値の補完、既存の意味を書き換えない） | `sub` + 1 | 不要（自動 migration） |
| 破壊的（構造の作り替え、意味の変更、情報の欠落を伴う） | `main` + 1・`sub` = 0 | **必要** |

判断に迷ったら `main` を上げてください。同意を求めるのは安全側です。判断根拠は step の `rationale` に日本語で書き、これがそのまま同意ダイアログの文面になります。

## 手順 A: sub を上げる（通常経路）

必要なのは 3 箇所だけです。

### A-1. 現行版を上げる

`src/lib/ir/snapshot-schema-version.ts`:16 の `CURRENT_IR_SCHEMA_VERSION` を `'1.0'` → `'1.1'` にします。

**`BASELINE_IR_SCHEMA_VERSION`（同ファイル :24）は `'1.0'` のまま動かさないでください。** これは「`schemaVersion` キーを持たない既存資産をどの版として読むか」の値です。上げると旧資産が誤った世代に分類されます。

### A-2. migration step を 1 本足す

`src/lib/ir/snapshot-migration.ts`:39 の `IR_SNAPSHOT_MIGRATION_STEPS` に追加します。

```typescript
{
	from: '1.0',
	to: '1.1',
	rationale: 'layout の既定値を補完するだけで、既存の意味は書き換えない',
	migrate: (record) => ({ ...record, /* plain record 操作 */ })
}
```

`resolveStepChain` は `from === cursor` を辿るだけなので、**旧 `CURRENT_IR_SCHEMA_VERSION` を `from` にすれば経路は自動で繋がります**。飛ばすと読み込み時に `no migration path from …` エラーになります。

### A-3. 旧 schema の fixture でテストする

旧版 YAML を文字列で置いて `restoreIrSnapshotFromYaml` が通ることを確認します。

`src/lib/ir/snapshot-migration.spec.ts` の既存テストは `options.steps`（テスト用 escape hatch）で step を差し替えているので、**本番の `IR_SNAPSHOT_MIGRATION_STEPS` を通る経路のテストを別途書いてください**。差し替えテストだけでは登録漏れを検出できません。

## 手順 B: main を上げる

`main` を上げる場合は A-1〜A-3 に加えて、同意フローが動くことを確認します。配線は入っています。

| 経路 | 挙動 |
|---|---|
| 読込（GET `/api/ir/snapshot`、layout load、確定、過去版読込） | `confirmMigration` が無いと `IrSnapshotMigrationConsentError`。HTTP は 409 + `code: schema-consent` + `rationales` |
| 未来版 / 不正 / 経路なし | 409 `schema-future`、または 400 `schema-unreadable` / `schema-no-path`。上書きしない |
| 同意 | クエリまたは body の `confirmMigration=true`。GUI は `SchemaMigrationConsentModal` |
| auto-save | 同意が取れるまでその logicalId の POST を止める。同意後の保存だけ `confirmMigration: true` |
| premigration バックアップ | 同意が必要なファイルは、同意済みの書き込みの直前だけ `history/` へ退避する |

`step.rationale` が同意ダイアログの文面です。

## migration step を書くときの制約

- **Domain 型を import しない。** step は `Record<string, unknown>` → `Record<string, unknown>` の純関数です。これが「過去 schema の知識を Domain Model に持ち込まない」を構造的に保証しています。`<schemaVersion>/` ディレクトリに Domain のコピーを置く設計は採っていません
- **component `id` を参照できない。** `id` は書き込み時に strip され読み込み時に再採番されます。step は位置・構造ベースで書いてください
- **root の `version` は書かない。** 未使用なので `normalizeEnvelopeKeys` と `serializeIrSnapshot` が落とす。`uiDefinition.version` は触らない
- **コメントのキーパスがズレる。** `deserializeIrSnapshotDocument` はコメントを **migration 前の元 Document** から抽出します。step がキー名や `components[]` の順序を変えると、運用コメントが旧パスに紐づいたまま残ります

## 波及チェックリスト

step の内容によって次が必要になります。

- **root にキーを増やした** → `SYSTEM_META_OBJECT_KEYS`（`src/lib/utils/object-key-sort.ts`）か `SNAPSHOT_YAML_PREFERRED_KEYS`（`src/lib/ir/snapshot.ts`）にキー順を追加。入れないと ASCII 順に流れます
- **形を変えた** → `normalizeSnapshotForCompare` の見直し。auto-save の skip 判定に使われるので、追随しないと「毎回差分あり」か「差分を取り逃す」になります
- **envelope キーを触った** → `SummonTemplateContext`（`scripts/lib/summon.ts`:17）と `templates/cli/summon/` のテンプレート
- **常に** → [IR スナップショット自動保存](../use-cases/ir-snapshot-auto-save.md) の envelope shape と 4 分類表、`.articles/` への追記

## やらなくてよいこと

- **既存ファイルの一括書き換えは不要です。** `versions/<v>/` は immutable のまま残り、読み込み時に毎回 migration が走ります。migration を `deserializeIrSnapshotDocument` という単一の choke point に置いたのはこのためで、`current/` と `versions/` で分岐が生まれません
- `current/` は、同意が要らない古い sub、または同意済みの書き込みのときだけ、`history/ir-snapshot-<ts>-premigration-<ver>.yml` へ退避してから commit する
- `schemaVersion` を持たない旧資産のための step も不要です（baseline として読まれます）

## 検証

```
npm run test
npm run check
```

どちらも承認なしで実行してよいコマンドです。最低限、旧版 fixture の読み込み・`schemaVersion` 一致時の無変換・未来版の拒否が緑になることを確認してください。
