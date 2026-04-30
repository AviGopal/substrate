# Proposal: Vessel-to-Vessel Session Handshake

**Change ID**: `2026-04-29-vessel-session-handshake`
**Status**: Draft
**Date**: 2026-04-29

---

## Problem Statement

Vessel-to-vessel calls cannot use the standard `Authorization: ApiKey <hmac>` flow on the hot path because identity-vessel rate-limits `/v1/auth/resolve` at 20 req/min/IP. A busy minibob run, a workbench in a tight live-execution loop, or a fan-out of impulse resolutions trips that ceiling within seconds.

The current workaround is a kludge: `repos/metabob-activity-api/src/middleware/jwtAuth.ts:216-228` short-circuits the auth middleware whenever the request carries an `X-Internal-Api-Key` header. The header value is **never validated** — no signature, no format check, no shared-secret comparison. Routes that consume the header (`src/routes/impulses.ts:65, 224, 319, …`) forward it blindly. Anyone reaching activity-api over the cluster network can set any `X-Internal-Api-Key` value, fail closed on signature checks (because there are none), and get treated as authenticated. Routes that read `org_id` from request bodies rather than from auth context are spoofable as a result.

This is a real security control gap. It also locks vessels into a rate-limit cliff: anything beyond 20 req/min/IP that isn't going through the bypass either gets 429s or is forced to add a similar bypass.

We need a vessel-to-vessel auth path that:

1. Has identity-vessel as the **single source of truth** for who a caller is and what scopes they hold.
2. Does **not** require an identity-vessel round-trip on every request.
3. Validates cryptographically at the receiving vessel using a deterministic local check.
4. Has a clean evolution path to the federated future state, where vessels we don't own need to verify our identities (and vice versa).

---

## Proposed Solution

Model vessel-to-vessel auth on **DNS resolution**, not on per-request validation. Identity-vessel is the authoritative resolver; every other vessel is a caching resolver that holds a local cache of validated identities and only consults the authority on cache miss or refresh.

### Flow

1. **Handshake** (cold start, once per session lifetime):
   - Calling vessel posts its long-lived HMAC API key to identity-vessel's `/v1/jwt/generate`.
   - Identity-vessel validates the HMAC, mints a session JWT (HS256 today; default 15 min TTL) with claims `{ iss, sub: caller_vessel_id, org_id, scopes, project_ids, account_id?, jti, iat, exp }`, and returns it.
   - Calling vessel caches the JWT in process memory.

2. **Hot path** (every subsequent call):
   - Calling vessel sends `Authorization: Bearer <jwt>` to the receiving vessel.
   - Receiving vessel verifies the signature locally with the shared `JWT_SECRET` — no identity-vessel round-trip. Extracts auth context from claims.
   - PERMISSIONS / route handlers consume `$token.org_id` exactly as they do today for dashboard JWTs.

3. **Refresh** (caller-driven):
   - Calling vessel renews proactively when the JWT enters the last 25% of its lifetime. The refresh is itself a `/v1/jwt/generate` call with the long-lived HMAC.
   - On 401, caller invalidates the cache entry and re-handshakes.

4. **Revocation** (negative caching):
   - Identity-vessel maintains a Redis denylist of revoked `jti` values, populated by `/v1/keys/revoke`.
   - Receiving vessels do **not** consult the denylist on every request. Sensitive routes (admin scope, write resolvers that can mutate global state) MAY check the denylist with their own short-TTL cache. Default routes rely on the JWT's TTL to bound revocation latency.

### Why this fits the DNS analogy

| DNS | Vessel auth |
|---|---|
| Authoritative server | identity-vessel |
| Resolver cache (local) | per-vessel auth-cache (in-memory LRU) |
| Record TTL | JWT `exp` |
| Negative caching | revocation denylist with short TTL |
| Iterative resolution | caller pre-renews; receiver never reaches back to authority on hot path |
| DNSSEC chain | JWT signature verifiable locally with public key (HS256 → RS256 at federation) |
| Root hints | discovery-vessel's identity-vessel registration record |
| JWKS | reserved for federated cutover; not required today |

### Federation evolution (out of scope, called out for shape)

