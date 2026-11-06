# Proposal: `auth_token_source` on the caller side, and cross-vessel delegation

**Proposed change.** The contract field itself is built and described in
[`docs/specs/auth-token-source-field.md`](../../../docs/specs/auth-token-source-field.md).
Nothing below is built yet: no caller reads the field, no vessel emits or reads the
delegation headers, and identity-vessel has no delegation mint endpoint. Section numbers
follow the original spec.

### 4.2 Per-token-source lookup table (caller-side)

Each caller maintains a map from `AuthTokenSource`
to a credential resolver. The resolver returns the raw token string or
`undefined`. The Authorization header is then formatted per `auth_scheme`.

For a caller extending its header builder — the fleet's only such builder is
`buildAuthHeaders` in `repos/development-vessel/src/resolvers/concept.ts`:

| `auth_token_source`  | Lookup chain                                                                                              | If undefined            |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------- |
| `"caller_identity"`  | caller-supplied vessel config → `process.env.METABOB_API_KEY`                                             | warn, omit header (matches the existing builder) |
| `"service_identity"` | identical to `"caller_identity"`                                                                          | identical                |
| `"user_identity"`    | `runtimeContext.userJwt` → `process.env.METABOB_USER_JWT` (last-resort, REPL `/auth user-jwt …` writes it) | **fail fast** per §4.4   |
| `"no_token"`         | always returns undefined (never attaches header)                                                          | n/a                      |

Notes:

- The `"caller_identity"` chain reproduces what the existing builder does.
  No regression.
- `"user_identity"` does not fall back to caller_identity. Sending the
  service key when a user key was asked for is wrong (wrong `$auth`,
  wrong scoping); the vessel asked for one thing, we silently sent
  another. Fail fast, surface the policy gap.
- `runtimeContext.userJwt` is a new field on the runtime context (see §6).

### 4.4 Dispatch policy on missing token

When the requested `auth_token_source` resolves to `undefined`:

| Source                | Policy                  | Rationale                                                                                                              |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `caller_identity`     | warn, send anonymous    | Current behavior; preserves backward compat. Vessel will reject with 401 if it cares; caller learns from the failure. |
| `service_identity`    | warn, send anonymous    | Same as `caller_identity`.                                                                                             |
| `user_identity`       | **fail fast**           | Sending service identity when user identity was requested is a silent scoping bug. Throw before the network call.      |
| `no_token`            | n/a (always undefined)  | Field's whole purpose.                                                                                                 |

The fail-fast error for `user_identity`:

```
VesselAuthError: vessel <id> requested auth_token_source=user_identity but
no user JWT is present in the runtime context. Either pass a user JWT via
RuntimeContext.userJwt or do not invoke this vessel from this code path.
```

This surfaces the wiring gap exactly where it matters instead of letting
the call hit the network with the wrong credential and getting a confusing
403.

---

## 5. Cross-vessel delegation

Once `user_identity` exists, vessel A holding a user JWT will inevitably
need to call vessel B "as the user." The cases to design for: goal-host-vessel →
a user-scoped UI vessel (one hop, originator holds the JWT); goal-host-vessel → vessel A
→ vessel B where A's resolver itself calls B (multi-hop); deeper chains
of intermediates.

### 5.1 Risks

- **Confused deputy.** A holds the user's JWT and calls B. B trusts A
  because A presented the JWT. But the user-to-A consent does not
  transitively authorize user-via-A-to-B; A could be using the JWT
  beyond its intent.
- **Token amplification.** A long-lived service key minting many
  short-lived user-bound tokens is privilege scaling. The reverse — a
  short-lived user JWT deriving even shorter, narrower tokens — is
  safer. Forwarding the original is safest of all because it cannot be
  amplified.
- **Replay.** A captured user JWT may be re-used against a different
  vessel or after the user revoked access at A.
- **Audit blindness.** B logs "user X requested Y" but doesn't see that
  A was in the chain.
- **Token leakage.** User JWTs ending up in execution traces, error
  messages, broadcast WebSocket events, or logs at vessels that should
  never have seen them.

