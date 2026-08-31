# Third-party license notices in build output

Date: 2026-09-01 06:53

## Problem / goal

`npm run build` 成果物（`.svelte-kit/output`）に LICENSE / NOTICE 相当が無い。  
自コードはルート `LICENSE`（MIT）のまま、第三者（特に ISC の `yaml`）の許諾文を再配布物へ載せる方針を決める。

## Observation (current build)

- クライアント直下に出ている非ハッシュファイルは `static/robots.txt` → `client/robots.txt` のみ。
- `yaml` はサーバチャンクで `import … from "yaml"` のまま（ランタイムは `node_modules`）。クライアント JS には yaml 本体は見当たらない。
- クライアントには monaco-editor 由来（`editor.worker-*.js`, `codicon.*.ttf` 等）が入っている。
- Vite / SvelteKit 既定は許諾文をコピーしない。これは欠陥ではなく、プラグインや `static/` が無いと出ない。

## Decision (proposed)

1. 自コードのライセンスは MIT のまま。ISC への変更や MIT+ISC デュアルはしない。
2. 第三者はルート `THIRD_PARTY_NOTICES.md` に集約する（node_modules の LICENSE をビルドが自動収集する方式は採らない）。
3. 成果物への掲載は **`static/` に置く**。`vite.config.ts` も `package.json` の `build` も変更しない。

SvelteKit は `static/` をクライアント出力へコピーする（今回 `robots.txt` で確認済み）。

## Alternatives (not chosen for first slice)

- `vite.config.ts` のプラグインでルートからコピー — 単一正本にはなるが、Vite/SvelteKit config 変更の承認が要る。
- `"build": "vite build && node scripts/copy-….mjs"` — `package.json` 変更の承認が要る。`adapter-auto` ローカルでは `build/` も無い。
- license-checker 等の新規 npm 依存 — 今回は不要。

## Open

- `package.json` の `"license": "MIT"` は項目 4。1–3 の範囲外。
- argparse（Python-2.0）全文は実装時に `node_modules/argparse/LICENSE` から転記する。
