# `auth_token_source` Contract Field

Scope: a fifth field on the vessel resolve contract — alongside the four added
in Wave 1A (`resolve_endpoint`, `resolve_request_format`, `auth_scheme`,
`resolve_timeout_ms`) — that lets a vessel declare *which credential* the
caller should attach, not just *which scheme*. Closes the residual gap from
the Wave-1 typology investigation: vessels say "I need Bearer auth," callers
must externally guess where the token comes from.

Status: **spec only**. No implementation, no migration. v1 ships with one
real consumer (the caller-identity case, current behavior preserved) and the
shape carved out for `user_identity` so the next vessel that needs it can
adopt without a contract change.

---

## 1. Problem

The current resolve contract on `VesselCapability` has `auth_scheme: "none"
| "ApiKey" | "Bearer"` (see
`packages/vessel-discovery-client/src/types.ts:176` and
`repos/discovery-vessel/src/types.ts:26`). When minibob's
`buildAuthHeader` (see `repos/minibob/src/resolvers/vessel-resolve-call.ts:84`)
sees `auth_scheme: "ApiKey"`, it builds `Authorization: ApiKey <key>` from:

```
vesselConfig?.apiKey  ||  process.env.METABOB_API_KEY  ||  AuthService.getToken()
```

That chain resolves to one specific identity: **the caller's service key**
(minibob's `METABOB_API_KEY`, the vessel's federated identity-vessel
credential). Concept-db and activity-api both want exactly this — they
trust the caller's identity for tenant scoping, the caller's key carries the
right `org_id`, done.

The gap appears as soon as a vessel needs a *different* credential:

- **react-renderer** (when it lands) renders user-scoped UI state. It needs
  the *user's* JWT, not minibob's service ApiKey, so `$auth.user_id` in
  SurrealDB resolves to the actual end user.
- **identity-vessel** itself, when called from a vessel acting on behalf of
  a user, may need the user JWT to mint a delegated token.
- A future audit/billing vessel may want a token tagged with the original
  caller chain (`A → B → C`), distinct from B's service identity.

There is no way today for these vessels to say "give me the user's token,
not yours." Callers (today, only minibob) resolve credentials by
out-of-band convention, and that convention says one thing only: pick the
service identity from env.

The Wave-1 typology investigation flagged this:

> Vessels declare "I need Bearer auth" but callers must externally resolve
> the credential. Blocks fully automated discovery-driven invocation.

This spec adds the missing field.

---

## 2. Constraints

**Foundation alignment.** Vessels declare what they need; callers honor the
declaration. Same shape as the four Wave-1A contract fields. The field is
descriptive metadata on the registration record, not behavior.

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
forces every caller to re-implement interpretation. v1 is one symbolic
string; revisit if a real vessel needs more.

---

## 3. Design alternatives

Four shapes were considered. Each is evaluated against the constraints
above.

### 3.1 Symbolic strings (recommended)

```typescript
auth_token_source?:
  | "caller_identity"   // caller's own service token (today's behavior)
  | "user_identity"     // a user JWT the caller is acting on behalf of
  | "service_identity"  // explicit alias for caller_identity, future-reserved
  | "no_token"          // belt-and-suspenders: vessel explicitly wants no token
```

The vessel says *what kind* of token it wants. The caller maps that kind
to a concrete credential from its runtime context. Nothing in the contract
references identity-vessel, env vars, or config paths — those are the
caller's internal concern.

**Pros:**
- Smallest possible contract: one optional enum string.
- Caller decides how to map kinds to tokens; per-caller flexibility.
- No leakage of caller-internal naming (env var names, config paths).
- New kinds added by extending the union — no breaking change.

**Cons:**
- The set of kinds is a contract that has to evolve carefully. Adding
  `tenant_admin_identity` later requires every caller to handle it (same
  as adding a new `auth_scheme` value, so the precedent exists).
- Two callers might disagree on what `user_identity` means in edge cases
  (anonymous user? dashboard user vs API user?). Spec needs a definition
  table.

### 3.2 Lookup paths

```typescript
auth_token_source?: "env:METABOB_API_KEY" | "config:metabob.apiKey" | "context:user.jwt"
```

Vessel directly references where the caller should read the credential
from.

**Rejected.** Brittle (each caller has different env vars and config
shapes), leaks caller-internal structure into the registration contract,
and makes vessels know about minibob's specific configuration. Concept-db
shouldn't have an opinion about whether minibob calls its env var
`METABOB_API_KEY` or `MINIBOB_API_KEY`.

