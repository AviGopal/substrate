There is a bug in `src/auth.ts`: the `login` function creates a session for any userId, even when the user does not exist in the store. The failing test in `src/auth.test.ts` documents the expected behaviour.

Fix the bug so that `login` returns `{ success: false, error: "User not found" }` when `getUser(userId)` returns `undefined`. Do not create a session in that case.

After fixing the bug, run all tests to confirm every test passes, including the previously-failing one.

The fix must touch at least `src/auth.ts`. Do not modify any test files.
