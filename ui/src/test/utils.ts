export function round(value: number, digits = 2): number {
  return parseFloat(value.toFixed(digits));
}
