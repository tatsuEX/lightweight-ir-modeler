# IR 射影プラグイン（opt-in）

Date: 2026-09-01 08:04

Related: `.cursor/rules/16-plugins.mdc`, `.design-logs/2026-09-01-0733-rules-projection-and-writer-filters.md`

## Problem / goal

`components[]` が配列 SSOT のため、Handlebars / `arcane:summon` は `#each` 以外で logicalId 参照できない。  
SQL 生成では `validation.maxlength`（文字数）をマルチバイト列長へ変形したい。  
IR は書き換えず、GUI/CLI が同じモジュールを import できる読み取り専用 view を opt-in で足す。

## Proposed approach

- 公開 API は `applyProjections(snapshot, options?)` のみ（`$lib/projection`、fs / `$env` なし）
- 具象: `db-maxlength`（`validation.dbMaxlength` を追加、既定 3 バイト/文字）と `by-logical-id`（`componentsByLogicalId`）
- 適用順はモジュールが決める（変更系 → 索引系）
- 最初の注入チャネルは CLI `--projection` / `--bytes-per-char`
- summon の target 残余投影は常時ステップのまま。map があるときは配列と同じ規則を掛ける

## Out of scope

- writer-filter / Export Handlebars 配線 / `application.yml` / GUI summon UI / snapshot への map 永続化
