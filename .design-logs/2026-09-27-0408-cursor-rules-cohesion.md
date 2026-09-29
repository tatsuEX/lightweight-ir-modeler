# Cursor Rules の凝集と現行スコープ

日付: 2026-09-27 04:08

## Problem / goal

設計と生成の判断が、常時注入されるルールの重複と、現状と食い違う延期リストで揺れていた。alwaysApply を「1 制約 1 箇所」に寄せ、直近で扱う projection / writer-filter / Domain validation / IR schema migration をスコープ内に戻す。

## Proposed approach（採用）

- `01` に呼び出し側の知識とモジュール配置を統合し、`13` と `14` は削除。config のファイル対応表は `config-visibility.mdc`（glob）。
- `03` は現行境界。種類の定義は繰り返さず、実行の形は `16` が正本。
- projection と writer-filter は複数段を指定して実行する。writer-filter は Raw 検証のあと指定順。adapter-target は、その import / export で選んだ target を一度だけ実行し、別 target を段として連結しない。
- Domain validation と IR schema migration はスコープ内。専用ルールファイルは最初の実装と一緒に切る。ルール DSL、汎用移行フレームワーク、イベントバス、Undo コマンドスタック、汎用 service 層、リポジトリ外プラグイン、3 ホストが共有する前の Plugin 基底クラスは対象外。
- 日誌と docs の書式全文は glob（`articles-format.mdc`、`docs-format.mdc`）。常時は `records.mdc` の「いつ書くか」と最小骨格。
- git / npm / ホームパス / 未承認ファイルは `agent-ops.mdc`。Svelte は `**/*.svelte` ほかの glob。
- Core / adapter 文書の境界は `02`。

## Key decisions

- 番号 `00`–`04`、`08`、`15`、`16` はリネームしない。
- 射影の段順は、実装済み契約（モジュールが transform → index を決める。カンマ順には依存しない）をこの改訂では変えない。ルールが新たに要求するのは「複数段を指定し、指定した段を実行できる」こと。
- 過去の `.articles/` と `.design-logs/` にある旧ファイル名の参照は履歴として残す。生きた `docs/` の参照だけ新ファイル名に更新する。
