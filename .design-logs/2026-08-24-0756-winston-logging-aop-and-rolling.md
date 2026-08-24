# Winston ロギング追記: ファイル別 rolling と AOP の射程

Date: 2026-08-24 07:56

## Updates from review

- ローテータは `@depup/winston-daily-rotate-file`（追加済み）。
- ログ本文はテキスト形式。
- info ファイルは `info` + `warn`。error ファイルは `error`。
- **info / error で rolling policy を独立**させる。
- 成功ログを「パイプライン」に出すか「HTTP hook」に出すかは、用語説明のあとユーザーが決める。

## File config（rolling を appender ごとへ）

```yaml
logging:
  level: info
  console:
    enabled: true
  file:
    dir: ./logs
    info:
      enabled: true
      filename: info.log
      rolling: daily          # daily | monthly | none
      maxFiles: 14d
    error:
      enabled: true
      filename: error.log
      rolling: monthly
      maxFiles: '12'
```

共通 `file.rolling` は置かない。各 appender が `rolling` / `maxFiles` / `filename` / `enabled` を持つ。

## HTTP hook とパイプライン

Export の実際の流れ:

```text
ブラウザ
  → POST /api/ui/export          ← +server.ts（HTTP 入口）
      → exportFromEditorState()  ← export-pipeline.ts（ドメイン処理）
          → transform / validate / write
```

- **HTTP hook** (`src/hooks.server.ts`): すべてのリクエストの外側。method / path / status / 所要時間。IR の target や logicalId は知らない。snapshot 自動保存の連打もすべて載る。
- **パイプライン**: Import / Export / snapshot 書込など、業務の入口関数。target / logicalId をログに載せられる。HTTP になる前に 403/400 で弾かれたリクエストはここまで来ない。

`+server.ts` は例外を catch して JSON 400/500 に変換することが多い。hook から見ると「return」であり「throw」ではない。パイプラインを wrap すると、検証失敗や I/O 失敗は本当の throw として取れる。

## AOP (before / return / throw)

全関数への自動織り込み（AspectJ）は困難（コンパイラプラグインが必要、YAGNI）。

射程を限れば容易:

| 手段 | before / return / throw | 自動適用範囲 |
|---|---|---|
| `hooks.server.ts` | HTTP の入出力。throw は未処理例外のみ | 全ルート |
| `withLogged(fn)` でパイプライン入口を包む | その関数の3点 | 包んだ関数だけ |
| クラスメソッドデコレータ | 同様 | クラス化が必要。現状は関数中心 |
| 全 export の自動 Proxy / バイトコード織り込み | 可能だが重い | 不採用 |

推奨: Filter 相当 = HTTP hook、`@Around` on service 相当 = パイプライン入口の `withLogged`。内部の Reader/Writer まで自動注入しない。