We currently own all vessels, so a single shared `JWT_SECRET` (HS256) is acceptable. The federated future state requires:

- Switch to RS256/ES256 with per-realm keypairs.
- Identity-vessel exposes a JWKS endpoint at `/.well-known/jwks.json`; receiving vessels fetch and cache it on startup.
- Discovery-vessel registers identity-vessel endpoints per realm, becoming the bootstrap registry — the equivalent of DNS root hints.
- JWT `aud` claim is enforced (today optional/`*`); foreign realms verify our tokens by signature alone, never calling our identity-vessel.

The schema, claim shape, and verifier code are designed so the federated cutover is a key-format swap plus a JWKS fetch — no protocol redesign.

---

## In Scope

- New endpoint `POST /v1/jwt/generate` on identity-vessel (or extension of existing) that issues vessel session JWTs from a verified HMAC.
- Shared auth-cache library (TypeScript/Bun) consumed by every vessel.
- Bearer-JWT validator on the receiver side (replacing the `X-Internal-Api-Key` bypass everywhere).
- `JWT_SECRET` rotation plan via Helm secret roll, with `kid` claim for graceful rollover.
- Removal of the `X-Internal-Api-Key` bypass from activity-api and any other vessel that grew its own.
- Rate-limit policy: `/v1/jwt/generate` carries a higher per-vessel ceiling (handshake is bursty at boot, then quiet); `/v1/auth/resolve` keeps its tight ceiling.
- Audit: every route currently reading `org_id` from request body is rewritten to read from `$token.org_id` / auth context.

## Out of Scope

- Federation cutover (RS256, JWKS, per-realm identity-vessels, audience scoping).
- Mutual TLS between vessels (potential future hardening, orthogonal to this).
- Per-pair session secrets with sliding-window request-HMAC (heavier mechanism deferred until federation forces it).
- Long-term key rotation cadence policy (operational concern, separate doc).
- Caller-side observability impulses for cache hit/miss (worth doing, but noise for v1).

## Non-Goals

- Replacing the long-lived HMAC API key. It remains the credential a vessel presents to identity-vessel during handshake; it never leaves the calling vessel as the authentication mechanism for peer calls.
- Re-architecting identity-vessel. The handshake endpoint already exists in spirit (`/v1/jwt/generate`); this proposal formalises usage and rate-limit ceilings, not the issuance machinery.

---

## Success Criteria

1. The `X-Internal-Api-Key` bypass is removed from `repos/metabob-activity-api/src/middleware/jwtAuth.ts` and no equivalent exists in any other vessel.
2. Vessel-to-vessel calls succeed at sustained rates well above 20 req/min/IP without rate-limit errors.
3. A single canary minibob run completes without any 429 from identity-vessel; only the initial handshake (and proactive refreshes) hit `/v1/jwt/generate`.
4. A regression test asserts that an unsigned bearer token, a token signed with the wrong secret, an expired token, and a revoked-jti token are all rejected with 401.
5. A regression test asserts that an attacker-supplied `org_id` in a request body cannot override the auth-context `org_id` on any impulse-write route.
6. Observability: identity-vessel logs the rate of handshake vs. refresh vs. revocation events; receiving vessels log auth-cache hit ratio.

## Motivating Risk

If we ship a vessel-side change that increases per-request volume (live trajectory editing, expanded selection-layer fan-out, federated discovery) without this handshake, either we hit identity-vessel's rate limit and degrade, or we paper over it with more `X-Internal-Api-Key` bypasses and grow the security gap. This work unblocks throughput and closes the bypass simultaneously.

## References

- `repos/metabob-activity-api/src/middleware/jwtAuth.ts:216-228` — current bypass.
- `repos/metabob-activity-api/src/routes/impulses.ts:65, 224, 319` — bypass consumers.
- `repos/identity-vessel/src/services/validation.ts:134-176` — HMAC validator (canonical credential check).
- `repos/identity-vessel/src/index.ts` — `/v1/jwt/generate`, `/v1/auth/resolve`, `/v1/keys/validate`, `/v1/keys/revoke`.
- CLAUDE.md `## Authentication` section — current auth model documented.
