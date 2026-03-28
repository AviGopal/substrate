/**
 * Simple calculator with an intentional bug for testing
 * Bug: Division by zero is not handled
 */

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  // BUG: No check for division by zero
  divide(a: number, b: number): number {
    return a / b; // Returns Infinity when b = 0, should throw error
  }

  // BUG: Power function has wrong logic for negative exponents
  power(base: number, exponent: number): number {
    if (exponent === 0) return 1;
    if (exponent < 0) {
      // Wrong: Should be 1 / (base ** Math.abs(exponent))
      return base ** exponent; // This returns wrong results
    }
    return base ** exponent;
  }
}

// Example usage that demonstrates the bugs
const calc = new Calculator();
console.log(calc.divide(10, 0)); // Should throw, but returns Infinity
console.log(calc.power(2, -2)); // Should return 0.25, returns wrong value
