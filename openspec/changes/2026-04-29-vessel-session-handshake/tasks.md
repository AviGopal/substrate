# Tasks: Vessel-to-Vessel Session Handshake

**Change ID**: `2026-04-29-vessel-session-handshake`

Tasks are ordered by dependency. Items within a numbered group can be done in parallel. Each phase corresponds to design §D6.

---

## Group 0: Pre-flight

### T0.1 — Resolve open question Q1 (vessel-id on the API key)

Audit `repos/identity-vessel/src/services/validation.ts` and the API-key issuance path (`/v1/keys/issue`, `/v1/keys/generate`). Determine whether the HMAC payload format can carry a `vessel_id` field without breaking existing key parsing across all vessels. Document the decision in `design.md §D7 Q1`.

**Files**: `repos/identity-vessel/src/services/validation.ts`, `repos/identity-vessel/src/index.ts`
**Acceptance**: §D7 Q1 updated with one of (a) extend payload, (b) use user_id, (c) lookup via discovery, with rationale.

### T0.2 — Confirm shared JWT signing library

The receiver-side verifier must use the same JWT library identity-vessel uses for minting. Confirm the lib (`@hono/jwt`, `jose`, or other) and pin a version. If multiple vessels currently hand-roll JWT verification, list them.

**Files**: search `repos/*/src` for `jwt.verify`, `jsonwebtoken`, `jose`, `@hono/jwt`.
**Acceptance**: One library chosen; existing usages cataloged for refactor in T2.x.

---

## Group 1: Identity-vessel — handshake endpoint

### T1.1 — Add `purpose: "vessel_session"` mode to `/v1/jwt/generate`

Extend the existing endpoint to accept a `purpose` field. When `purpose === "vessel_session"`, mint a JWT with the claim shape from `design.md §D1`. Include `jti` (UUID v7), `kid` (`"v1"`), and `aud` (`"*"`).

**File**: `repos/identity-vessel/src/index.ts` (route handler), plus the JWT mint helper.
**Acceptance**: Endpoint returns a JWT verifying against `JWT_SECRET` with the claim shape from D1; unit tests cover successful mint, invalid HMAC, revoked key, missing `purpose`.

### T1.2 — Raise rate-limit ceiling on `/v1/jwt/generate`

Configure rate limiting for the handshake endpoint at 600 req/min/IP (or the configured value from `IDENTITY_VESSEL_HANDSHAKE_RATE_LIMIT`). Keep `/v1/auth/resolve` at 20/min/IP.

**File**: `repos/identity-vessel/src/middleware/rate-limit.ts` or equivalent.
**Acceptance**: Load test at 500 req/min/IP succeeds; at 700 req/min/IP returns 429 with `Retry-After`.

### T1.3 — Revocation by `jti`

Confirm `/v1/keys/revoke` accepts `jti` (or extend it). Persist revoked jtis in Redis with TTL = (`jti.iat + jti.exp + 60s`) so entries age out cleanly.

**Files**: `repos/identity-vessel/src/services/revocation.ts` (or equivalent), Redis schema.
**Acceptance**: A revoked jti is queryable via `/v1/keys/check-revocation?jti=...` and ages out at the JWT's natural expiry plus 60s.

---

## Group 2: Auth-cache library

### T2.1 — Scaffold `@metabob/vessel-auth-cache` package

Create a TypeScript package alongside `packages/vessel-discovery-client`. Export `createVesselAuthCache(config)` returning an object with `getBearer()`, `invalidate()`, `stats()`.

**Files**: `packages/vessel-auth-cache/{package.json, src/index.ts, src/cache.ts, README.md}`.
**Acceptance**: Package builds; smoke test exercises the public API.

### T2.2 — Implement handshake + proactive refresh

Inside the cache: on `getBearer()`, perform handshake against identity-vessel if no entry; return cached token if `now < refreshAt`; kick off background refresh and return current token if `refreshAt <= now < expiresAt`; await fresh handshake if `now >= expiresAt`. Refresh window = last 25% of TTL.

**Files**: `packages/vessel-auth-cache/src/cache.ts`.
**Acceptance**: Unit tests cover cold-start, warm-cache, refresh-window, hard-expiry, and concurrent `getBearer()` calls coalescing into one handshake.

### T2.3 — Reactive 401 retry

When the SDK is used through the vessel HTTP client, a 401 invalidates the entry and retries the request once. Second 401 propagates.

**Files**: `packages/vessel-auth-cache/src/http-integration.ts` (or fold into the existing httpClient).
**Acceptance**: Integration test fakes a 401 once, verifies single transparent retry; fakes 401 twice, verifies the error propagates.

