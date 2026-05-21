# Proposal: identity-vessel Auth Fixes (unblock team-lead rubric)

## Why

The team-lead rubric apply (iter 5 of the standalone-product loop)
hit three catastrophic blockers — two in identity-vessel, one in
cloud-dashboard. This change fixes them.

1. **Signup is broken.** `POST /v1/auth/signup` returns 500
   `PERSIST_FAILED` for any payload:
   ```
   "Couldn't coerce value for field `org_id` of
    `organizations:<slug>`: Expected `string` but found
    `organizations:<slug>`"
   ```
   Root cause: `repos/identity-vessel/src/resolvers/login.ts:334`
   constructs `orgRef = "organizations:" + slug` (a string) and
   passes it to `CREATE users SET org_id = $org_id;`. The
   `users.org_id` column is `TYPE record(organizations)`; bound
   parameters with that shape do not auto-coerce. The fix is
   `type::thing($org_id)` in the SQL.

2. **JWT alg mismatch.** `src/services/jwt.ts:152` signs with
   HS512 (intentional — matches SurrealDB's `apikey_token`
   access). `src/resolvers/auth.ts:92` verifies with HS256.
   Tokens minted via `/v1/jwt/generate` (HS512) are rejected by
   `/v1/auth/me` and any other consumer of `resolveAuthentication`.

3. **Dashboard auth token in sessionStorage.** Playwright
   `storageState` can't pre-populate sessionStorage. **Revised
   approach during apply (2026-05-20):** the dashboard's
   CLAUDE.md explicitly chose sessionStorage *for XSS
   protection* (Design Principle #6). Mirroring into
   localStorage would weaken that posture for every user. The
   rubric seed will use Playwright's `page.addInitScript` to
   install sessionStorage at navigation time — test-only, no
   app change, no XSS regression. The dashboard stays exactly
   as it is.

## What Changes

1. `repos/identity-vessel/src/resolvers/login.ts` — line ~357
   `CREATE users` SQL: change `org_id = $org_id` to
   `org_id = type::thing($org_id)`. Same fix on any sibling
   `CREATE organization_members` / `CREATE type::record($id)`
   path that fed a string into a record column. Re-verify each
   CREATE in the signup path.

2. `repos/identity-vessel/src/resolvers/auth.ts:92` — change
   `verify(token, JWT_SECRET, "HS256")` to
   `verify(token, JWT_SECRET, "HS512")`. The signing side is
   the canonical contract (it has to match SurrealDB).

3. `repos/metabob-cloud-dashboard/src/lib/auth.ts` (or wherever
   the dashboard stores `metabob_token` — grep for the constant)
   — mirror the token write into `localStorage` alongside the
   existing `sessionStorage` write. Read path: prefer
   sessionStorage; fall back to localStorage. Clear both on
   logout. Comment the localStorage write with
   `// E2E seed: Playwright storageState writes here.`

4. Deploy identity-vessel + cloud-dashboard to canary via
   `/deploy`.

5. Re-run the team-lead rubric apply (`opsx:apply` against
   `2026-05-20-team-lead-rubric`) once canary is healthy.

## Non-Goals

- Refactoring the signup flow's transactional shape (the
  proposal preserves the existing sequential CREATE-with-orphan
  semantics that the existing duplicate-guard handles).
- Changing the JWT secret or claim shape.
- Renaming auth storage keys; the dashboard keeps `metabob_token`
  + `metabob_user` as today.
- Migrating any existing users / orgs.

## Success Criteria

- `POST https://identity.metabob.com/v1/auth/signup` with a
  fresh email returns 200 and creates a usable user + org.
- `POST /v1/auth/login` then `GET /v1/auth/me` succeeds
  end-to-end against canary.
- `/v1/jwt/generate` tokens validate against `/v1/auth/me`
  (HS512/HS512 round-trip).
- Dashboard local login writes `metabob_token` to both
  sessionStorage and localStorage; logout clears both.
- Team-lead rubric standalone-seed.ts produces a working
  storageState that the `rubric` Playwright project can
  consume.
- After deploy + rubric retry, `bun run dev-loop` exits 0 with
  `passed + skipped = 6, failed = 0`.
