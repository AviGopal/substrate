import { describe, expect, test } from 'bun:test';
import { evaluate } from '../src/index';

describe('evaluate', () => {
  test('evaluates addition', () => {
    expect(evaluate('2 + 3')).toBe(5);
  });

  test('evaluates subtraction', () => {
    expect(evaluate('5 - 3')).toBe(2);
  });

  test('evaluates multiplication', () => {
    expect(evaluate('4 * 3')).toBe(12);
  });

  test('evaluates division', () => {
    expect(evaluate('10 / 2')).toBe(5);
  });

  test('evaluates power', () => {
    expect(evaluate('2 ^ 3')).toBe(8);
  });

  test('evaluates factorial', () => {
    expect(evaluate('factorial 5')).toBe(120);
  });

  test('throws on invalid expression', () => {
    expect(() => evaluate('invalid')).toThrow('Invalid expression');
  });

  test('throws on unknown operator', () => {
    expect(() => evaluate('2 @ 3')).toThrow('Unknown operator');
  });
});
