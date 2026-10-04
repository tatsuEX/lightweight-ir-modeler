# Writer pipeline

Date: 2026-09-30 08:02

## Problem

Export は UI IR を Raw に変換し、境界で検証してから外部定義を書く。Raw から外部定義へ寄せる処理が一つの関数に混ざると、どこで壊れたか分からない。射影は IR の読み取り専用 view であり、この変換とは別である。

## Approach

- 操作対象は Raw の先にある作業文書だけとする。UI IR と snapshot には書かない。同じ UI IR からは同じ作業文書になる。
- 前段の検証は、pipeline を始めてよいかを見る既存の Raw 検証のままとする。後段の検証は、外部定義として書けるかを見る opt-in とする。作業文書を書き換えない target は前段だけでよい。
- 各 step は namespace 付きの id を持ち、正常終了時だけ context の passed steps に自分の id を足す。前提は passed steps を見る。
- 変更は JSON Pointer（RFC 6901）と理由を渡す mutate だけが行う。同一 pointer は 1 件に畳み、before は最初の値、after と reason は最終更新とする。作業文書はその場で更新する。pointer のフィールド同一性は logicalId とする。
- 例外または error diagnostic で pipeline を止め、ファイルは書かない。warn だけのときは書き、呼び出し元へ返す。
- step 内だけで使う累積は context に載せない。射影 view は今は渡さない。後から context に足しても step の入口は apply(context) のままにする。
- 例として `example-target/resolve-items` のような id を使う。実在する target の step 一覧やフィールド名はここでは扱わない。

## Out of scope

射影 plugin の変更。コード生成 CLI への流用。snapshot への mutation 永続化。設定ファイルからの step 注入。
