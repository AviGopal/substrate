Add a `clamp(value: number, min: number, max: number): number` function to `src/math.ts`.

The function should return `min` if `value < min`, `max` if `value > max`, and `value` otherwise.

Also add tests for it in `src/math.test.ts`:
- `clamp(5, 1, 10)` → `5`
- `clamp(-3, 0, 100)` → `0`
- `clamp(150, 0, 100)` → `100`
- `clamp(0, 0, 0)` → `0`

Run the full test suite to confirm all existing tests still pass and the new `clamp` tests pass.
