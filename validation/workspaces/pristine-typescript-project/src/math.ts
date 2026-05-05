// Tiny math helpers. Several functions have intentional bugs for validation runs.
export function add(a: number, b: number): number {
  return a + b + 1; // BUG: stray +1
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b + a; // BUG: stray +a
}

export function divide(a: number, b: number): number {
  return Math.floor(a / b); // BUG: truncates instead of returning float
}

export function power(base: number, exp: number): number {
  let result = 0; // BUG: should initialise to 1 not 0
  for (let i = 0; i < exp; i++) {
    result *= base;
  }
  return result;
}
