# `auth_token_source` Contract Field

Scope: a fifth field on the vessel resolve contract — alongside the four added
in Wave 1A (`resolve_endpoint`, `resolve_request_format`, `auth_scheme`,
`resolve_timeout_ms`) — that lets a vessel declare *which credential* the
caller should attach, not just *which scheme*. Closes the residual gap from
the Wave-1 typology investigation: vessels say "I need Bearer auth," callers
must externally guess where the token comes from.

This spec covers two coupled problems:

1. The credential-kind declaration itself (the `auth_token_source` field).
2. **Cross-vessel delegation**: when vessel A is itself serving a user
   request and needs to call vessel B "as the user," what does A send and
   how does B verify it? Delegation is in scope from the start because the
   field's primary new consumer (`user_identity`) is meaningless without a
   delegation story — the only way a non-edge vessel ends up holding a user
   JWT is by receiving it from an upstream vessel, and the only way it
   forwards it safely is by spec.

Status: **Partially Implemented (Wave A3, 2026-04-23)**
- ✅ `auth_token_source` field added to vessel registration contract
- ✅ `auth_delegation_mode` field added to vessel registration contract
- ✅ Activity-API declares `auth_token_source: 'caller_identity'` and `auth_delegation_mode: 'forward'` on registration
- ⏳ Delegation header surface pending (awaiting first `user_identity` consumers)

Phased rollout: the credential-kind field now lands with `caller_identity` declared on existing vessels (no behavior change), delegation header surface to follow when first `user_identity` consumers come online.

---

## 1. Problem

The current resolve contract on `VesselCapability` has `auth_scheme:
"none" | "ApiKey" | "Bearer"` (see
`packages/vessel-discovery-client/src/types.ts:176` and
`repos/discovery-vessel/src/types.ts:26`). When minibob's
`buildAuthHeader` (`repos/minibob/src/resolvers/vessel-resolve-call.ts:84`)
sees `auth_scheme: "ApiKey"`, it builds the header from
`vesselConfig?.apiKey || process.env.METABOB_API_KEY ||
AuthService.getToken()`. That chain resolves to one identity: **the
caller's service key**. Concept-db and activity-api both want exactly
this — they trust the caller's identity for tenant scoping.

The gap appears as soon as a vessel needs a *different* credential:

- **react-renderer** (when it lands) renders user-scoped UI state and
  needs the user's JWT so `$auth.user_id` in SurrealDB resolves to the
  end user, not minibob.
- **identity-vessel**, when called from a vessel acting on behalf of a
  user, may need the user JWT to mint a delegated token.
- A future audit/billing vessel may want the original-user token,
  distinct from any intermediate service identity.

There is no way for these vessels to say "give me the user's token, not
yours." Callers resolve credentials by out-of-band convention, and that
convention says one thing only: service identity from env. The Wave-1
typology investigation flagged this — vessels declare "I need Bearer
auth" but callers must externally resolve the credential, blocking
fully automated discovery-driven invocation.

This spec adds the missing field and the delegation surface that makes
the field safe to use end to end.

---

## 2. Constraints

**Foundation alignment.** Vessels declare what they need; callers honor
the declaration. Same shape as the four Wave-1A contract fields. The
field is descriptive metadata on the registration record, not behavior.

**Backward compatibility.** No vessel advertises this today. Every current
call path uses service identity. The default-when-absent must reproduce
today's behavior bit-for-bit.

**No new vessels become reachable as a side effect.** Adding the field
must not change which vessels minibob can talk to. If a vessel asks for a
token type the caller can't supply, the call fails — discoverable problem,
not silent regression.

**No identity-vessel coupling in the contract type.** The contract is a
pure data type shared by every vessel. It can't import identity-vessel or
encode identity-vessel record IDs. The field is a *kind* — an opaque
symbol the caller maps to a credential. How the caller obtains the
credential is the caller's business.

**One field, not a structure.** The contract already carries five
`resolve_*` fields and four `metadata` fields. A nested
`auth_metadata: { kind, scope, audience }` object is more flexible but
forces every caller to re-implement interpretation. Initial scope is one
symbolic string plus a sibling `auth_delegation_mode`; revisit if a real
vessel needs more.