### T2.4 — Counters and gauge

Emit Prometheus-style counters/gauges per `design.md §D4`. Use the existing observability helper if one exists, otherwise expose via an injected metrics interface.

**Files**: `packages/vessel-auth-cache/src/metrics.ts`.
**Acceptance**: `vessel_auth.handshake_total{outcome}`, `vessel_auth.refresh_total{trigger}`, `vessel_auth.token_age_s` are observable in test instrumentation.

---

## Group 3: Receiver-side validation

### T3.1 — Add Bearer-JWT path to activity-api auth middleware

In `repos/metabob-activity-api/src/middleware/jwtAuth.ts`, add a code path that, on `Authorization: Bearer <jwt>`, verifies the signature locally with `JWT_SECRET[kid]`, validates `exp`/`iat`/`nbf`, and populates the auth context (`org_id`, `user_id`, `scopes`, `project_ids`, `account_id`) from claims. Run alongside the existing ApiKey path.

**Files**: `repos/metabob-activity-api/src/middleware/jwtAuth.ts`, plus tests under `repos/metabob-activity-api/src/middleware/`.
**Acceptance**: A valid Bearer JWT authenticates; expired, wrong-secret, malformed, missing-claims tokens are rejected with 401; ApiKey path still works.

### T3.2 — Add Bearer-JWT path to discovery-vessel auth middleware

Same change in `repos/discovery-vessel/src/middleware/auth.ts`.

**Files**: `repos/discovery-vessel/src/middleware/auth.ts`.
**Acceptance**: Mutation endpoints (register, heartbeat, deregister) accept Bearer JWTs; unsigned/expired rejected.

### T3.3 — Add Bearer-JWT path to every other vessel that has its own auth middleware

Audit `repos/*/src/middleware/` and `repos/*/src/services/auth.ts` for vessels with their own validators (concept-db, conversation-vessel, user-vessel, others surfaced by T0.2). Add Bearer-JWT support consistently.

**Files**: per-vessel.
**Acceptance**: Each vessel's middleware suite includes Bearer-JWT tests mirroring T3.1.

### T3.4 — Optional revocation check on sensitive routes

For admin-scoped or write-resolver routes (e.g. `activityTemplate_update`, `activityTemplate_deprecate`, `activityExecutionTrace_delete`), add a Redis denylist check. Skip on default routes.

**Files**: `repos/metabob-activity-api/src/routes/impulses.ts` (write resolver dispatch), `repos/identity-vessel/src/services/revocation-cache.ts`.
**Acceptance**: A revoked jti rejects on sensitive routes; default routes still accept until `exp`.

---

## Group 4: Caller migration

### T4.1 — Integrate `vessel-auth-cache` in minibob outbound clients

Replace the `Authorization: ApiKey ...` header injection in `repos/minibob/src/http-client.ts` with `Authorization: Bearer <jwt>` from the cache.

**Files**: `repos/minibob/src/http-client.ts`, `repos/minibob/src/resolvers/vessel-resolve-call.ts`, anywhere else that sets `Authorization`.
**Acceptance**: Outbound calls carry `Bearer`; cache hit ratio observable; one handshake per ~11 minutes per process.

### T4.2 — Integrate in activity-api outbound clients

Activity-api makes outbound calls to identity-vessel and discovery-vessel. Migrate those.

**Files**: `repos/metabob-activity-api/src/services/discovery-client.ts`, `repos/metabob-activity-api/src/services/auth.ts`.
**Acceptance**: Same as T4.1.

### T4.3 — Integrate in remaining vessels

concept-db, conversation-vessel, workbench server-side calls (NOT the browser flow), and any vessel touched in T3.3.

**Files**: per-vessel.
**Acceptance**: Same as T4.1.

---

## Group 5: Bypass deprecation

### T5.1 — Gate `X-Internal-Api-Key` behind env flag

Add `ALLOW_INTERNAL_API_KEY_BYPASS` env var (default true in dev/canary, false in production). When false, the bypass at `repos/metabob-activity-api/src/middleware/jwtAuth.ts:216-228` is inactive and the request falls through to standard auth.

**Files**: `repos/metabob-activity-api/src/middleware/jwtAuth.ts`.
**Acceptance**: With flag false, a request with `X-Internal-Api-Key` and no other auth returns 401.

### T5.2 — Audit canary logs for residual usage

After Phase A is healthy, set `ALLOW_INTERNAL_API_KEY_BYPASS=false` in canary. Watch `repos/metabob-activity-api/src/routes/impulses.ts` access logs for residual `X-Internal-Api-Key` headers. Catalog any caller that still uses it.

