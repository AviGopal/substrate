# Design: Vessel-to-Vessel Session Handshake

**Change ID**: `2026-04-29-vessel-session-handshake`

---

## D0. Mental Model: DNS

This design is shaped end-to-end by the DNS analogy. Anywhere a question arises about TTL, caching, refresh, or revocation, the default answer is "what would a DNS resolver do?" That gives us a federation-ready architecture today, even though the federated cutover is out of scope.

| DNS concept | Vessel-auth mapping |
|---|---|
| Authoritative server | `identity-vessel` (per realm) |
| Recursive resolver | per-vessel **auth-cache** library, shipped in every vessel |
| Stub resolver | thin call site inside each route handler / outbound HTTP client |
| A record + TTL | JWT with `exp` claim |
| Negative caching | revocation denylist with short TTL |
| Iterative resolution | caller refreshes proactively; receiver never reaches authority on hot path |
| Root hints | `discovery-vessel` registration of identity-vessel endpoints |
| DNSSEC chain | JWT signature verified locally; HS256 today, RS256 + JWKS at federation |
| Glue records | discovery-vessel records that pin which identity-vessel issues for which org/realm |

Two design rules follow from the analogy:

1. **The hot path never asks the authority.** Verifying a JWT must be a local operation. Anything that requires a network round-trip to identity-vessel on a per-request basis is an anti-pattern.
2. **TTL is the unit of trust.** Revocation latency is bounded by JWT TTL plus optional denylist check on sensitive routes, the same way DNS revocation is bounded by record TTL plus opt-in DNSSEC validation.

---

## D1. Token Shape

JWT payload (HS256, `JWT_SECRET` shared across all vessels we own):

```json
{
  "iss": "identity-vessel",
  "sub": "vessel:<vessel_id>",
  "aud": "*",
  "org_id": "organizations:<slug>",
  "user_id": "users:<id>",
  "scopes": ["read", "write"],
  "project_ids": ["projects:<id>", ...],
  "account_id": "accounts:<id>",
  "jti": "<uuid v7>",
  "iat": 1714377600,
  "exp": 1714378500,
  "kid": "v1"
}
```

Notes:

- `sub` carries the calling vessel's id (not the user id). This is the federated handle; it must derive from a stable vessel identity. Today that is the `vessel_id` registered with discovery-vessel; the H2 hardening (vessel-id from pubkey multihash) will tighten this further.
- `aud: "*"` is reserved. Today every receiver accepts `*`; at federation we enforce per-receiver audiences.
- `org_id`, `user_id`, `scopes`, `project_ids`, `account_id` mirror the existing dashboard JWT claim shape (see `docs/AUTH_JWT_CLAIMS.md`) so PERMISSIONS clauses (`$token.org_id`, `$token.project_ids`) work without change.
- `jti` is a UUID v7 (time-prefixed) so the revocation denylist can age out entries cleanly.
- `kid: "v1"` enables key rollover: a verifier can hold N secrets keyed by `kid` and swap one without downtime.

Default TTL: **15 minutes**. Refresh window: **last 25%** (proactive renew at ~11 min). Both configurable via env vars (`VESSEL_JWT_TTL_S`, `VESSEL_JWT_REFRESH_RATIO`).

---

## D2. Handshake Endpoint

Reuse identity-vessel's `/v1/jwt/generate` rather than introducing a new endpoint. The semantic is "issue a session JWT for the bearer of this HMAC API key."

Request (sent by calling vessel at cold start or after 401):

```http
POST /v1/jwt/generate
Authorization: ApiKey mb-<base64-payload>-<hmac32>
Content-Type: application/json

{ "purpose": "vessel_session", "ttl_s": 900 }
```

Identity-vessel:

1. Validates the HMAC API key via `validateKeyFormat()` + signature check.
2. If valid, mints a JWT per D1 with `sub = key.vessel_id` (or `key.user_id` if vessel-id is not yet attached to the key — see open question Q1).
3. Returns `{ token, expires_at }`.

Failure modes:
- HMAC invalid → 401, do not mint.
- HMAC valid but key revoked → 401.
- HMAC valid but caller's IP exceeds handshake rate limit → 429 with `Retry-After`.

Rate-limit ceiling on `/v1/jwt/generate`: **600 req/min/IP** (a handshake is bursty at vessel boot, then quiet for ~11 minutes per call site; a vessel with N concurrent call sites refreshes N times every ~11 min, well below ceiling). Tighten once telemetry shows real volume.

`/v1/auth/resolve` keeps its current 20 req/min ceiling — nothing on the hot path should hit it post-rollout.

---

## D3. Receiver-Side Verification

Receiving vessel's auth middleware:

```
1. Extract Authorization header.
2. If `Bearer <token>`:
     a. Verify signature locally with JWT_SECRET[kid].
     b. Check exp / nbf / iat sanity.
     c. Optionally: if route is admin-scoped, check Redis revocation denylist for jti.
     d. Set auth context (org_id, user_id, scopes, project_ids, account_id) from claims.
     e. Continue.
3. If `ApiKey <key>`:
     a. Validate via identity-vessel /v1/auth/resolve (existing path, unchanged).
     b. This path remains for cold callers but should not be used for vessel-to-vessel hot paths.
4. Otherwise:
     a. 401.
```

