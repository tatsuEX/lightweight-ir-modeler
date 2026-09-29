# Client Session Repository

Date: 2026-09-30

## Problem / goal

Vite HMR remounts `src/routes/layout-editor/+layout.svelte`. Each mount used to construct a new `UIDefinition` and seed it from the original layout load, so in-memory edits disappeared. `server.hmr: false` was a temporary workaround.

Keep layout-editor edit state for the lifetime of one browser tab, and reattach the same instances through Svelte context after a remount.

## Approach

- In-tab `Map` keyed by `sessionId + logicalId + version`.
- `sessionId` comes from `nanoid()`, stored only in `sessionStorage`. The UI IR body stays in memory. A full reload still seeds from the autosaved snapshot.
- An empty screen id uses a `draft:<nanoid>` key. Committing a new id rekeys that entry and keeps components. Opening an existing snapshot writes that payload into its slot (disk wins) and makes it active.
- HMR reuses the active object and does not reseed.
- Svelte context is set only by a small scope component. Pages keep using `get*Context`.
- TTL is `layoutEditor.clientSession.maxLifetimeMs` (default 12 hours), checked on access.

## Future boundary (not implemented)

The same key and `acquire` / `rekey` / `evictExpired` operations are the extension point. A later server host can replace the in-memory map without changing callers.

- Reload of unsaved edits: a server store can return the bundle for `sessionId`.
- Multi-user: different `sessionId` values keep UI context apart for the same `logicalId + version`.
- Two tabs: each tab has its own `sessionStorage` id. Whether one person shares a server session is a later decision.
- Edit conflicts stay last-write-wins on the snapshot file. Locks and optimistic revision checks are not part of this repository.
- One TTL setting. Do not add a second browser-vs-server lifetime.

## Out of scope

Property column filters, row selection, accordion open state, snapshot lock tokens, and sending `sessionId` on the autosave POST.
