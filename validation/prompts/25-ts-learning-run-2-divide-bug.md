The `divide` function in `src/math.ts` is broken — it truncates floating-point results instead of returning the exact quotient.

For example, `divide(10, 4)` currently returns `2` but the test expects `2.5`.

Fix the implementation in `src/math.ts` so all `divide` tests pass. Do not modify `src/math.test.ts`. Confirm by running the tests.
