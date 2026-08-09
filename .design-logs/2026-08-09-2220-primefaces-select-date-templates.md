# PrimeFaces: select / date 系 component テンプレートと shape union

- Date: 2026-08-09 22:20 (+09:00)
- Status: implemented

## Problem / goal

checkbox / radio / dropdown / 日付系の IR type を PrimeFaces Facelet へ export する。  
既存の共通 `PrimeFacesFieldShape`（id/label/hint/required のみ）では `items` や `format` を載せず、テンプレート側も空だった。

## Proposed approach

1. **shape**: `type` を discriminant とする union（共通属性 + type 別 extra）
2. **templates**: `components/<type>.hbs` に対応タグを実装（form はレイアウトのみ）
3. **Raw 写像**: `mapComponentToRawField` が `items` / `format` / `placeholder` / `clearable` / `rows` / `cols` を通す

## Tag mapping

| IR type | Tag | Key attrs |
|---|---|---|
| checkbox | `p:selectManyCheckbox` | `layout="lineDirection"`, `f:selectItem` |
| radio | `p:selectOneRadio` | same |
| dropdown | `p:selectOneMenu` | `f:selectItem` |
| dropdown-multi | `p:selectManyMenu` | `showCheckbox="true"` |
| datepicker | `p:datePicker` | `pattern` |
| date-span | `p:datePicker` | `selectionMode="range"` |
| datetimepicker | `p:datePicker` | `showTime="true"` |
| timepicker | `p:datePicker` | `timeOnly="true"` |

参照: [SelectOneRadio](https://primefaces.github.io/primefaces/15_0_0/#/components/selectoneradio), [SelectOneMenu](https://primefaces.github.io/primefaces/15_0_0/#/components/selectonemenu), [SelectManyMenu](https://primefaces.github.io/primefaces/15_0_0/#/components/selectmanymenu), [DatePicker](https://primefaces.github.io/primefaces/15_0_0/#/components/datepicker), Showcase manyCheckbox / oneRadio / oneMenu / manyMenu / datePicker

## Key decisions

- value / EL binding は IR 非搭載方針のためテンプレートに載せない（属性と選択肢の静的スケルトンのみ）
- `clearable` → `showButtonBar="true"`（PrimeFaces のクリア UI に寄せる）
- shape にベンダー tag 名は持たない（既存設計ログ方針を維持）
- `form.hbs` に `xmlns:f` を追加

## Out of scope

- mindate / maxdate の EL 写像
- select の layout / columns カスタマイズ UI
- Bean バインド属性の生成
