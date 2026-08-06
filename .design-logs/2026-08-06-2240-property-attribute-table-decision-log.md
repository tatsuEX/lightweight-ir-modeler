# Property 属性テーブル — 設計経緯（2026-08-06）

- Source chat: [Property attribute table](7b46aa60-e40c-427a-b3a8-a3fe19ca2ea7)

## Problem

layout-editor で `UIDefinition.components` の共通属性を編集するデータテーブルを置く。

## Decisions

1. 置き場所: `/layout-editor/property`（Layout の DnD は触らない）
2. 初期シード・追加ボタンなし。0件時は空状態メッセージ
3. 案の推移: v1 直書き MVP → v2 列ディスクリプタ（将来グループ切替用）→ **v3 直書き+UX優先（採用）**
4. 将来の basic/option/validation 切替は、その時点で再設計

## Snapshots

- `2026-08-06-2243-property-attribute-table-v1-mvp.md`
- `2026-08-06-2250-property-attribute-table-v2-column-descriptors.md`
- `2026-08-06-2253-property-attribute-table-v3-ux-hardcoded.md`
