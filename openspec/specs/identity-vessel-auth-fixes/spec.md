# Capability: identity-vessel-auth-fixes

Three bug fixes that unblock the team-lead E2E rubric:

1. Signup record-coerce.
2. JWT alg HS256/HS512 mismatch.
3. Dashboard auth token mirrored into localStorage for E2E
   seeding.

## Requirements

### R1 — Signup persists records correctly

`POST /v1/auth/signup` on identity-vessel SHALL persist new
users and organizations without `PERSIST_FAILED` errors caused by
string-vs-record column type mismatches. Every `CREATE` in the
signup path that binds a record-typed column SHALL use
`type::thing($param)` or an equivalent coercion construct,
not bare `= $param`.

Verification: a fresh `POST /v1/auth/signup` against canary with
a never-seen email returns 200 and the resulting user is
queryable via `GET /v1/auth/me` after login.

### R2 — JWT alg consistency

`resolveJWT` (and any sibling JWT consumer in identity-vessel)
SHALL verify tokens with the SAME algorithm the signer uses.
The current signer uses HS512 (intentional — matches SurrealDB's
`apikey_token` access). Verifiers SHALL use HS512.

Verification: a token minted by `POST /v1/jwt/generate` validates
against `GET /v1/auth/me` against canary.

### R3 — Rubric seed uses Playwright init-script

The team-lead rubric seed SHALL install its JWT into
`sessionStorage` via Playwright's `page.addInitScript` (or
equivalent test-time hook) at navigation time, NOT by modifying
the dashboard. The dashboard's sessionStorage-only token storage
is preserved exactly as today (cloud-dashboard CLAUDE.md Design
Principle #6: "JWT tokens in sessionStorage (not localStorage
for XSS protection)").

This requirement supersedes the original "mirror to
localStorage" plan from the proposal. Mirroring would have
weakened XSS protection for every user; the init-script
approach is test-only and changes no production behavior.

### R4 — No regression in JWT claim shape

This capability SHALL NOT change the JWT claim shape, the JWT
secret, or the issuer/audience fields. Only the verification
algorithm changes (HS256 → HS512).

### R5 — Standalone product surface unchanged

The boundary contract from `standalone-product-surface` R1-R7
remains intact. No new dependencies added; no env vars renamed.
