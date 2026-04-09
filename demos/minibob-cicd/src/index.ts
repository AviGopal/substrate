/**
 * MiniBob CI/CD Demo
 *
 * This module exports all calculator functions and provides
 * a simple CLI interface for testing.
 */

export * from './calculator';

import { add, subtract, multiply, divide, power, factorial, squareRoot, percentage, modulo } from './calculator';

export function evaluate(expression: string): number {
  // Simple expression parser for demo purposes
  const parts = expression.trim().split(/\s+/);

  // Handle unary operations
  if (parts.length === 2) {
    const op = parts[0];
    const value = parseFloat(parts[1]);

    switch (op) {
      case 'factorial': return factorial(parseInt(parts[1], 10)).value;
      case 'sqrt': return squareRoot(value).value;
      default:
        throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  if (parts.length !== 3) {
    throw new Error(`Invalid expression: ${expression}`);
  }

  const [left, op, right] = parts;
  const a = parseFloat(left);
  const b = parseFloat(right);

  switch (op) {
    case '+': return add(a, b).value;
    case '-': return subtract(a, b).value;
    case '*': return multiply(a, b).value;
    case '/': return divide(a, b).value;
    case '^': return power(a, b).value;
    case '%': return percentage(a, b).value;
    case 'mod': return modulo(a, b).value;
    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}