Local signature verification uses the JWT lib already vendored in identity-vessel (`@hono/jwt` or equivalent — confirm during implementation). No network call.

---

## D4. Auth-Cache Library

Ship one library, consumed by every vessel that makes outbound vessel calls (minibob, activity-api, discovery-vessel, conversation-vessel, concept-db, …). Suggested name: `@metabob/vessel-auth-cache` co-located with `packages/vessel-discovery-client`.

API:

```typescript
const cache = createVesselAuthCache({
  identityVesselUrl: process.env.IDENTITY_VESSEL_URL,
  apiKey: process.env.METABOB_API_KEY,
  ttlS: 900,
  refreshRatio: 0.25,
})

// Used by outbound HTTP client:
const token = await cache.getBearer()
fetch(targetUrl, { headers: { Authorization: `Bearer ${token}` } })
```

Internals:

- In-memory entry: `{ token, expiresAt, refreshAt }`. Single entry per cache instance because we issue one JWT per caller (not per audience) — see D5.
- On `getBearer()`: if `now < refreshAt`, return cached token. If `refreshAt <= now < expiresAt`, kick off background refresh, return current token. If `now >= expiresAt`, await fresh handshake.
- On `401` from a peer, the SDK invalidates the entry and retries the request once with a freshly minted token. A second 401 propagates.
- LRU is unnecessary at v1 (one entry). The shape is left flexible so the federated cutover (per-audience tokens) drops in cleanly.

Observability:

- Counter: `vessel_auth.handshake_total{outcome}` (success | hmac_invalid | rate_limited | error).
- Counter: `vessel_auth.refresh_total{trigger}` (proactive | reactive_401).
- Gauge: `vessel_auth.token_age_s`.
- Optional: emit a `lifecycle:vessel:auth_event` impulse on each handshake/refresh for cross-vessel observability (deferred to v2).

---

## D5. Single Issuance vs. Per-Audience

Decision: **single JWT per caller for v1**. `aud: "*"`. We own all vessels; there is no information-disclosure risk between receivers we control.

Tradeoff: the same token is presentable to any receiver. If a token leaks (e.g. through a verbose log line), the attacker has access to whatever the caller has access to until `exp`. Mitigations:
- Short TTL (15 min default).
- Logs MUST redact bearer tokens (regex on `Authorization:\s*Bearer\s+\S+`).
- Identity-vessel's revocation flow accepts `jti`, so a known leak is killable inside the TTL window.

Federated cutover converts this to per-audience issuance. The `aud` claim is already in the schema; the change is enforcement at receiver + per-audience cache key in the SDK. No on-the-wire breakage.

---

## D6. Rollout Plan

Phase A — additive:

1. Land identity-vessel rate-limit ceiling change for `/v1/jwt/generate` (600/min/IP).
2. Ship the auth-cache library; integrate it in minibob and activity-api outbound clients first.
3. Receiver-side: add Bearer-JWT validation alongside the existing `Authorization: ApiKey` path. Both work concurrently.
4. Telemetry: confirm handshake counts and cache hit ratios match expectations (~one handshake per ~11 min per vessel call site).

Phase B — deprecation:

5. Gate the `X-Internal-Api-Key` bypass behind an env flag (default off in canary, default on in dev only). Audit logs for any caller still using the header.
6. Migrate every remaining caller to Bearer JWT. Confirm zero `X-Internal-Api-Key` in production logs.

Phase C — removal:

7. Delete `X-Internal-Api-Key` handling from `repos/metabob-activity-api/src/middleware/jwtAuth.ts` and every consumer. Delete env flag.
8. Audit all route handlers for `c.req.header('x-internal-api-key')` and remove.
9. Audit every impulse-write route to confirm `org_id` is taken from auth context, never from request body. Add regression tests for spoofing attempts.

Phase D — federation prep (deferred):

10. Add `kid` versioning support and JWKS endpoint stub on identity-vessel. Receiver-side: support multiple `kid` values during rollover.
11. Document the cutover to RS256 / per-realm keypairs in a future change.

---

## D7. Open Questions

**Q1. Vessel-id on the API key.**
Today the HMAC API key payload encodes `org_id`, `user_id`, `key_id`. It does not carry a vessel-id. For `sub: "vessel:<vessel_id>"` we either:
- Attach `vessel_id` to the API key during issuance (requires identity-vessel migration + Helm seed update); or
- Use `user_id` as the proxy and let discovery-vessel correlate at registration.
Recommend the first; verify how disruptive that is to the existing `mb-` HMAC payload format before locking it in.

**Q2. Proactive refresh thundering herd.**
If many call sites in a single process share one cache, a single refresh fires once per process — fine. If many processes share a host (multiple replicas of the same vessel), each refreshes independently. With 600/min/IP, a Deployment of 10 replicas refreshing every 11 min still uses well under 1% of the budget. Confirm during load test.

