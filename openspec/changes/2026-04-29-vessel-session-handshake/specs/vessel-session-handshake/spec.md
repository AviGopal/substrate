# Spec: Vessel Session Handshake

**Change ID**: `2026-04-29-vessel-session-handshake`

## ADDED Requirements

### Requirement: Identity-vessel issues vessel-session JWTs from a verified HMAC API key

`POST /v1/jwt/generate` SHALL accept a request body with `purpose: "vessel_session"` and a configurable `ttl_s` (default 900, max 3600). The request SHALL be authenticated by `Authorization: ApiKey <hmac>`. On valid HMAC, identity-vessel SHALL mint a JWT with claims `iss`, `sub`, `aud`, `org_id`, `user_id`, `scopes`, `project_ids`, `account_id?`, `jti`, `iat`, `exp`, `kid` and return it.

#### Scenario: Valid HMAC mints a JWT
- **WHEN** a request to `/v1/jwt/generate` carries a valid `Authorization: ApiKey` header and `purpose: "vessel_session"`
- **THEN** the response is `200` with a JWT verifiable under `JWT_SECRET[kid]` and an `expires_at` field

#### Scenario: Invalid HMAC is rejected
- **WHEN** a request carries an HMAC that fails `validateKeyFormat` or signature verification
- **THEN** the response is `401`

#### Scenario: Revoked HMAC key is rejected
- **WHEN** the HMAC's `key_id` is on the revocation list
- **THEN** the response is `401`

#### Scenario: TTL ceiling enforced
- **WHEN** a request asks for `ttl_s` greater than the configured maximum (3600)
- **THEN** the response is `400`

### Requirement: Receiving vessels verify Bearer JWTs locally without contacting identity-vessel

Every vessel that accepts vessel-to-vessel calls SHALL accept `Authorization: Bearer <jwt>` headers. Verification SHALL be performed locally using the JWT's `kid` to select the verifying secret. `exp`, `iat`, `nbf` SHALL be enforced with a ±60s clock skew. The hot path SHALL NOT make a network call to identity-vessel for token validation.

#### Scenario: Valid Bearer token authenticates
- **WHEN** a request carries a valid Bearer JWT and the receiver verifies the signature locally
- **THEN** the request proceeds with auth context populated from the JWT claims (`org_id`, `user_id`, `scopes`, `project_ids`, `account_id`)

#### Scenario: Expired token rejected
- **WHEN** a Bearer JWT has `exp` more than 60s in the past
- **THEN** the response is `401`

#### Scenario: Wrong-secret token rejected
- **WHEN** a Bearer JWT's signature does not verify under any known secret for the JWT's `kid`
- **THEN** the response is `401`

#### Scenario: Unknown kid rejected
- **WHEN** a Bearer JWT carries a `kid` for which no secret is configured
- **THEN** the response is `401`

#### Scenario: Receiver does not contact identity-vessel for verification
- **WHEN** any number of valid Bearer JWT requests arrive at the receiver in a short window
- **THEN** identity-vessel sees zero new traffic on `/v1/auth/resolve` for that traffic

### Requirement: Calling vessels cache the JWT and refresh proactively

Calling vessels SHALL maintain an in-memory auth cache containing the active JWT and refresh proactively when the JWT enters the last 25% of its TTL. Cold-start, refresh-window, and hard-expiry behaviour SHALL match `design.md §D4`.

#### Scenario: Cold start performs handshake
- **WHEN** a calling vessel makes its first outbound request after process start
- **THEN** it issues exactly one handshake to `/v1/jwt/generate`, caches the result, and uses the cached token for subsequent calls

#### Scenario: Proactive refresh inside TTL window
- **WHEN** the cached JWT enters the last 25% of its TTL
- **THEN** the cache initiates a background refresh and continues to serve the still-valid current token until the refresh succeeds

#### Scenario: Concurrent getBearer calls coalesce
- **WHEN** N callers within the same process invoke `getBearer()` concurrently before any handshake has completed
- **THEN** exactly one handshake is issued; all N callers receive the same resulting token

#### Scenario: Reactive 401 retries once
- **WHEN** a peer returns `401` for a request authenticated with the cached JWT
- **THEN** the cache invalidates the entry, performs a fresh handshake, and retries the request exactly once; a second `401` propagates

### Requirement: `X-Internal-Api-Key` bypass is removed and replaced

Activity-api's `X-Internal-Api-Key` short-circuit SHALL be removed once Phase C of the rollout completes. No vessel SHALL accept any header that bypasses signature verification.

#### Scenario: Bypass header is no longer honoured
- **WHEN** a request to a vessel carries `X-Internal-Api-Key: <anything>` and no valid `Authorization` header after Phase C
- **THEN** the response is `401`

#### Scenario: No code path forwards the bypass header
- **WHEN** the codebase is grepped for `X-Internal-Api-Key` (case-insensitive) after Phase C
- **THEN** zero hits are found in `repos/*/src/`

