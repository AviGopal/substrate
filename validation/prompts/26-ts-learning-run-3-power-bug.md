There is a bug in `src/math.ts`. The `power(base, exp)` function always returns `0` — for example `power(2, 3)` returns `0` instead of `8`.

Identify the root cause by reading the source, fix it so all `power` tests pass, and confirm by running the test suite. Do not modify `src/math.test.ts`.
