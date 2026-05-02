import { test, expect } from "bun:test";
import { add, subtract } from "./math";

test("add", () => {
  expect(add(2, 3)).toBe(5);
  expect(add(0, 0)).toBe(0);
});

test("subtract", () => {
  expect(subtract(5, 2)).toBe(3);
});