### Requirement: `org_id` is taken from auth context, not from request body

Every write route on every vessel SHALL determine the `org_id` of the persisted record from the verified auth context (`$token.org_id` at SurrealDB, or the equivalent at the application layer), never from a field in the request body.

#### Scenario: Body-spoofed org_id is rejected or overridden
- **WHEN** a write request body contains an `org_id` that differs from the auth-context org_id
- **THEN** the persisted record carries the auth-context org_id; the body field is ignored or the request is rejected with `400`

#### Scenario: Cross-org spoofing is impossible
- **WHEN** an authenticated caller from org A submits a write with `body.org_id = "org B"`
- **THEN** no record is written under org B's org scope; PERMISSIONS clauses reject any subsequent read by org B that would surface the record

### Requirement: Revocation lists are queryable and consulted on sensitive routes

Identity-vessel SHALL maintain a Redis-backed revocation list keyed by JWT `jti`. Sensitive routes (admin-scope, write resolvers that mutate global state) SHALL check the list before honouring a Bearer JWT. Default routes MAY skip the check and rely on `exp` for revocation latency.

#### Scenario: Revoked jti rejected on sensitive route
- **WHEN** a Bearer JWT is valid by signature and TTL but its `jti` is on the revocation list
- **AND** the request targets an admin-scope or write-resolver route
- **THEN** the response is `401`

#### Scenario: Revoked jti accepted on default route
- **WHEN** a Bearer JWT is valid by signature and TTL but its `jti` is on the revocation list
- **AND** the request targets a default route that opted out of denylist checking
- **THEN** the response proceeds normally; revocation latency is bounded by the JWT's `exp`

#### Scenario: Revocation entries age out cleanly
- **WHEN** a `jti` is revoked
- **THEN** the Redis entry has TTL ≥ JWT lifetime + 60s; entries older than this are removed

### Requirement: `/v1/jwt/generate` rate limit is high enough for handshake bursts

Identity-vessel's rate limiter SHALL grant `/v1/jwt/generate` a per-IP ceiling of at least 600 req/min. `/v1/auth/resolve` retains its current 20 req/min ceiling. The two ceilings SHALL be configurable independently via env vars.

#### Scenario: Handshake burst inside ceiling
- **WHEN** a vessel host issues up to 500 handshakes per minute
- **THEN** all are honoured

#### Scenario: Exceeding handshake ceiling returns 429 with Retry-After
- **WHEN** a vessel host exceeds 600 handshakes per minute
- **THEN** subsequent requests return `429` with a `Retry-After` header

#### Scenario: Hot-path receivers do not contact `/v1/auth/resolve`
- **WHEN** Bearer-JWT validation is in place across all vessels (post-Phase A)
- **THEN** total `/v1/auth/resolve` traffic is no greater than dashboard / human-driven traffic; vessel-to-vessel traffic does not appear in those counters

### Requirement: Telemetry exposes handshake, refresh, and cache-hit counters

The auth-cache library SHALL emit metrics: `vessel_auth.handshake_total{outcome}`, `vessel_auth.refresh_total{trigger}`, and a gauge `vessel_auth.token_age_s`. Receiving vessels SHALL emit a counter `vessel_auth.bearer_verifications_total{outcome}`.

#### Scenario: Metrics observable in test instrumentation
- **WHEN** the auth-cache or a receiver-side verifier handles a request
- **THEN** the corresponding counter or gauge is updated; values are queryable via the Prometheus endpoint or test instrumentation harness

### Requirement: `kid` versioning supports `JWT_SECRET` rotation without downtime

Identity-vessel and every receiver SHALL support multiple JWT signing secrets concurrently, indexed by the JWT's `kid` claim. A token minted with `kid=v1` SHALL verify against the secret registered under `v1`; a token with `kid=v2` SHALL verify against the secret registered under `v2`.

#### Scenario: Dual-kid period during rotation
- **WHEN** secrets `v1` and `v2` are both configured and identity-vessel mints with `kid=v2`
- **THEN** receivers with both secrets accept tokens of either `kid`; receivers with only `v1` reject `kid=v2` tokens with `401`

#### Scenario: Rollover completes with single kid
- **WHEN** identity-vessel switches mint to `kid=v2` exclusively and operators wait for all `kid=v1` tokens to expire
- **THEN** secret `v1` can be removed from receivers without rejecting any live tokens

### Requirement: Receiver auth path is consistent across vessels

The Bearer-JWT verification logic SHALL be implemented through a shared helper or library so that activity-api, discovery-vessel, identity-vessel (for inbound calls), and every other vessel use byte-identical verification semantics. Per-vessel hand-rolled verifiers SHALL be removed.

#### Scenario: One library, many vessels
- **WHEN** the codebase is grepped for `jwt.verify\(`, `jose.jwtVerify`, or equivalent
- **THEN** the only call site is inside the shared helper or auth-cache library; no vessel reimplements the primitive
