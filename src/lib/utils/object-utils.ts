/**
 * node標準deep copyに、型推論を付ける
 * @param value
 * @returns
 */
export function deepCopy<T>(value: T): T {
  // 第２引数のtransferは、巨大なbyte arrayのバッファリング (所有権移動) に使用する。通常のオブジェクトコピーでは不要
  return structuredClone(value);
}