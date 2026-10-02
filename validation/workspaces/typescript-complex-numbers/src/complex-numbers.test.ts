import { describe, test, expect } from "bun:test";
import { ComplexNumber } from "./complex-numbers";

describe("Complex numbers", () => {
  test("Real part of a purely real number", () => {
    expect(new ComplexNumber(1, 0).real).toEqual(1);
  });

  test("Real part of a purely imaginary number", () => {
    expect(new ComplexNumber(0, 1).real).toEqual(0);
  });

  test("Real part of a number with real and imaginary part", () => {
    expect(new ComplexNumber(1, 2).real).toEqual(1);
  });

  test("Imaginary part of a purely real number", () => {
    expect(new ComplexNumber(1, 0).imag).toEqual(0);
  });

  test("Imaginary part of a purely imaginary number", () => {
    expect(new ComplexNumber(0, 1).imag).toEqual(1);
  });

  test("Imaginary part of a number with real and imaginary part", () => {
    expect(new ComplexNumber(1, 2).imag).toEqual(2);
  });

  test("Add purely real numbers", () => {
    expect(new ComplexNumber(1, 0).add(new ComplexNumber(2, 0))).toEqual(
      new ComplexNumber(3, 0)
    );
  });

  test("Add purely imaginary numbers", () => {
    expect(new ComplexNumber(0, 1).add(new ComplexNumber(0, 2))).toEqual(
      new ComplexNumber(0, 3)
    );
  });

  test("Add numbers with real and imaginary part", () => {
    expect(new ComplexNumber(1, 2).add(new ComplexNumber(3, 4))).toEqual(
      new ComplexNumber(4, 6)
    );
  });

  test("Subtract purely real numbers", () => {
    expect(new ComplexNumber(1, 0).sub(new ComplexNumber(2, 0))).toEqual(
      new ComplexNumber(-1, 0)
    );
  });

  test("Subtract purely imaginary numbers", () => {
    expect(new ComplexNumber(0, 1).sub(new ComplexNumber(0, 2))).toEqual(
      new ComplexNumber(0, -1)
    );
  });

  test("Subtract numbers with real and imaginary part", () => {
    expect(new ComplexNumber(1, 2).sub(new ComplexNumber(3, 4))).toEqual(
      new ComplexNumber(-2, -2)
    );
  });

  test("Multiply purely real numbers", () => {
    expect(new ComplexNumber(1, 0).mul(new ComplexNumber(2, 0))).toEqual(
      new ComplexNumber(2, 0)
    );
  });

  test("Multiply imaginary unit", () => {
    expect(new ComplexNumber(0, 1).mul(new ComplexNumber(0, 1))).toEqual(
      new ComplexNumber(-1, 0)
    );
  });

  test("Multiply purely imaginary numbers", () => {
    expect(new ComplexNumber(0, 1).mul(new ComplexNumber(0, 2))).toEqual(
      new ComplexNumber(-2, 0)
    );
  });

  test("Multiply numbers with real and imaginary part", () => {
    expect(new ComplexNumber(1, 2).mul(new ComplexNumber(3, 4))).toEqual(
      new ComplexNumber(-5, 10)
    );
  });

  test("Divide purely real numbers", () => {
    expect(new ComplexNumber(1, 0).div(new ComplexNumber(2, 0))).toEqual(
      new ComplexNumber(0.5, 0)
    );
  });

  test("Divide purely imaginary numbers", () => {
    expect(new ComplexNumber(0, 1).div(new ComplexNumber(0, 2))).toEqual(
      new ComplexNumber(0.5, 0)
    );
  });

  test("Divide numbers with real and imaginary part", () => {
    expect(new ComplexNumber(1, 2).div(new ComplexNumber(3, 4))).toEqual(
      new ComplexNumber(0.44, 0.08)
    );
  });

  test("Absolute value of a positive purely real number", () => {
    expect(new ComplexNumber(5, 0).abs).toEqual(5);
  });

  test("Absolute value of a negative purely real number", () => {
    expect(new ComplexNumber(-5, 0).abs).toEqual(5);
  });

  test("Absolute value of a purely imaginary number with positive imaginary part", () => {
    expect(new ComplexNumber(0, 5).abs).toEqual(5);
  });

  test("Absolute value of a purely imaginary number with negative imaginary part", () => {
    expect(new ComplexNumber(0, -5).abs).toEqual(5);
  });

  test("Absolute value of a number with real and imaginary part", () => {
    expect(new ComplexNumber(3, 4).abs).toEqual(5);
  });

  test("Conjugate a purely real number", () => {
    expect(new ComplexNumber(5, 0).conj).toEqual(new ComplexNumber(5, 0));
  });

  test("Conjugate a purely imaginary number", () => {
    expect(new ComplexNumber(0, 5).conj).toEqual(new ComplexNumber(0, -5));
  });

  test("Conjugate a number with real and imaginary part", () => {
    expect(new ComplexNumber(1, 1).conj).toEqual(new ComplexNumber(1, -1));
  });

  test("Euler's identity/formula", () => {
    const result = new ComplexNumber(0, Math.PI).exp;
    expect(result.real).toBeCloseTo(-1);
    expect(result.imag).toBeCloseTo(0);
  });

  test("Exponential of 0", () => {
    const result = new ComplexNumber(0, 0).exp;
    expect(result.real).toBeCloseTo(1);
    expect(result.imag).toBeCloseTo(0);
  });

  test("Exponential of a purely real number", () => {
    const result = new ComplexNumber(1, 0).exp;
    expect(result.real).toBeCloseTo(Math.E);
    expect(result.imag).toBeCloseTo(0);
  });

  test("Exponential of a number with real and imaginary part", () => {
    const result = new ComplexNumber(Math.LN2, Math.PI).exp;
    expect(result.real).toBeCloseTo(-2);
    expect(result.imag).toBeCloseTo(0);
  });
});