**Acceptance**: A list of remaining callers (vessel + route) recorded in this tasks file.

### T5.3 — Migrate residual callers

For each caller from T5.2, port them to the auth-cache and Bearer JWTs.

**Acceptance**: Production canary logs show zero `X-Internal-Api-Key` for 7 consecutive days.

### T5.4 — Remove the bypass

Delete the `X-Internal-Api-Key` short-circuit from `jwtAuth.ts`. Remove every `c.req.header('x-internal-api-key')` reference from `impulses.ts` and any other consumer. Drop the env flag.

**Files**: `repos/metabob-activity-api/src/middleware/jwtAuth.ts`, `repos/metabob-activity-api/src/routes/impulses.ts`, plus any caller-side helpers that injected the header.
**Acceptance**: `grep -r "X-Internal-Api-Key\|x-internal-api-key"` across `repos/` returns zero hits in code.

---

## Group 6: Body `org_id` audit

### T6.1 — Catalog write routes that read `org_id` from body

`grep -rn "body\\.org_id\\|c\\.req\\.json().*org_id" repos/*/src/routes/`. For each hit, decide whether the route ought to read from auth context (`$token.org_id` via the AuthContext object) instead.

**Acceptance**: A list of vulnerable routes recorded under T6.2 below.

### T6.2 — Rewrite each vulnerable route to read from auth context

For every route in T6.1's list, change the handler to use `c.get('auth').orgId` (or equivalent) and reject (or ignore) any body field that conflicts.

**Acceptance**: Per-route diff PR'd; regression test in T6.3 passes.

### T6.3 — Regression test for body-spoofing

Add a test that POSTs an impulse-write with `body.org_id` set to a foreign org and asserts the persisted record carries the auth-context's `org_id`, not the body's.

**Files**: `repos/metabob-activity-api/test/security/org-id-spoofing.test.ts` (new).
**Acceptance**: Test passes against the migrated routes.

---

## Group 7: Documentation

### T7.1 — Update CLAUDE.md `## Authentication`

Replace the "service-to-service: minibob, vessel-side resolvers" line with a description of the handshake flow, the auth-cache, the JWT shape, and the federation evolution. Cite this change.

**File**: `CLAUDE.md`.
**Acceptance**: Doc reads correctly to a new contributor without prior context.

### T7.2 — Update `docs/AUTH_JWT_CLAIMS.md`

Add the vessel-session JWT claim shape alongside the existing dashboard JWT shape. Document `kid` versioning placeholder.

**File**: `docs/AUTH_JWT_CLAIMS.md`.
**Acceptance**: Both JWT variants documented with field-by-field semantics.

### T7.3 — Operational runbook

Add a short runbook in `docs/troubleshooting/` covering: how to rotate `JWT_SECRET`, how to revoke a leaked `jti`, how to interpret auth-cache metrics, and what to do if identity-vessel is down.

**File**: `docs/troubleshooting/vessel-auth.md` (new).
**Acceptance**: Runbook covers the four scenarios above.

---

## Group 8: Federation prep (deferred — opens a follow-up change)

### T8.1 — Stub JWKS endpoint

Add `/.well-known/jwks.json` on identity-vessel returning a one-key JWKS for HS256 (HMAC keys traditionally aren't in JWKS, but we publish a placeholder document so consumers can ship the fetch logic). Real JWKS arrives with the RS256 cutover.

**File**: `repos/identity-vessel/src/index.ts`.
**Acceptance**: Endpoint returns a valid JSON document; no consumer is required to use it yet.

### T8.2 — `kid` versioning rollover plumbing

Receiver-side: support `JWT_SECRET_V1`, `JWT_SECRET_V2` env vars; verifier picks based on `kid`. Mint-side: identity-vessel mints with `kid` from `JWT_MINT_KID` env var.

**Files**: `repos/identity-vessel/src/index.ts`, every receiver from T3.x.
**Acceptance**: A token minted with `kid=v1` verifies against `JWT_SECRET_V1`; a token with `kid=v2` verifies against `JWT_SECRET_V2`; mismatched kid rejects.

### T8.3 — Author follow-up change for federation

Create `openspec/changes/<future-date>-vessel-auth-federation/` covering the RS256 cutover, JWKS issuance, per-realm identity-vessels, audience enforcement, and discovery-vessel-as-bootstrap. Out of scope here; documented as the planned successor.

**Acceptance**: Successor change exists with a one-page proposal.