### 3.3 Token kinds tied to identity-vessel

```typescript
auth_token_source?: "identity-vessel:user" | "identity-vessel:service"
```

Names identity-vessel as the source-of-truth in the contract value.

**Rejected for v1, but informative.** This is *almost* right —
identity-vessel **is** the policy authority — but bakes a specific vessel
into the contract namespace. If identity-vessel is renamed or replaced,
every registration breaks. Symbolic strings (3.1) capture the same intent
without the coupling: callers free to internally route `"user_identity"`
to identity-vessel, but the contract doesn't say so.

### 3.4 Free-form metadata

```typescript
auth_metadata?: {
  kind?: "user" | "service" | "...",
  scope?: string,
  audience?: string
}
```

Vessel attaches an open structure; callers interpret.

**Rejected for v1.** Maximally flexible, minimally interoperable. Every
caller has to handle every possible metadata combination, with no shared
vocabulary. If we later need scopes/audiences, the right move is to grow
the symbolic-strings union (3.1) or add a *second* sibling field
(`auth_token_scope`), not replace the simple field with an open bag.

### 3.5 Recommendation: 3.1 with an explicit default

Pick **3.1**. It's the smallest contract that gives callers enough
information; it composes with `auth_scheme` (which says *how to format*
the header) without overlap; it doesn't couple to caller config or to
identity-vessel; and the not-found case is a clean policy decision rather
than an undefined behavior.

---

## 4. Recommended design

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
 * service identity (preserves pre-2026-04-24 behavior).
 *
 * Values:
 *   "caller_identity" — caller's own service token (e.g., minibob's
 *                        METABOB_API_KEY). Used by vessels that trust the
 *                        caller's federated identity for tenant scoping.
 *
 *   "user_identity"   — a user JWT the caller is acting on behalf of. Used
 *                        by vessels that need user-scoped state (UI vessels,
 *                        per-user audit). Caller must have a user token in
 *                        runtime context; if absent, dispatch fails per §4.4.
 *
 *   "service_identity" — explicit alias for "caller_identity" reserved for
 *                        future when callers may have multiple service
 *                        tokens (per-vessel keys, per-environment keys).
 *                        Treated identically to "caller_identity" in v1.
 *
 *   "no_token"        — vessel explicitly wants no Authorization header,
 *                        even if `auth_scheme` would normally attach one.
 *                        Distinct from `auth_scheme: "none"` which says
 *                        "I don't care about auth"; this says "I care, and
 *                        I want it omitted." Edge case for proxy/preflight
 *                        scenarios. Optional in v1; spec it for completeness.
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
| `"service_identity"` | identical to `"caller_identity"` in v1                                                                    | identical                |
| `"user_identity"`    | `runtimeContext.userJwt` → `process.env.METABOB_USER_JWT` (last-resort, REPL `/auth user-jwt …` writes it) | **fail fast** per §4.4   |
| `"no_token"`         | always returns undefined (never attaches header)                                                          | n/a                      |

Notes:

- The `"caller_identity"` chain is exactly the chain `buildAuthHeader`
  uses today. No regression.
- `"user_identity"` does not fall back to caller_identity. Sending the
  service key when a user key was asked for is wrong (wrong `$auth`,
  wrong scoping); the vessel asked for one thing, we silently sent
  another. Fail fast, surface the policy gap.
- `runtimeContext.userJwt` is a new field on the runtime context (see §5).

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

This matches `auth_scheme: "none"`'s current semantics (it really does
mean "do not send credentials") and gives `"no_token"` a distinct
escape-hatch role.

### 4.4 Dispatch policy on missing token

When the requested `auth_token_source` resolves to `undefined` in the
caller's runtime context:

| Source                | Policy                  | Rationale                                                                                                              |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `caller_identity`     | warn, send anonymous    | Current behavior; preserves backward compat. Vessel will reject with 401 if it cares; caller learns from the failure. |
| `service_identity`    | warn, send anonymous    | Same as `caller_identity` in v1.                                                                                       |
| `user_identity`       | **fail fast**           | Sending service identity when user identity was requested is a silent scoping bug. Throw before the network call.      |
| `no_token`            | n/a (always undefined)  | Field's whole purpose.                                                                                                 |

The fail-fast error for `user_identity`:

```
VesselAuthError: vessel <id> requested auth_token_source=user_identity but
no user JWT is present in the runtime context. Either pass a user JWT via
RuntimeContext.userJwt or do not invoke this vessel from this code path.
```

This surfaces the wiring gap exactly where it matters (the vessel that
needs user identity is unreachable from a code path that doesn't have
one), instead of letting the call hit the network with the wrong credential
and getting a confusing 403.

---

## 5. Implementation outline

### 5.1 `@metabob/vessel-discovery-client` (shared package)

`packages/vessel-discovery-client/src/types.ts`:

- Add the `AuthTokenSource` type and `DEFAULT_AUTH_TOKEN_SOURCE` const
  next to `ResolveAuthScheme` and its default (currently around line 176).
- Add the optional `auth_token_source?: AuthTokenSource` field to:
  - `DiscoveryConfig` (line 18) — so vessels using the client to register
    can pass it.
  - `VesselRegistration` (line 103) — so the registration record carries it.
  - `VesselCapability` (line 188) — so discovery results expose it to
    callers.
- Update the JSDoc on `VesselCapability` (line 184) to mention the new
  field as part of the resolve contract.

`packages/vessel-discovery-client/src/registration.ts`: pass through the
field on register/heartbeat. No behavior change.

This package change is purely additive types; no existing consumer breaks.

### 5.2 `repos/discovery-vessel`

`repos/discovery-vessel/src/types.ts`:

- Add `AuthTokenSource` type and `DEFAULT_AUTH_TOKEN_SOURCE` const
  alongside `ResolveAuthScheme` (line 26).
- Add `auth_token_source?: AuthTokenSource` to `VesselRegistration` (line
  88), `RegisterRequest` (line 316), and `VesselCapability` (line 221).

`repos/discovery-vessel/src/registry.ts`: store the field on register;
return it on resolve. Default at write time when absent
(`auth_token_source ?? DEFAULT_AUTH_TOKEN_SOURCE`), so older clients
querying the registry get a value back even if the registering vessel
didn't pass one.

`repos/discovery-vessel/src/resolvers.ts`: include the field in the
`VesselCapability` payload returned for `vesselCapability` and
`vesselRegistry` queries.

No new endpoints. No schema migration (registry is in-memory).

### 5.3 `repos/minibob`

`repos/minibob/src/resolvers/vessel-resolve-call.ts`:

