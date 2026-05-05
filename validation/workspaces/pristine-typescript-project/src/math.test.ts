import { test, expect } from "bun:test";
import { add, subtract, multiply, divide, power } from "./math";

test("add", () => {
  expect(add(2, 3)).toBe(5);
  expect(add(0, 0)).toBe(0);
});

test("subtract", () => {
  expect(subtract(5, 2)).toBe(3);
});

test("multiply", () => {
  expect(multiply(3, 4)).toBe(12);
  expect(multiply(0, 5)).toBe(0);
  expect(multiply(2, 2)).toBe(4);
});

test("divide", () => {
  expect(divide(10, 4)).toBe(2.5);
  expect(divide(6, 3)).toBe(2);
  expect(divide(7, 2)).toBe(3.5);
});

test("power", () => {
  expect(power(2, 3)).toBe(8);
  expect(power(3, 2)).toBe(9);
  expect(power(5, 0)).toBe(1);
});
