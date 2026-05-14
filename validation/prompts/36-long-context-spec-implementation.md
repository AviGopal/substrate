Read `SPEC.md` carefully. It describes a set of required changes to this TypeScript user-management library.

Implement all changes listed in the "Required Changes" section:
1. Fix `login` in `src/auth.ts` so it returns an error when the user does not exist.
2. Fix `logout` in `src/auth.ts` so it actually revokes the session.
3. Create `src/rbac.ts` with `hasScope` and `requireRole` functions.
4. Create `src/rbac.test.ts` with the unit tests described in the spec.
5. Export the new functions from `src/index.ts`.

Run `bun test` after all changes to confirm every test passes.
