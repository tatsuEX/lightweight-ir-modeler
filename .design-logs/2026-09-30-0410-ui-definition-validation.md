# UIDefinition validation for the property editor

Date: 2026-09-30 04:10

## Problem

The property editor does not check structural or semantic integrity of a UI definition before auto-snapshot. Examples: required `logicalId`, a shared character class, unique component `logicalId`s, and project naming rules. Invalid definitions must not become `current` or `history`.

## Approach

- Domain checks live beside the UI definition kind (`src/lib/ir/ui-definition-validation/`). Zod component parse stays permissive so in-progress edits and existing snapshots still load.
- Three layers: core rules (always), a closed declarative profile under `uiDefinition.validation` in `application.yml`, and in-repo validator plugins later. No eval, no dynamic import, no second schema library, no conditional rule DSL. The plugin host ships with the first concrete plugin, not as an empty registry.
- `logicalId` charset is `^[A-Za-z0-9_#-]+$`, shared with `isValidLogicalId`.
- Label is required except `type: unsupported`.
- Validation is debounced. When auto-save is enabled, run it at the start of the auto-save callback and ignore `uiDefinition.validation.delay`. When auto-save is disabled, use that delay (default 500ms) for feedback only. Session start validates once. Write `current` and the matching `history` file only when validation succeeds.
- Field errors use a pale red background and border. A toast fires when a scheduled write is skipped, not on every keystroke.
- History is not a draft log for failed validation. Editor restore, export, and publish keep reading `current`.

## Out of scope

Writer and export pipelines. Promoting invalid history files. A fourth IO plugin kind.
