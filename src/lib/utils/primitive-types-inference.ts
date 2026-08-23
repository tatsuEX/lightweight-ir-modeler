
import { deepCopy } from "./object-utils";

function asNullable<T>(
  value: unknown,
  typeGuard: (v: unknown) => v is T,
  castMethod?: (v: unknown) => T | null
): T | null {
  if (value == null) {
    return null;
  }

  if (typeGuard(value)) {
    return value;
  }

  if (castMethod) {
    return castMethod(value);
  }

  return null;
}

//  string
// ============================================================================

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// export function asString(value: unknown): string | null {
//   return asNullable(value, isString, (v) => {
//     if (v && isObject(v)) {
//       return JSON.stringify(v);
//     }
//     return String(v);
//   });
// }

//  number
// ============================================================================

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function asNumber(value: unknown): number | null {
  return asNullable(value, isNumber, (v) => isNaN(Number(v)) ? null : Number(v));
}

//  Array
// ============================================================================

/**
 * lengthの要素数まで、paddingを埋めて拡張した新しい配列を返す
 *
 * paddingArray(asArray<U>(someAry \/\* maybe null or undefined \*\/), 12, { foo: 'Foo', bar: 999 });
 * @param srcArray  追加元配列
 * @param length    追加後の配列サイズ
 * @param padding   追加要素のデフォルト構造
 * @returns
 */
export function paddingArray<T>(srcArray: T[], length: number, padding: T): T[] {
	const newArray = [...srcArray];
  while (newArray.length < length) {
    newArray.push(deepCopy(padding));
  }
	return newArray;
}

/**
 *
 * @param value
 * @returns
 * @warn 型パラメータを呼び出し側で指定した場合は、型安全性を保証できない
 */
export function asArray<T>(value: unknown): T[] {
	return Array.isArray(value) ? value : [];
}


//  Object
// ============================================================================