**Q3. Revocation denylist semantics.**
Should every route check the denylist, or only admin-scoped / write routes? Bias: only sensitive routes by default, with a per-route opt-in. Cost of universal check: a Redis call on the hot path. Cost of skipping: a revoked token remains usable until `exp` (≤15 min). Pick based on threat model; default proposed = sensitive-routes-only.

**Q4. Workbench / cloud-dashboard.**
These are browser clients with their own login flow (`/v1/auth/login` returning a user JWT). They don't go through this handshake. Confirm there is no overlap or accidental coupling — vessel-session JWTs and user-login JWTs are distinguishable by `sub` prefix and `iss`, and PERMISSIONS clauses work for both. Receiver code path should treat them as the same shape.

**Q5. Discovery-vessel as bootstrap.**
Today identity-vessel's URL is wired via `IDENTITY_VESSEL_URL` env. Federation-ready alternative: every vessel asks discovery-vessel for the identity-vessel endpoint at startup. We could land that today (no behavioural change) to keep the federation cutover small. Decision: land the env-var path now, document the discovery-bootstrap variant for later.

**Q6. JWT_SECRET rotation.**
Today rotation = Helm secret roll + restart all vessels simultaneously. With `kid` versioning, we can publish two secrets concurrently and roll vessels independently. v1 ships single-`kid` to keep scope tight; v2 introduces dual-`kid` rollover.

---

## D8. Failure Modes and Recovery

| Failure | Behaviour |
|---|---|
| Identity-vessel down at vessel boot | Calling vessel cannot mint first JWT. Falls back to `Authorization: ApiKey` for receivers that still accept it (Phase A). After Phase C, the calling vessel is hard-down. Mitigation: identity-vessel is a single point of failure and should be replicated. |
| Identity-vessel down mid-session | Cached JWT keeps working until `exp`. Refresh fails; calling vessel retries with backoff. If `exp` reached without successful refresh, calls 401. |
| `JWT_SECRET` mismatch (rollover gone wrong) | Receiver returns 401 on every request. Cache invalidates, caller re-handshakes — but the new JWT is signed with whichever secret identity-vessel currently holds. If the receiver hasn't picked up the new secret, deadlock until secret propagates. Mitigation: `kid` versioning (v2). |
| Token leak in logs | Bounded by `exp` (≤15 min). Operator revokes `jti` via `/v1/keys/revoke`. Receivers with denylist enabled reject within their cache TTL. |
| Clock skew | JWT verifier allows ±60s. Larger skews are a vessel-host configuration problem; surface via telemetry. |
| Receiver bug rejects valid JWT | Caller's reactive-401 retry kicks in; on second 401 the call propagates. Telemetry: `vessel_auth.refresh_total{trigger=reactive_401}` rising indicates a receiver bug. |

---

## D9. Security Properties

| Property | Held? | Notes |
|---|---|---|
| Caller authenticity | Yes | JWT signature binds `sub` to identity-vessel's mint event; HMAC API key was validated at handshake. |
| Receiver authenticity | No | Receiver is identified by URL, not cryptographic proof. Same as today. mTLS is the future hardening. |
| Replay resistance within TTL | No | A captured JWT is replayable for ≤15 min from any IP. Mitigation: short TTL, denylist on sensitive routes. |
| Replay resistance after revocation | Partial | Sensitive routes check denylist; default routes wait for `exp`. |
| Cross-vessel impersonation | No (within trust boundary) | Any vessel holding `JWT_SECRET` can mint tokens. We accept this because we own all vessels. Federation requires asymmetric keys. |
| Cross-org access | No | `$token.org_id` enforced at PERMISSIONS layer. |
| Body-spoofed `org_id` | No (after Phase C) | Audit ensures every write route reads from auth context, not body. |

---

## D10. Test Strategy

Unit:
- JWT mint and verify roundtrip (HS256, all claim fields).
- Expired token rejected.
- Wrong-secret token rejected.
- Bearer header malformed (missing `Bearer`, empty token, two tokens) rejected.
- `kid` mismatch rejected (when v2 lands).

Integration:
- minibob → activity-api impulse resolution at sustained 100 req/s for 60s without 429.
- minibob → activity-api after JWT expiry triggers automatic refresh; no observable failure at the call site.
- Revoked `jti` rejected by sensitive routes within denylist TTL.
- Body `org_id` differing from auth-context `org_id` is rejected (or auth-context wins) on every write route.

Load:
- Confirm `/v1/jwt/generate` ceiling is not hit at expected vessel scale.
- Confirm receiver-side verification adds < 1ms per request.

Regression / canary:
- Pre-rollout: capture baseline of `X-Internal-Api-Key` usage in canary logs (should be every internal call).
- Post-Phase-A: confirm Bearer-JWT path active alongside.
- Post-Phase-B: confirm `X-Internal-Api-Key` usage trends to zero.
- Post-Phase-C: 7-day observation period with the bypass code removed.