### 5.2 Delegation models considered

| Model         | Mechanism                                                                 | Confused deputy   | Replay window      | Cost                                        |
| ------------- | ------------------------------------------------------------------------- | ----------------- | ------------------ | ------------------------------------------- |
| **Forward**   | A sends user JWT to B unchanged                                           | High (B can't distinguish A's call from user's) | user-JWT TTL (~15min) | Zero (no extra hop)                  |
| **Mint**      | A asks identity-vessel for token bound to `{user, target=B, granted_by=A, exp=60s, jti}` | Low (`granted_by` claim) | ~60s, single-use     | Identity-vessel roundtrip per hop      |
| **Hybrid**    | Forward inside one trust domain, mint at boundaries                       | Medium (per-domain) | Mixed              | Zero inside, roundtrip across            |

### 5.3 Decision

**Hybrid, with forwarding as the default and minting reserved for
explicitly-bounded calls.** All vessels in the metabob cluster share
identity-vessel as JWT issuer; the cluster is one trust domain. Within
it, forwarding is acceptable — every vessel verifies against the same
JWKS, audience is `aud: metabob`. Each forwarded hop carries
delegation-metadata headers (§5.5) so the chain is auditable even
though the token doesn't change. Vessels that need narrower audience,
single-use nonces, or are outside the trust domain advertise
`auth_delegation_mode: "mint"`.

The decision factor: forwarding is what the system can already support
(JWKS verification exists, no identity-vessel changes required).
Minting requires an identity-vessel API addition (§5.9); defaulting to
mint without it would break every `user_identity` consumer. Forwarding
plus metadata headers covers user-scoped UI and per-user audit reads,
and minting is a mode change that does not touch the field surface.

### 5.4 Contract additions for delegation

Add a sibling field to `auth_token_source`:

```typescript
/**
 * For vessels that advertise auth_token_source: "user_identity", this
 * field declares how the caller obtains the token to send.
 *
 * Default when absent: "forward" — forwarding model, the user JWT the
 * caller already holds is passed through unchanged.
 *
 * Values:
 *   "forward" — caller forwards the user JWT it already holds in its
 *               runtime context. Requires shared trust domain (same
 *               issuer, compatible audience). Caller must also send the
 *               delegation-metadata headers per §5.5.
 *
 *   "mint"    — caller asks identity-vessel to mint a target-bound,
 *               short-TTL, single-use delegated token, and sends that.
 *               Used at trust-domain boundaries or by vessels that need
 *               narrowed audience / replay protection.
 *
 *   "none"    — vessel does not accept delegation. If the caller doesn't
 *               itself hold a user identity (i.e., the user JWT in the
 *               runtime context was issued *to* the caller, not received
 *               from upstream), it must not invoke this vessel.
 */
auth_delegation_mode?: AuthDelegationMode

export type AuthDelegationMode = "forward" | "mint" | "none"

export const DEFAULT_AUTH_DELEGATION_MODE: AuthDelegationMode = "forward"
```

This is meaningful only when `auth_token_source === "user_identity"`. For
every other token source, callers ignore it (and the registration form
should not bother setting it).

### 5.5 Delegation metadata headers

Even in the forwarding model, the delegation chain has to be auditable.
Define two headers that travel alongside the forwarded JWT:

```
X-Metabob-Delegation-Chain: <vessel-id>,<vessel-id>,...
X-Metabob-Delegation-Hop: <integer, starting at 1>
```

`X-Metabob-Delegation-Chain` is the ordered list of vessels through which
the request has passed, root-first. The originating caller (goal-host-vessel, the
dashboard) sets it to its own vessel ID. Every vessel that forwards the
user JWT must append its own vessel ID before sending. Receiving vessel B
sees `X-Metabob-Delegation-Chain: goal-host-vessel,vesselA` and now knows the
provenance.

`X-Metabob-Delegation-Hop` is the integer hop count, set to `1` by the
originator and incremented by each forwarder. It is redundant with the
chain length but makes hop-count limits cheap to enforce — receiving
vessels can reject `Hop > 4` without parsing the chain.

A receiving vessel that has `auth_delegation_mode: "mint"` (or the
equivalent strict policy) **rejects** any request with
`X-Metabob-Delegation-Hop > 1` whose Authorization carries the original
user JWT — that combination is "you forwarded when I said mint."

These headers are advisory for forwarding mode (audit-only) and
load-bearing for stricter modes (rejection criteria).

### 5.6 Receiver verification

When vessel B receives a request whose `Authorization` carries a user
JWT, B verifies in this order:

1. **JWT signature** against identity-vessel JWKS (existing path).
2. **Audience claim**. For forwarding, the audience must include B's
   vessel ID or the cluster's broad `metabob` audience. For minted
   tokens, the audience must be exactly B's vessel ID — anything else is
   a misrouted token.
3. **TTL**. JWT `exp` must be in the future. Minted delegated tokens
   carry their own short TTL claim (typically 60s); forwarded user JWTs
   carry the user-JWT TTL (typically 15min).
4. **Single-use, if minted.** Minted tokens carry a `jti` claim;
   identity-vessel maintains a short replay window (token TTL + jitter)
   in which a `jti` can be used at most once. Receiver checks with
   identity-vessel, or — in higher-throughput deployments —
   identity-vessel publishes used-jti events on a topic the receiver
   subscribes to. Single-use enforcement applies only to minted tokens.
5. **Delegation chain consistency.** If `X-Metabob-Delegation-Hop > 1`,
   the JWT must carry a `granted_by` claim (mint mode) or the chain
   header must be present and non-empty (forward mode). Contradictions
   fail closed.
6. **Policy.** The receiver may apply per-vessel allowlists ("react-
   renderer accepts forwarded user JWTs only via goal-host-vessel or the
   dashboard"). This lives in receiver config, not in the contract — the
   contract just guarantees the receiver can reconstruct who handed it
   the token.

After verification, the receiver populates its `$auth` context from the
JWT subject (the original user) — unchanged from the non-delegated
path. The chain headers are
recorded in the execution trace alongside `resolved_by_vessel_id`.

### 5.7 Token-leakage surfaces

Where forwarded or minted user JWTs might end up that they shouldn't:

- **Execution traces** persisted to SurrealDB. Trace serializer redacts
  `Authorization` and `X-User-JWT` headers, including outbound HTTP
  requests recorded by tools.
- **Error messages and stack traces.** The header builder and the HTTP
  layer scrub `Authorization` from any error path before throw/log;
  `VesselAuthError` never includes the token.
- **Broadcast / WebSocket events** to dashboards. Event serializer at
  activity-api and goal-host-vessel's HTTP server redacts known auth headers.
  Use a serialization whitelist, not a blacklist.
- **Resolver logs in HTTP-shaped tools** (e.g. a fetch resolver). The
  resolver redacts `Authorization` and `X-User-JWT` from its own
  logging. Code-review checklist for any new HTTP-shaped resolver.
- **Discovery-vessel logs.** Discovery does not consume user identity;
  any incoming `X-User-JWT` or JWT-shaped `Authorization` is rejected
  with a warning.
- **Activity-api stored requests.** Request-logging path redacts
  headers and well-known JWT-shaped fields. Test with a synthetic
  token prefix and grep stored data.
- **Crash / panic dumps.** Out of spec scope; flagged for ops. Short
  user-JWT TTL is the operational mitigation.

The recurring rule: **redact known auth header names at every
serialization boundary, by name, in code, with tests.** Leakage will
not be caught by review; it has to be enforced mechanically.

### 5.8 Replay risk

- **Forwarded user JWT.** TTL is the user-JWT TTL (on the order of 15min).
  Replayable within that window against any vessel that accepts the
  cluster audience. Mitigation: keep user-JWT TTLs short (already true);
  `X-Metabob-Delegation-Hop` cap (e.g., 4) limits how far a replayed token
  can spread; a captured token cannot be re-used at a vessel that
  advertises `auth_delegation_mode: "mint"` because that vessel rejects
  forwarded tokens by definition.
- **Minted delegated token.** TTL is short (60s default). Audience-bound
  to the target vessel. Single-use via `jti` claim. Even if captured,
  cannot be replayed at any other vessel and cannot be replayed twice at
  the same vessel.
- **`X-Metabob-Delegation-Chain` spoofing.** A malicious vessel could
  rewrite the chain header to omit itself. The chain is advisory in
  forward mode — for forensic value, not for trust decisions. Trust
  decisions in mint mode rest on the JWT's signed `granted_by` claim,
  which the malicious vessel cannot forge without identity-vessel.

### 5.9 Identity-vessel scope

Identity-vessel must, at minimum, gain a mint endpoint to support
`auth_delegation_mode: "mint"`. The endpoint is **not in the initial
implementation order** of this spec — forwarding mode covers the first
consumers (user-scoped UI, per-user audit reads). When the first
mint-mode vessel is needed, the work is:

```
POST /v2/tokens/delegate
Authorization: ApiKey <calling-vessel-service-key>
Body: {
  user_jwt: "<the user JWT held by the caller>",
  target_vessel_id: "<vessel B>",
  ttl_seconds: 60
}
Returns: {
  delegated_token: "<JWT with subject=user, aud=B, granted_by=A, jti=<uuid>>",
  expires_at: "<iso8601>"
}
```

Identity-vessel verifies the user JWT, applies a delegation policy
(per-org / per-vessel allowlist), records the mint, and signs the new
token. Single-use enforcement is identity-vessel's responsibility.

This API is on the identity-vessel roadmap; this spec depends on it for
the mint mode. Forwarding mode does not depend on it.

---

## 6. Implementation outline

### 6.1 Shared types: `@avigopal/vessel-discovery-client`

In `packages/vessel-discovery-client/src/types.ts`: add `AuthTokenSource`
and `AuthDelegationMode` types and their defaults next to
`ResolveAuthScheme`; add both optional fields to `DiscoveryConfig`,
`VesselRegistration`, and `VesselCapability`; update the JSDoc on
`VesselCapability` to mention them. `registration.ts` passes both fields
through on register/heartbeat. Purely additive — no existing consumer breaks.

### 6.2 `repos/discovery-vessel`

In `src/types.ts`: add the types and defaults alongside
`ResolveAuthScheme`; add both fields to `VesselRegistration`,
`RegisterRequest`, and `VesselCapability`.

`src/registry.ts` stores both fields and applies defaults at write time
when absent (a client that omits them still gets values back). `src/resolvers.ts`
includes both fields in `vesselCapability` and `vesselRegistry`
payloads. `src/server.ts` rejects (with warning) any incoming request on
discovery's own endpoints that carries `X-User-JWT` or a JWT-shaped
`Authorization` — discovery is `caller_identity` only. No new endpoints,
no schema migration (registry is in-memory).

### 6.3 The calling vessel

No vessel implements this side. The work, wherever the calling vessel
builds its outbound headers — `buildAuthHeaders` in
`repos/development-vessel/src/resolvers/concept.ts` is the fleet's only such
builder, and it reads neither contract field:

- Extend the header builder to accept `tokenSource: AuthTokenSource =
  "caller_identity"` and `delegationMode: AuthDelegationMode = "forward"`.
  Dispatch on `tokenSource` per §4.2; apply precedence rules per §4.3
  (early-return for `scheme === "none"` and `tokenSource === "no_token"`).
- Carry `userJwt?: string` and `delegationChain?: string[]` on whatever
  options object the resolve call already threads, populated from the
  runtime context.
- The code that builds the resolve request reads both fields off the
  discovered vessel record, defaults them, and passes them through.
- For `user_identity` + `forward`: attach the JWT and emit
  `X-Metabob-Delegation-Chain` and `X-Metabob-Delegation-Hop` per §5.5.
  Chain is `[caller-vessel-id]` for an originator, or
  `[...upstream, caller-vessel-id]` for a forwarder.
- For `mint`: resolve via the identity-vessel delegate endpoint (§5.9).
  Until that endpoint exists, throw `VesselAuthError` with "mint mode
  requires identity-vessel delegate endpoint" — fail closed.
- Throw `VesselAuthError` for `user_identity` + missing-jwt per §4.4.
  Error messages must never include the token; same rule applies to
  any future refresh paths (§5.7).

Wherever the runtime context type lives, add `userJwt?: string` and
`delegationChain?: string[]` and plumb them through the activity executor.
The HTTP entry point accepts `X-User-JWT` and `X-Metabob-Delegation-Chain`
on incoming goal requests, propagates them into the runtime context, and
redacts both from every request log line.

The calling vessel's resolve-call tests extend per §7.

### 6.4 Existing vessel advertisements

Each existing vessel's `discovery-client.ts` adds `auth_token_source:
'caller_identity'` to its registration object — explicit declarative
annotation, no behavior change. Both of these carry it:

- `repos/concept-db/src/services/discovery-client.ts`. PERMISSIONS clauses
  filter on `$auth.org_id` from the caller's token; service identity is
  correct as long as it's tenant-scoped.
- `repos/activity-api/src/services/discovery-client.ts`. Same rationale.

### 6.5 Future vessels

- **identity-vessel** (when it advertises): `auth_token_source:
  "caller_identity"` for service-to-service. The mint endpoint (§5.9)
  is a separate API surface on identity-vessel itself, not part of the
  discovery contract.
- **A user-scoped UI vessel**: `auth_token_source: "user_identity"`,
  `auth_delegation_mode: "forward"`. UI state is per-user; cluster
  trust domain sufficient.
- **per-user audit-vessel (hypothetical)**: `auth_token_source:
  "user_identity"`, `auth_delegation_mode: "mint"`. Its arrival is the
  trigger for landing the identity-vessel mint endpoint.

### 6.6 Per-vessel summary

| Vessel                     | `auth_scheme`         | `auth_token_source` | `auth_delegation_mode` | Notes                                      |
| -------------------------- | --------------------- | ------------------- | ---------------------- | ------------------------------------------ |
| concept-db                 | `ApiKey`              | `caller_identity`   | (n/a; absent)          | Tenant scoping via caller's `$auth.org_id` |
| activity-api               | `ApiKey`              | `caller_identity`   | (n/a; absent)          | Same as concept-db                         |
| discovery-vessel           | `none`                | (absent → default)  | (n/a)                  | No auth on resolve                         |
| identity-vessel            | `ApiKey` (likely)     | `caller_identity`   | (n/a; absent)          | Mint endpoint is separate API surface      |
| user-scoped UI vessel      | `Bearer`              | `user_identity`     | `forward`              | One-hop user UI                            |
| audit-vessel (hypothetical)| `Bearer`              | `user_identity`     | `mint`                 | Audience-bound, replay-resistant           |

---

## 7. Test plan

### 7.1 Unit: header builder per token-source

Extend the calling vessel's header-builder tests with one case per cell of
the table in §4.3 plus the dispatch-policy cases in §4.4. New cases beyond
the `caller_identity` paths:

- `service_identity` + env present → `"ApiKey <env>"` (alias).
- `user_identity` + `userJwt` present + `Bearer` → `"Bearer <userJwt>"`
  with delegation headers.
- `user_identity` + no `userJwt` → throws `VesselAuthError` (fail-fast).
- `user_identity` + `userJwt` + `ApiKey` → `"ApiKey <userJwt>"`
  (unusual but allowed).
- `no_token` + any scheme → undefined (escape hatch).
- `none` scheme + `user_identity` → undefined, no throw (scheme wins).
- absent `auth_token_source` → behaves as `caller_identity`
  (backward-compat default).

### 7.2 Unit: delegation header construction

- Originator, `forward` mode →
  `X-Metabob-Delegation-Chain: <caller-vessel-id>`,
  `X-Metabob-Delegation-Hop: 1`.
- Forwarder with inbound chain `[upstream]`, `forward` →
  chain `[upstream, caller-vessel-id]`, hop `2`.
- `mint` mode without mint client wired → `VesselAuthError` matching
  `/mint mode not yet/`.

### 7.3 Unit: the resolve-request builder reads both fields

Vessel advertising each combination of (`auth_token_source`,
`auth_delegation_mode`) is dispatched correctly. A registration with
no fields produces the default `caller_identity` behavior.

### 7.4 Integration: discovery roundtrip

Register a mock vessel with each combination, resolve
`vesselCapability`, assert both fields round-trip intact. Register
without either field, assert defaults applied at write time.

### 7.5 Integration: end-to-end against a fake vessel

Drive the caller's vessel-resolve path against an in-process HTTP server.
The fake vessel asserts incoming `Authorization` matches the expected token per its
advertised `auth_token_source`, and that delegation headers appear when
expected. One test per (caller_identity, user_identity+forward,
no_token).

### 7.6 Regression: existing call paths

The caller's existing resolve-call tests must pass unchanged. The default
`caller_identity` + absent-delegation behavior is the spine of backward
compatibility.

### 7.7 Token-leakage tests

For each redaction surface in §5.7: construct an event/trace/log with
a known synthetic JWT prefix, pass through the serializer, grep the
output for the prefix, assert absent. Mechanical insurance against the
leakage classes that review will not catch.

---

## 9. Open questions

### 9.1 Caller without a user JWT, but `user_identity` requested

§4.4 says fail-fast. Alternative policies considered:

- Anonymous (send no token) — silently strips auth, vessel returns 401,
  user sees confusing error.
- Fall back to caller_identity — silently sends wrong identity, vessel
  may accept it and return wrong-tenant data.

Both alternatives are silent bugs. Fail-fast is correct. But it does
make `user_identity` vessels unreachable from idle/boredom code paths
(no user in context) until the boredom system is taught to either skip
those vessels or set up a service-account fallback. Deferred.

### 9.2 Token freshness

A user JWT in `runtimeContext.userJwt` may expire mid-execution. The
spec treats the token as opaque; the vessel will return 401 if it's
stale, and the caller surfaces the failure. A future addition may
introduce token-refresh hooks (re-call identity-vessel with a refresh
token), at which point the refresh path must obey the same redaction
rules as §5.7.

### 9.3 Multiple service identities

`"service_identity"` is reserved as an alias for `"caller_identity"`,
anticipating a future where a caller carries multiple service tokens
(per-vessel keys, per-environment keys). When that materializes, the
contract grows: either `service_identity` becomes parameterized
(`"service_identity:concept-db"`) or we add a sibling field
(`auth_token_audience`).

### 9.4 Naming: `auth_token_source` vs `auth_principal` vs `auth_subject`

`auth_token_source` describes where the token comes from;
`auth_principal` or `auth_subject` describes whose identity it
represents. The latter is arguably cleaner ontology — the contract says
"I want a token whose subject is the user," not "I want a token sourced
from this place." This spec keeps `auth_token_source` because it
composes with `auth_scheme` symmetrically (both about the token, one
says how it's framed, one says where it's drawn from). If during
implementation review the naming feels wrong, `auth_principal` is a
fine alternative — pick one before merging the type into the shared
package.

### 9.5 Hop-count cap

§5.5 mentions a `Hop > 4` rejection rule but doesn't fix the constant.
Cap should be small (3–4) to constrain blast radius; the value lives in
receiver config, not the contract. Pick on first integration.

### 9.6 Trust-domain boundary criteria

The decision in §5.3 ("forward inside the cluster, mint at boundaries")
defers the precise definition of "cluster boundary" until a
boundary-crossing vessel exists. Every vessel in the fleet shares one
identity-vessel; the question matters when, e.g., a partner's vessel
joins the registry under a different issuer. At that point: define
issuer-equivalence-classes, and any cross-class call defaults to
`mint`.
