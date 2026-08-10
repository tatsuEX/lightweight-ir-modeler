# Import logicalId 表示不整合 / config・parse 境界の見直し

日付: 2026-08-10 12:44

## 問題 / ゴール

1. config 関連モジュールの配置意図を明確化する
2. `parse-xml` に混入した Faces 固有知識を境界として整理する
3. PrimeFaces 取り込み後に `uiDefinition.logicalId`（`h:form` の `id`）が UI に反映されないように見える原因を特定し、修正方針を決める

## 調査結果

### 1. config 配置

| パス | 実際の役割 |
|---|---|
| `src/lib/config/` | **クライアントからも import 可能な** 断片（例: `DEFAULT_ITEM_DELIMITER`、`PreviewConfig` 型と `resolvePreviewSelect`）。`application.yml` 全体の type SSOT ではない |
| `src/lib/server/config/application-config.ts` | YAML 読込 / profile merge / 正規化パース / キャッシュ / パス解決。フロント向け HTTP Facade ではない。SSR・API・IO が呼ぶ **server loader** |
| `config/*.yml` | 実行時設定の実体 |

「この 1 ファイルでなければならない」強い必然はない。現状はロード経路を 1 箇所に閉じるための pragmatic な同居。

### 2. parse-xml

- 責務の意図: preserveOrder 付き XML → 順序付き JS ツリー（serialize の対）
- `isArray: tagName === 'f:selectItem'` は Faces 知識。コメント上も preserveOrder 以外向けの保険で、現行経路では不要寄り
- 将来拡張を考えると、汎用 `parse-xml` から Faces 固有オプションを外すのが望ましい

### 3. logicalId が「読み込めていない」ように見える原因

Import パイプライン（unshape → validate → transform → API → `loadImported`）は `h:form[@id]` → `uiDefinition.logicalId` を通している（unit / roundtrip spec でも確認済み）。

UI 側の不整合:

- `UiDefinitionMetaAccordion` は `logicalIdInput` を **マウント時の初期値だけ** store から取り、以降 `loadImported` / `loadSnapshot` で store が変わっても同期しない
- Input は `logicalIdInput` に bind されているため、画面上の ID 欄が古いまま
- blur / 候補選択で `commitLogicalIdInput` が走ると、**古い入力値で store の logicalId を上書き**し得る

なお参照タグは標準的に `h:form`（`f:form` ではない）。Export / unshape / 設計ログも `h:form` 前提。

## 提案アプローチ

### A. logicalId UI 同期（要修正）

`UiDefinitionMetaAccordion` で store → 入力バッファを同期する:

```ts
$effect(() => {
  logicalIdInput = uiDefinition.logicalId;
});
```

または `loadImported` 後に明示同期するコールバック / イベント。最小は `$effect`。

回帰: import 後に ID 欄と accordion ヘッダが同じ新 logicalId になること。blur しても旧値に戻らないこと。

### B. parse 境界

推奨（小さく）:

1. `parse-xml.ts` から `isArray`（`f:selectItem`）を削除し汎用化
2. 必要なら `parse-facelet-xml.ts`（または `primefaces` 専用 factory）で Faces 向けオプションを渡す
3. Reader は専用 parse を呼ぶ

`preserveOrder` 経路では子は常に配列なので、現行 unshape は `isArray` なしでも動く想定。削除前に selectItem 1 件の fixture で確認。

### C. application-config 分割（任意・後追い可）

必須ではない。分割するなら例:

| モジュール | 責務 |
|---|---|
| `src/lib/config/application-types.ts`（任意） | 共有したい type のみ |
| `src/lib/server/config/application-config-io.ts` | YAML 読込・merge・cache・`loadApplicationConfig` |
| `src/lib/server/config/application-config-parse.ts` | mapping → `ApplicationConfig` |
| 既存 `src/lib/config/*` | クライアント安全な定数・preview ヘルパ |

現状維持も可。分割する理由は可読性であり、アーキテクチャ上の必須ではない。

## 未決事項

- parse リネームを `facelet` にするか `primefaces` 専用のままにするか（IM-Forma は JSON なので XML parse を共有しない）
- config 分割を今やるか、logicalId 修正だけ先に出すか
