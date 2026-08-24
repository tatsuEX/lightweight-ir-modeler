# IR snapshot YAML comments: locked granularity

Date: 2026-08-24 23:50

## Locked decisions

Follow-up to `2026-08-24-2137-snapshot-yaml-operational-comments.md`.

1. **Editor**: Monaco from Phase 1. Modal only. Language `markdown` (built-in highlighter).
2. **Body format**: Markdown. YAML `#` is the comment marker; the body after `#` is Markdown (headings become `# # Title` in the file).
3. **Array comments**: one comment **per `components[]` element**, immediately before that element — not one comment before the `components` key.
4. **Commentable UI targets only**:
   - `UiDefinitionMetaAccordion` as a whole → YAML path `uiDefinition`
   - each component row → YAML path `components[i]` (seq item `commentBefore`)
   - **external**: any path under `uiDefinition.external` or `components[i].external`
5. **After save**: items that already have a comment show a Markdown preview tooltip on hover and focus.

## YAML shape (intent)

```yaml
# 画面全体の運用メモ
uiDefinition:
  logicalId: userRegistration
  external:
    # target 残余
    im-forma:
      importBase: {}
components:
  - # ユーザー ID。ログイン必須
    logicalId: userId
    type: textbox
  - # 表示専用
    logicalId: userName
    type: label
```

Exact seq-item comment placement (`#` before `-` vs after `-`) is locked by unit tests against eemeli/yaml stringify.
