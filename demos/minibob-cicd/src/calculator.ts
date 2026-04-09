/**
 * Simple calculator module for demonstrating CI/CD with MiniBob.
 *
 * This module intentionally has room for bugs to be introduced
 * so MiniBob can demonstrate automatic remediation.
 */

export interface CalculationResult {
  value: number;
  operation: string;
  inputs: number[];
}

export function add(a: number, b: number): CalculationResult {
  return {
    value: a + b,
    operation: 'add',
    inputs: [a, b],
  };
}

export function subtract(a: number, b: number): CalculationResult {
  return {
    value: a - b,
    operation: 'subtract',
    inputs: [a, b],
  };
}

export function multiply(a: number, b: number): CalculationResult {
  return {
    value: a * b,
    operation: 'multiply',
    inputs: [a, b],
  };
}

export function divide(a: number, b: number): CalculationResult {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return {
    value: a / b,
    operation: 'divide',
    inputs: [a, b],
  };
}

export function power(base: number, exponent: number): CalculationResult {
  return {
    value: Math.pow(base, exponent),
    operation: 'power',
    inputs: [base, exponent],
  };
}

export function factorial(n: number): CalculationResult {
  if (n < 0) {
    throw new Error('Factorial of negative number');
  }
  if (!Number.isInteger(n)) {
    throw new Error('Factorial requires integer input');
  }

  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return {
    value: result,
    operation: 'factorial',
    inputs: [n],
  };
}

export function squareRoot(n: number): CalculationResult {
  if (n < 0) {
    throw new Error('Cannot calculate square root of negative number');
  }
  return {
    value: Math.sqrt(n),
    operation: 'sqrt',
    inputs: [n],
  };
}

export function percentage(value: number, percent: number): CalculationResult {
  // Calculate percentage of a value
  return {
    value: (value * percent) / 100,
    operation: 'percentage',
    inputs: [value, percent],
  };
}

export function modulo(a: number, b: number): CalculationResult {
  if (b === 0) {
    throw new Error('Modulo by zero');
  }
  return {
    value: a % b,
    operation: 'modulo',
    inputs: [a, b],
  };
}