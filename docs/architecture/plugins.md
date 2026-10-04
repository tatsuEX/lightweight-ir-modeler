---
created: "2026-09-01T08:20:00"
updated: "2026-10-05T02:05:00"
summary: "first-party の射影と writer pipeline。射影は IR を書き換えない。Raw の intentTags は step から読める"
features:
  - plugins
  - intent-tags
  - arcane
  - ir-snapshot
---

# First-party プラグイン（射影）

最終更新: 2026-10-05 02:05

閉じた kind と禁止事項の方針は Cursor ルール `.cursor/rules/16-plugins.mdc` を正とする。本稿は実装済みの射影と writer pipeline を書く。

## Writer pipeline

Export のうち、作業文書を書き換える target だけが使う。射影とは別モジュール（`src/lib/server/writer-pipeline/`）で、GUI を import しない。

- 入力 Raw は複製して読む。UI IR と snapshot には書かない。同じ Raw からは同じ作業文書になる。
- 前段は既存の Raw Zod（pipeline を始めてよいか）。後段は target が opt-in したときだけ、serialize 前に作業文書を見る。Raw Zod の再実行ではない。
- step は namespace 付き id を持つ。前提は passed steps を見る。成功したときだけ自分の id を足す。
- 変更は JSON Pointer と理由を渡す `mutate` だけ。同一 pointer は 1 件に畳み、before は最初の値、after と reason は最終更新。
- error で pipeline を止め、成果物は書かない。warn だけなら書き、Export API の `warnings` で返す。
- step の中身と採番は target 文書に書く。射影 view は今は渡さない。
- Raw の各フィールドは IR 由来の `intentTags?: string[]`（[Intent Tags](../use-cases/intent-tags.md)）を持ちうる。タグを解釈する step はまだ無い。

## 原則

- IR の SSOT（Single Source Of Truth）は `components[]`。射影は読み取り専用 view。snapshot / store に書き戻さない。
- 実装は in-repo、`id` → 関数のコンパイル時 registry。リポジトリ外 JS の動的 import はしない。
- 公開 API は `applyProjections(snapshot, options?)` のみ。呼び出し側は id 解決と適用を分けない。
- モジュールは `src/lib/projection/`（fs / `$env` なし）。GUI と CLI が同じパスを import できる。

## 公開 API

```ts
applyProjections(snapshot, {
  projectionIds?: readonly string[];
  pluginOptions?: Record<string, Record<string, unknown>>;
}): { view: IrProjectionView; warnings: string[] }
```

| 入力 | 挙動 |
|---|---|
| `projectionIds` 省略 / `[]` | 射影なし。`components` は元配列 |
| 未知 id | throw（fail fast） |
| 適用順 | モジュールが決める（transform → index）。カンマ順には依存しない |

`IrProjectionView` は `RestoredIrSnapshot` に opt-in キーを足した形。現状の追加キーは `componentsByLogicalId`。

## 登録済み射影

| id | kind | 効果 |
|---|---|---|
| `db-maxlength` | transform | `validation.maxlength`（文字数）がある要素に `validation.dbMaxlength` を追加。既定は 3 バイト/文字。`pluginOptions['db-maxlength'].bytesPerChar` で上書き |
| `by-logical-id` | index | `componentsByLogicalId[logicalId]`。空 id はスキップ。重複は last-wins + warning |

配列要素と map 値は同一コピーを共有する。元の `maxlength` は残す。

## 注入チャネル

最初の呼び出し元は `arcane:summon` の CLI。

```bash
npm run arcane:summon -- --target <id> --template <hbs> --source <yaml> \
  --projection by-logical-id,db-maxlength --bytes-per-char 3
```

`--projection` 省略時は射影なし（従来の context）。`application.yml` と GUI 画面のチャネルは未実装。

target 袋の flatten（`external['<targetId>']` だけ見せる）は summon の常時ステップであり、射影プラグインではない。map があるときは配列と同じ規則を掛ける。

## ハイフン付き logicalId

Handlebars のドット参照はハイフンで切れる。組み込み `lookup` を使う。

```handlebars
{{lookup componentsByLogicalId "user-name"}}
```

## 関連

- [arcane:summon](../use-cases/arcane-summon.md)
- [アーキテクチャ概要](./overview.md)