- Extend `buildAuthHeader` (line 84) to take an additional `tokenSource:
  AuthTokenSource = "caller_identity"` parameter (with default to
  preserve callers that don't pass it). Inside, dispatch on
  `tokenSource` to select the credential lookup chain per §4.2; format
  per `scheme` as today.
- Extend `VesselResolveCallOptions` (line 52) with an optional
  `userJwt?: string` field, populated by `buildResolveRequest`'s caller
  from the runtime context.
- Update `buildResolveRequest` (line 152) to read `auth_token_source`
  from `vessel`, default to `"caller_identity"`, and pass it plus the
  `userJwt` option to `buildAuthHeader`.
- Add the precedence rules from §4.3 inside `buildAuthHeader` (early
  returns for `scheme === "none"` and `tokenSource === "no_token"`).
- Throw `VesselAuthError` (new error class) for the
  `user_identity` + missing-jwt case per §4.4.

`repos/minibob/src/types.ts` (or wherever `RuntimeContext` /
`ExecutorConfig` lives — investigate before implementing): add an
optional `userJwt?: string` field. Plumb through the activity executor
so a caller of minibob's HTTP API or REPL can set it once per session.

`repos/minibob/src/repl.ts` (REPL command surface): add `/auth user-jwt
<token>` and `/auth clear-user-jwt` commands so REPL users can attach a
user JWT for vessels that need it. Document in the REPL `/help`.

`repos/minibob/index.ts` (HTTP server entry): accept `X-User-JWT` header
on incoming goal requests and propagate to `RuntimeContext.userJwt`. This
is the path by which the user's token reaches user-identity-needing
vessels when minibob is invoked as a service rather than from a REPL.

`repos/minibob/src/resolvers/vessel-resolve-call.test.ts`: extend with
the cases in §6.

### 5.4 `repos/concept-db`

`repos/concept-db/src/services/discovery-client.ts`:

- Extend the local `VesselRegistration` interface (line 20) with
  `auth_token_source?: string`.
- In the registration object (line 92), add `auth_token_source:
  'caller_identity'`. Concept-db trusts the caller's identity for
  tenant scoping; this is a no-op declarative annotation that makes
  the contract explicit.
- Add a code comment explaining: concept-db's PERMISSIONS clauses
  filter on `$auth.org_id` from the caller's token, so any caller's
  service identity is correct as long as it's tenant-scoped.

### 5.5 `repos/metabob-activity-api`

`repos/metabob-activity-api/src/services/discovery-client.ts`:

- Extend `VesselRegistration` interface (line 12) with
  `auth_token_source?: string`.
- In the registration object (line 106), add `auth_token_source:
  'caller_identity'`. Same rationale as concept-db.

### 5.6 Other vessels (forward-looking, not in v1)

- **identity-vessel**: when it advertises a resolve contract,
  `auth_token_source: "caller_identity"` — service-to-service calls
  authenticate as the caller, identity-vessel mints/validates user
  tokens internally.
- **react-renderer** (if/when it advertises): `auth_token_source:
  "user_identity"` — UI state is per-user.
- **discovery-vessel** itself does not have a resolve auth_scheme today
  (`auth_scheme: "none"` for `/resolve` is current default). When/if it
  gains one, `"caller_identity"` is correct.

### 5.7 Per-vessel summary

| Vessel                     | `auth_scheme` (today) | `auth_token_source` (this spec) | Notes                                      |
| -------------------------- | --------------------- | ------------------------------- | ------------------------------------------ |
| concept-db                 | `ApiKey`              | `caller_identity`               | Tenant scoping via caller's `$auth.org_id` |
| metabob-activity-api       | `ApiKey`              | `caller_identity`               | Same as concept-db                         |
| discovery-vessel           | `none`                | (n/a; absent → default)         | No auth on resolve today                   |
| identity-vessel (future)   | `ApiKey` (likely)     | `caller_identity`               | Service-to-service                         |
| react-renderer (future)    | `Bearer`              | `user_identity`                 | User-scoped UI state                       |
| audit-vessel (hypothetical)| `Bearer`              | `user_identity` or new value    | Open question                              |

---

## 6. Test plan

### 6.1 Unit: `buildAuthHeader` per token-source

Extend `repos/minibob/src/resolvers/vessel-resolve-call.test.ts` (existing
tests at lines 173–202) with one case per cell of the table in §4.3 plus
the dispatch-policy cases in §4.4:

- `(scheme=ApiKey, source=caller_identity, env present)` → `"ApiKey <env>"`
  *(already covered at line 107, retain)*
- `(scheme=ApiKey, source=caller_identity, vesselConfig present)` →
  `"ApiKey <vesselConfig>"` *(already at line 132, retain)*
- `(scheme=ApiKey, source=caller_identity, nothing available)` → undefined
  + warn *(already at line 195, retain)*
- `(scheme=ApiKey, source=service_identity, env present)` → `"ApiKey <env>"`
  *(new — covers alias)*
- `(scheme=Bearer, source=user_identity, runtimeContext.userJwt present)` →
  `"Bearer <userJwt>"` *(new)*
- `(scheme=Bearer, source=user_identity, no userJwt)` → throws
  `VesselAuthError` *(new — fail-fast)*
- `(scheme=ApiKey, source=user_identity, userJwt present)` →
  `"ApiKey <userJwt>"` *(new — unusual but allowed; documents behavior)*
- `(scheme=ApiKey, source=no_token)` → undefined *(new — escape hatch)*
- `(scheme=Bearer, source=no_token)` → undefined *(new — escape hatch)*
- `(scheme=none, source=user_identity)` → undefined, no throw *(new —
  scheme=none short-circuits before token resolution)*
- `(scheme=ApiKey, source=undefined / absent)` → behaves as
  `caller_identity` *(new — backward-compat default)*

### 6.2 Unit: `buildResolveRequest` reads the field

Extend §3.5 of the existing tests (`buildResolveRequest` block, line 37):

- Vessel advertises `auth_token_source: "user_identity"`, runtime context
  has `userJwt`, expect `Authorization: Bearer <userJwt>`.
- Vessel advertises `auth_token_source: "no_token"`, expect no
  `Authorization` header even with env keys present.
- Vessel does not advertise `auth_token_source`, expect current
  behavior (caller_identity from env).

### 6.3 Integration: discovery roundtrip

A test (or extension of `repos/discovery-vessel/test/...`) that:

1. Registers a mock vessel with each `auth_token_source` value.
2. Resolves `vesselCapability` for that vessel's shape.
3. Asserts the field round-trips intact — written value equals read
   value.
4. Registers a vessel without the field, asserts the resolved
   `VesselCapability` has `auth_token_source: "caller_identity"` (default
   applied at write time).

### 6.4 Integration: end-to-end against a fake vessel

A higher-level test in minibob that runs `callVesselResolve` against an
in-process fake HTTP server:

- Fake vessel asserts incoming `Authorization` header matches the
  expected token per its advertised `auth_token_source`.
- One test per (caller_identity, user_identity, no_token).

### 6.5 Regression: existing call paths

The existing `vessel-resolve-call.test.ts` tests (all 13 cases at lines
55–155) must pass unchanged after the `auth_token_source` extension. The
default `caller_identity` behavior is the spine of backward
compatibility — if any existing test fails, the migration is wrong.

---

## 7. Backward compatibility

- **No vessel advertises `auth_token_source` today.** Every advertised
  registration in concept-db (line 111) and activity-api (line 116) lacks
  the field.
- **Default on read = `"caller_identity"`.** Discovery-vessel applies the
  default at write time; minibob's `buildAuthHeader` defaults the
  parameter; either way, callers behave as today.
- **Caller without the user-JWT plumbing.** A minibob build that hasn't
  picked up the §5.3 changes simply ignores the field and runs the
  existing chain — every vessel today wants `caller_identity`, which is
  what that build produces. New vessels needing `user_identity` will
  fail to authenticate against old minibobs, which is the right
  failure mode (the new vessel is not yet supported by that caller).

---

## 8. Open questions

### 8.1 Delegation: forwarding vs minting

If vessel A calls vessel B while *itself* serving a user request, A is
the caller, but the user's identity is the load-bearing one. Two policies:

- **Forward**: A passes through the user JWT it received. Simple, but
  the JWT may not be valid for B's audience (audience claim mismatch),
  and A becomes a confused deputy.
- **Mint**: A asks identity-vessel for a delegated token scoped to B's
  audience and the original user. Correct, but introduces a new hop and
  identity-vessel coupling.

**v1 decision**: out of scope. v1 supports `caller_identity` (today's
behavior) and `user_identity` (token already in caller's runtime
context). Cross-vessel delegation chains are deferred to a future spec.
If a vessel chain needs delegation, the intermediate vessel should
explicitly call identity-vessel and place the resulting token into its
outbound runtime context — same mechanism, just the wiring is per-call.

Document the gap in this spec; revisit when a real delegation case
arises.

### 8.2 Caller without a user JWT, but `user_identity` requested

§4.4 says fail-fast. Alternative policies considered:

- Anonymous (send no token) — silently strips auth, vessel returns 401,
  user sees confusing error.
- Fall back to caller_identity — silently sends wrong identity, vessel
  may accept it and return wrong-tenant data.

Both alternatives are silent bugs. Fail-fast is correct. But it does
make `user_identity` vessels unreachable from idle/boredom code paths
(no user in context) until the boredom system is taught to either skip
those vessels or set up a service-account fallback. Deferred.

### 8.3 Token freshness

A user JWT in `runtimeContext.userJwt` may expire mid-execution. v1
treats the token as opaque; the vessel will return 401 if it's stale,
and the caller surfaces the failure. A future spec may add token-refresh
hooks, but not in v1.

### 8.4 Multiple service identities

`"service_identity"` is reserved as an alias for `"caller_identity"` in
v1, anticipating a future where minibob carries multiple service tokens
(per-vessel keys, per-environment keys). When that materializes, the
contract grows: either `service_identity` becomes parameterized
(`"service_identity:concept-db"`) or we add a sibling field
(`auth_token_audience`). Not v1.

### 8.5 Naming: `auth_token_source` vs `auth_principal` vs `auth_subject`

`auth_token_source` describes where the token comes from; `auth_principal`
or `auth_subject` describes whose identity it represents. The latter is
arguably cleaner ontology — the contract says "I want a token whose
subject is the user," not "I want a token sourced from this place."
v1 keeps `auth_token_source` because it composes with
`auth_scheme`/`auth_token_source` symmetrically (both are about the
token, one says how it's framed, one says where it's drawn from). If
during implementation review the naming feels wrong, `auth_principal` is
a fine alternative — pick one before merging the type into the shared
package.