**Delegation is opt-in, never silent.** A vessel that does not advertise a
delegation expectation must not have any caller behavior change: no token
forwarded, no metadata header injected, no audit hop appended. The point
of the contract is that absence-of-declaration is a meaningful default.

---

## 3. Design alternatives

Four shapes were considered for the credential-kind field. Delegation
alternatives are covered in §5.

### 3.1 Symbolic strings (recommended)

```typescript
auth_token_source?:
  | "caller_identity"   // caller's own service token (today's behavior)
  | "user_identity"     // a user JWT the caller is acting on behalf of
  | "service_identity"  // explicit alias for caller_identity, future-reserved
  | "no_token"          // belt-and-suspenders: vessel explicitly wants no token
```

The vessel says *what kind* of token it wants. The caller maps that
kind to a concrete credential from its runtime context. Nothing in the
contract references identity-vessel, env vars, or config paths.

Smallest possible contract; caller decides how to map kinds to tokens;
no leakage of caller-internal naming; new kinds added by extending the
union. Trade-off: the set of kinds becomes a contract that evolves
carefully, and definitions ("what does `user_identity` mean for an
anonymous user?") need a spec table — see §4.1.

### 3.2 Lookup paths — rejected

```typescript
auth_token_source?: "env:METABOB_API_KEY" | "config:metabob.apiKey" | ...
```

Brittle (each caller has different env vars), leaks caller-internal
structure into the registration contract, makes vessels know about
minibob's specific configuration.

### 3.3 Token kinds tied to identity-vessel — rejected

```typescript
auth_token_source?: "identity-vessel:user" | "identity-vessel:service"
```

Bakes a specific vessel into the contract namespace; if identity-vessel
is renamed or replaced, every registration breaks. Symbolic strings
(3.1) capture the same intent without the coupling.

### 3.4 Free-form metadata — rejected

```typescript
auth_metadata?: { kind?, scope?, audience? }
```

Maximally flexible, minimally interoperable: every caller has to handle
every combination with no shared vocabulary. If scopes/audiences are
later needed, grow the union or add a sibling field instead of an open
bag.

### 3.5 Decision

Pick **3.1**. It's the smallest contract that gives callers enough
information; composes with `auth_scheme` (which says *how to format*
the header) without overlap; doesn't couple to caller config or to
identity-vessel; not-found is a clean policy decision per §4.4.

---

## 4. Recommended design (credential kind)

### 4.1 The field

Add to `RegisterRequest`, `VesselRegistration`, and `VesselCapability` in
both `packages/vessel-discovery-client/src/types.ts` and
`repos/discovery-vessel/src/types.ts`:

```typescript
/**
 * Which credential kind the caller should attach when invoking this
 * vessel's resolve endpoint. Pairs with `auth_scheme`, which says *how* to
 * format the Authorization header; this field says *whose* token to format.
 *
 * Default when absent: "caller_identity" — the caller attaches its own
 * service identity (preserves pre-rollout behavior).
 *
 * Values:
 *   "caller_identity"  — caller's own service token (e.g., minibob's
 *                        METABOB_API_KEY). Used by vessels that trust the
 *                        caller's federated identity for tenant scoping.
 *
 *   "user_identity"    — a user JWT the caller is acting on behalf of.
 *                        Used by vessels that need user-scoped state (UI
 *                        vessels, per-user audit). Caller must have a user
 *                        token in runtime context; if absent, dispatch
 *                        fails per §4.4.
 *
 *   "service_identity" — explicit alias for "caller_identity" reserved for
 *                        future when callers may have multiple service
 *                        tokens (per-vessel keys, per-environment keys).
 *                        Treated identically to "caller_identity" today.
 *
 *   "no_token"         — vessel explicitly wants no Authorization header,
 *                        even if `auth_scheme` would normally attach one.
 *                        Distinct from `auth_scheme: "none"` which says
 *                        "I don't care about auth"; this says "I care, and
 *                        I want it omitted." Edge case for proxy/preflight.
 */
auth_token_source?: AuthTokenSource

export type AuthTokenSource =
  | "caller_identity"
  | "user_identity"
  | "service_identity"
  | "no_token"

export const DEFAULT_AUTH_TOKEN_SOURCE: AuthTokenSource = "caller_identity"
```

### 4.2 Per-token-source lookup table (caller-side)

Each caller (today, only minibob) maintains a map from `AuthTokenSource`
to a credential resolver. The resolver returns the raw token string or
`undefined`. The Authorization header is then formatted per `auth_scheme`.

For minibob (`buildAuthHeader` extension):

| `auth_token_source`  | Lookup chain                                                                                              | If undefined            |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------- |
| `"caller_identity"`  | `vesselConfig.apiKey` → `process.env.METABOB_API_KEY` → `AuthService.getToken()`                          | warn, omit header (current behavior) |
| `"service_identity"` | identical to `"caller_identity"`                                                                          | identical                |
| `"user_identity"`    | `runtimeContext.userJwt` → `process.env.METABOB_USER_JWT` (last-resort, REPL `/auth user-jwt …` writes it) | **fail fast** per §4.4   |
| `"no_token"`         | always returns undefined (never attaches header)                                                          | n/a                      |

Notes:

- The `"caller_identity"` chain is exactly the chain `buildAuthHeader`
  uses today. No regression.
- `"user_identity"` does not fall back to caller_identity. Sending the
  service key when a user key was asked for is wrong (wrong `$auth`,
  wrong scoping); the vessel asked for one thing, we silently sent
  another. Fail fast, surface the policy gap.
- `runtimeContext.userJwt` is a new field on the runtime context (see §6).

### 4.3 Composition with `auth_scheme`

`auth_scheme` and `auth_token_source` are orthogonal:

|                         | `auth_scheme: "none"`                | `auth_scheme: "ApiKey"`              | `auth_scheme: "Bearer"`              |
| ----------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `auth_token_source` absent / `caller_identity` | no header                  | `ApiKey <caller_identity>`           | `Bearer <caller_identity>`           |
| `auth_token_source: "user_identity"`           | no header (scheme wins)    | `ApiKey <user_jwt>` (unusual; allowed) | `Bearer <user_jwt>` (typical)       |
| `auth_token_source: "no_token"`                | no header                  | no header (token_source wins over scheme) | no header                       |

Rules of precedence:

1. If `auth_scheme: "none"` → no header, regardless of `auth_token_source`.
2. If `auth_token_source: "no_token"` → no header, regardless of
   `auth_scheme`.
3. Otherwise: format per `auth_scheme`, content per `auth_token_source`.

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
need to call vessel B "as the user." The cases to design for: minibob →
react-renderer (one hop, originator holds the JWT); minibob → vessel A
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

The decision factor: forwarding is what the system can support today
(JWKS verification exists, no identity-vessel changes required).
Minting requires an identity-vessel API addition (§5.9) that has not
landed; defaulting to mint would brick every `user_identity` consumer
until that work ships. Forwarding plus metadata headers is enough to
unblock react-renderer and per-user audit reads. Minting lands later
as a mode change without touching the field surface.

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
the request has passed, root-first. The originating caller (minibob, the
dashboard) sets it to its own vessel ID. Every vessel that forwards the
user JWT must append its own vessel ID before sending. Receiving vessel B
sees `X-Metabob-Delegation-Chain: minibob,vesselA` and now knows the
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
   renderer accepts forwarded user JWTs only via minibob or the
   dashboard"). This lives in receiver config, not in the contract — the
   contract just guarantees the receiver can reconstruct who handed it
   the token.

After verification, the receiver populates its `$auth` context from the
JWT subject (the original user) — same as today. The chain headers are
recorded in the execution trace alongside `resolved_by_vessel_id`.

### 5.7 Token-leakage surfaces

Where forwarded or minted user JWTs might end up that they shouldn't:

- **Execution traces** persisted to SurrealDB. Trace serializer redacts
  `Authorization` and `X-User-JWT` headers, including outbound HTTP
  requests recorded by tools.
- **Error messages and stack traces.** `buildAuthHeader` and the HTTP
  layer scrub `Authorization` from any error path before throw/log;
  `VesselAuthError` never includes the token.
- **Broadcast / WebSocket events** to dashboards. Event serializer at
  activity-api and minibob's HTTP server redacts known auth headers.
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

- **Forwarded user JWT.** TTL is the user-JWT TTL (15min today).
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
consumers (react-renderer, per-user audit reads). When the first
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

### 6.1 Shared types: `@metabob/vessel-discovery-client`

In `packages/vessel-discovery-client/src/types.ts`: add `AuthTokenSource`
and `AuthDelegationMode` types and their defaults next to
`ResolveAuthScheme` (line 176); add both optional fields to
`DiscoveryConfig` (line 18), `VesselRegistration` (line 103), and
`VesselCapability` (line 188); update the JSDoc on `VesselCapability`
(line 184) to mention them. `registration.ts` passes both fields through
on register/heartbeat. Purely additive — no existing consumer breaks.

### 6.2 `repos/discovery-vessel`

In `src/types.ts`: add the types and defaults alongside
`ResolveAuthScheme` (line 26); add both fields to `VesselRegistration`
(line 88), `RegisterRequest` (line 316), `VesselCapability` (line 221).

`src/registry.ts` stores both fields and applies defaults at write time
when absent (older clients always get values back). `src/resolvers.ts`
includes both fields in `vesselCapability` and `vesselRegistry`
payloads. `src/server.ts` rejects (with warning) any incoming request on
discovery's own endpoints that carries `X-User-JWT` or a JWT-shaped
`Authorization` — discovery is `caller_identity` only. No new endpoints,
no schema migration (registry is in-memory).

### 6.3 `repos/minibob`

`src/resolvers/vessel-resolve-call.ts`:

- Extend `buildAuthHeader` (line 84) to accept `tokenSource:
  AuthTokenSource = "caller_identity"` and `delegationMode:
  AuthDelegationMode = "forward"` parameters. Dispatch on `tokenSource`
  per §4.2; apply precedence rules per §4.3 (early-return for
  `scheme === "none"` and `tokenSource === "no_token"`).
- Extend `VesselResolveCallOptions` (line 52) with `userJwt?: string`
  and `delegationChain?: string[]`, populated by
  `buildResolveRequest`'s caller from the runtime context.
- `buildResolveRequest` (line 152) reads both fields from `vessel`,
  defaults appropriately, passes them through.
- For `user_identity` + `forward`: attach the JWT and emit
  `X-Metabob-Delegation-Chain` and `X-Metabob-Delegation-Hop` per §5.5.
  Chain is `[minibob-vessel-id]` for an originator, or
  `[...upstream, minibob-vessel-id]` for a forwarder.
- For `mint`: resolve via the identity-vessel delegate endpoint (§5.9).
  Until that endpoint exists, throw `VesselAuthError` with "mint mode
  requires identity-vessel delegate endpoint" — fail closed.
- Throw `VesselAuthError` for `user_identity` + missing-jwt per §4.4.
  Error messages must never include the token; same rule applies to
  any future refresh paths (§5.7).

`src/types.ts` (or wherever `RuntimeContext` / `ExecutorConfig` lives —
investigate before implementing): add `userJwt?: string` and
`delegationChain?: string[]`, plumb through the activity executor.

`src/repl.ts`: add `/auth user-jwt <token>` and `/auth clear-user-jwt`
commands; document in `/help`.

`index.ts` (HTTP entry): accept `X-User-JWT` and
`X-Metabob-Delegation-Chain` on incoming goal requests; propagate to
`RuntimeContext`; redact both from every request log line.

`src/resolvers/vessel-resolve-call.test.ts`: extend per §7.

### 6.4 Existing vessel advertisements

Each existing vessel's `discovery-client.ts` adds `auth_token_source:
'caller_identity'` to its registration object — explicit declarative
annotation, no behavior change. Apply to:

- `repos/concept-db/src/services/discovery-client.ts` (interface line
  20, registration line 92). PERMISSIONS clauses filter on
  `$auth.org_id` from the caller's token; service identity is correct
  as long as it's tenant-scoped.
- `repos/metabob-activity-api/src/services/discovery-client.ts`
  (interface line 12, registration line 106). Same rationale.

### 6.5 Future vessels

- **identity-vessel** (when it advertises): `auth_token_source:
  "caller_identity"` for service-to-service. The mint endpoint (§5.9)
  is a separate API surface on identity-vessel itself, not part of the
  discovery contract.
- **react-renderer**: `auth_token_source: "user_identity"`,
  `auth_delegation_mode: "forward"`. UI state is per-user; cluster
  trust domain sufficient.
- **per-user audit-vessel (hypothetical)**: `auth_token_source:
  "user_identity"`, `auth_delegation_mode: "mint"`. Its arrival is the
  trigger for landing the identity-vessel mint endpoint.

### 6.6 Per-vessel summary

| Vessel                     | `auth_scheme` (today) | `auth_token_source` | `auth_delegation_mode` | Notes                                      |
| -------------------------- | --------------------- | ------------------- | ---------------------- | ------------------------------------------ |
| concept-db                 | `ApiKey`              | `caller_identity`   | (n/a; absent)          | Tenant scoping via caller's `$auth.org_id` |
| metabob-activity-api       | `ApiKey`              | `caller_identity`   | (n/a; absent)          | Same as concept-db                         |
| discovery-vessel           | `none`                | (absent → default)  | (n/a)                  | No auth on resolve today                   |
| identity-vessel            | `ApiKey` (likely)     | `caller_identity`   | (n/a; absent)          | Mint endpoint is separate API surface      |
| react-renderer             | `Bearer`              | `user_identity`     | `forward`              | One-hop user UI                            |
| audit-vessel (hypothetical)| `Bearer`              | `user_identity`     | `mint`                 | Audience-bound, replay-resistant           |

---

## 7. Test plan

### 7.1 Unit: `buildAuthHeader` per token-source

Extend `repos/minibob/src/resolvers/vessel-resolve-call.test.ts`
(existing tests at lines 173–202) with one case per cell of the table
in §4.3 plus the dispatch-policy cases in §4.4. New cases beyond the
three already-covered `caller_identity` paths:

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
  `X-Metabob-Delegation-Chain: <minibob-vessel-id>`,
  `X-Metabob-Delegation-Hop: 1`.
- Forwarder with inbound chain `[upstream]`, `forward` →
  chain `[upstream, minibob]`, hop `2`.
- `mint` mode without mint client wired → `VesselAuthError` matching
  `/mint mode not yet/`.

### 7.3 Unit: `buildResolveRequest` reads both fields

Vessel advertising each combination of (`auth_token_source`,
`auth_delegation_mode`) is dispatched correctly. A registration with
no fields produces today's `caller_identity` behavior.

### 7.4 Integration: discovery roundtrip

Register a mock vessel with each combination, resolve
`vesselCapability`, assert both fields round-trip intact. Register
without either field, assert defaults applied at write time.

### 7.5 Integration: end-to-end against a fake vessel

`callVesselResolve` against an in-process HTTP server. Fake vessel
asserts incoming `Authorization` matches the expected token per its
advertised `auth_token_source`, and that delegation headers appear when
expected. One test per (caller_identity, user_identity+forward,
no_token).

### 7.6 Regression: existing call paths

The existing `vessel-resolve-call.test.ts` tests must pass unchanged.
The default `caller_identity` + absent-delegation behavior is the spine
of backward compatibility.

### 7.7 Token-leakage tests

For each redaction surface in §5.7: construct an event/trace/log with
a known synthetic JWT prefix, pass through the serializer, grep the
output for the prefix, assert absent. Mechanical insurance against the
leakage classes that review will not catch.

---

## 8. Backward compatibility

- **No vessel advertises either field today.** Every advertised
  registration in concept-db and activity-api lacks them.
- **Default on read.** Discovery-vessel applies defaults
  (`caller_identity`, `forward`) at write time; minibob's
  `buildAuthHeader` defaults its parameters; either way, callers behave
  as today.
- **Caller without the user-JWT plumbing.** A minibob build that hasn't
  picked up the §6.3 changes simply ignores both fields and runs the
  existing chain — every vessel today wants `caller_identity`, which is
  what that build produces. New vessels needing `user_identity` will
  fail to authenticate against old minibobs, which is the right failure
  mode (the new vessel is not yet supported by that caller).
- **Receivers without delegation-chain awareness.** A vessel that
  doesn't yet read the delegation headers simply ignores them.
  Forwarding still works; the audit trail is incomplete until the
  receiver picks up the change. This is acceptable — the chain is
  advisory in forward mode.

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
anticipating a future where minibob carries multiple service tokens
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
boundary-crossing vessel exists. Today every vessel shares one
identity-vessel; the question matters when, e.g., a partner's vessel
joins the registry under a different issuer. At that point: define
issuer-equivalence-classes, and any cross-class call defaults to
`mint`.
