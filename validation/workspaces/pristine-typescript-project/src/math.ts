// Tiny math helpers. There is an intentional off-by-one bug in `add`.
export function add(a: number, b: number): number {
  return a + b + 1; // BUG: stray +1
}

export function subtract(a: number, b: number): number {
  return a - b;
}
