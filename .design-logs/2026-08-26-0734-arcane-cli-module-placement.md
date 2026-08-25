# CLI モジュール配置（`arcane` をソースパスから外す）

Date: 2026-08-26 07:34

## Problem / goal

`src/lib/server/arcane/` は npm script 名（alias）をモジュール境界にしている。  
`arcane` は CLI toolchain のコマンド名であり、ドメインでも責務でもない。

特に:

- `load-snapshot.ts` は summon 固有ではない（復元は IR / IO）
- `summon.ts` / `summon-cli.ts` は CLI ユースケース。`$lib/server/arcane` より `scripts/` 側が自然、という指摘

現行配置を置いた意図（説明）:

- 将来の `arcane:diff` / `grep` / `inspect` を同じフォルダに集めたかった
- vitest が `src/**/*.spec.ts` を拾うので `$lib` 配下に置いた

これは **npm alias の都合** であり、変更理由・可視性の境界ではない。指摘どおり妥当ではない。

制約: ディレクトリ（とそれに伴う import パス）の付け替え。処理内容は変えない。

## Proposed approach（推奨: A）

責務を 3 層に分ける。`arcane` は **エントリファイル名と npm script だけ** に残す。

```text
src/lib/ir/snapshot.ts              # RestoredIrSnapshot, restoreIrSnapshotFromYaml
src/lib/server/io/ir-snapshot-file.ts  # loadRestoredIrSnapshotFile（任意パス。autoSave 非依存）
scripts/lib/paths.ts                # cwd 相対 → 絶対（旧 resolveArcaneUserPath）
scripts/lib/summon.ts               # target 投影 + Handlebars
scripts/lib/summon-cli.ts           # argv
scripts/lib/*.spec.ts               # 上記のテスト（vitest include を足す）
scripts/arcane-summon.ts            # stdio / 終了コード（alias エントリ）
scripts/tsconfig.json               # 現状どおり $lib
```

`ir-snapshot-io.ts` には載せない。あちらは autoSave 世代管理 + `$env` 設定が変更理由。任意 YAML パスの読込とは別ライフサイクル。CLI が `application.yml` を引かない、という今の性質を保つ。

`restoreIrSnapshotFromYaml` は fs を使わないので `ir/snapshot.ts`（既存の deserialize / restore の隣）。ファイル読込だけ `server/io/`。

cwd 解決は snapshot 復元の一部ではない。CLI インフラとして `scripts/lib/paths.ts` へ。関数名は `resolveUserPath` 等へリネーム（挙動は同じ）。

将来:

```text
scripts/arcane-diff.ts      # alias
scripts/lib/diff.ts         # 比較ユースケース
# load は ir + io を再利用
```

## Alternatives

| 案 | 復元 | summon / CLI | 評価 |
|---|---|---|---|
| **A（推奨）** | `ir/` + `server/io/ir-snapshot-file.ts` | `scripts/lib/` | alias が `$lib` に漏れない。API から CLI を import しにくい |
| B | 同じ | `src/lib/server/cli/` | vitest の include 変更が少ない。SvelteKit サーバから誤って import できる |
| C | 全部 `scripts/lib/` | 同じ | load がドメインから遠ざかる。今回の指摘と逆 |
| D | 現行 `server/arcane/` | — | alias が境界。不採用 |

B の `server/cli/` は「CLI アダプタ」という汎用名ではある。ただし GUI/HTTP と同じ `src/lib/server` に置くと可視性が混ざる。CLI 専用なら `scripts/` の方が境界がはっきりする。

## Key decisions / open questions

1. **推奨 A でよいか**（`scripts/lib/` vs `src/lib/server/cli/`）
2. vitest に `scripts/lib/**/*.spec.ts` を足す（テストを scripts に移す場合）。B なら spec は `src` のまま
3. `resolveArcaneUserPath` を `resolveUserPath` に改名してよいか（ディレクトリ以外の識別子）

## Out of scope

- summon / restore のアルゴリズム変更
- `arcane:diff` / `grep` / `inspect` の実装
- `ir-snapshot-io.ts`（autoSave）との統合

## Resolution (2026-08-26)

案 A を採用。

- `RestoredIrSnapshot` / `restoreIrSnapshotFromYaml` → `src/lib/ir/snapshot.ts`
- 任意パス読込 → `src/lib/server/io/ir-snapshot-file.ts`（`ir-snapshot-io.ts` とは分離）
- CLI → `scripts/lib/paths.ts`（`resolveUserPath`）, `summon.ts`, `summon-cli.ts`
- alias エントリ → `scripts/arcane-summon.ts` のみ
- vitest server include に `scripts/lib/**/*.{test,spec}.{js,ts}` を追加

