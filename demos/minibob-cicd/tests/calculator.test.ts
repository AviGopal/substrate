import { describe, expect, test } from 'bun:test';
import { add, subtract, multiply, divide, power, factorial, squareRoot, percentage, modulo } from '../src/calculator';

describe('Calculator', () => {
  describe('add', () => {
    test('adds two positive numbers', () => {
      const result = add(2, 3);
      expect(result.value).toBe(5);
      expect(result.operation).toBe('add');
    });

    test('adds negative numbers', () => {
      const result = add(-2, -3);
      expect(result.value).toBe(-5);
    });

    test('adds zero', () => {
      const result = add(5, 0);
      expect(result.value).toBe(5);
    });

    // Regression test: Ensure add doesn't use subtraction
    test('addition is not subtraction - regression test', () => {
      // This test specifically prevents the bug where add() was using a - b
      const result = add(10, 3);
      expect(result.value).toBe(13); // Should be 10 + 3 = 13, not 10 - 3 = 7
      expect(result.value).not.toBe(7); // Explicitly ensure it's not subtraction
    });
  });

  describe('subtract', () => {
    test('subtracts two numbers', () => {
      const result = subtract(5, 3);
      expect(result.value).toBe(2);
    });

    test('handles negative result', () => {
      const result = subtract(3, 5);
      expect(result.value).toBe(-2);
    });
  });

  describe('multiply', () => {
    test('multiplies two numbers', () => {
      const result = multiply(4, 3);
      expect(result.value).toBe(12);
    });

    test('multiplies by zero', () => {
      const result = multiply(5, 0);
      expect(result.value).toBe(0);
    });

    test('multiplies negative numbers', () => {
      const result = multiply(-2, 3);
      expect(result.value).toBe(-6);
    });
  });

  describe('divide', () => {
    test('divides two numbers', () => {
      const result = divide(10, 2);
      expect(result.value).toBe(5);
    });

    test('handles decimal result', () => {
      const result = divide(5, 2);
      expect(result.value).toBe(2.5);
    });

    test('throws on division by zero', () => {
      expect(() => divide(5, 0)).toThrow('Division by zero');
    });
  });

  describe('power', () => {
    test('calculates power', () => {
      const result = power(2, 3);
      expect(result.value).toBe(8);
    });

    test('handles zero exponent', () => {
      const result = power(5, 0);
      expect(result.value).toBe(1);
    });

    test('handles negative exponent', () => {
      const result = power(2, -1);
      expect(result.value).toBe(0.5);
    });
  });

  describe('factorial', () => {
    test('calculates factorial of 5', () => {
      const result = factorial(5);
      expect(result.value).toBe(120);
    });

    test('calculates factorial of 0', () => {
      const result = factorial(0);
      expect(result.value).toBe(1);
    });

    test('calculates factorial of 1', () => {
      const result = factorial(1);
      expect(result.value).toBe(1);
    });

    test('throws on negative input', () => {
      expect(() => factorial(-1)).toThrow('Factorial of negative number');
    });

    test('throws on non-integer input', () => {
      expect(() => factorial(2.5)).toThrow('Factorial requires integer input');
    });
  });

  describe('squareRoot', () => {
    test('calculates square root', () => {
      const result = squareRoot(16);
      expect(result.value).toBe(4);
      expect(result.operation).toBe('sqrt');
    });

    test('handles perfect squares', () => {
      expect(squareRoot(25).value).toBe(5);
      expect(squareRoot(9).value).toBe(3);
    });

    test('handles decimal results', () => {
      const result = squareRoot(2);
      expect(result.value).toBeCloseTo(1.414, 2);
    });

    test('throws on negative numbers', () => {
      expect(() => squareRoot(-1)).toThrow('Cannot calculate square root of negative number');
    });
  });

  describe('percentage', () => {
    test('calculates 10% of 100', () => {
      const result = percentage(100, 10);
      expect(result.value).toBe(10);
      expect(result.operation).toBe('percentage');
    });

    test('calculates 25% of 200', () => {
      expect(percentage(200, 25).value).toBe(50);
    });

    test('calculates 15% of 80', () => {
      expect(percentage(80, 15).value).toBe(12);
    });

    test('handles zero percent', () => {
      expect(percentage(100, 0).value).toBe(0);
    });
  });

  describe('modulo', () => {
    test('calculates modulo', () => {
      const result = modulo(10, 3);
      expect(result.value).toBe(1);
      expect(result.operation).toBe('modulo');
    });

    test('handles even division', () => {
      expect(modulo(10, 5).value).toBe(0);
    });

    test('handles larger divisor', () => {
      expect(modulo(5, 10).value).toBe(5);
    });

    test('throws on modulo by zero', () => {
      expect(() => modulo(10, 0)).toThrow('Modulo by zero');
    });
  });
});
