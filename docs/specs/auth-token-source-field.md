# `auth_token_source` Contract Field

Scope: a fifth field on the vessel resolve contract — alongside the four
existing resolve fields (`resolve_endpoint`, `resolve_request_format`,
`auth_scheme`, `resolve_timeout_ms`) — that lets a vessel declare *which
credential* the caller should attach, not just *which scheme*. Vessels say
"I need Bearer auth"; this field says where that token comes from.

What the fleet does:

- `auth_token_source` and `auth_delegation_mode` are part of the registration
  contract, declared in both `packages/vessel-discovery-client/src/types.ts` and
  `repos/discovery-vessel/src/types.ts`, and discovery applies their defaults.
- activity-api and concept-db declare `auth_token_source: 'caller_identity'` on
  registration (each in `src/services/discovery-client.ts`).
- Callers attach credentials with their own helpers and read neither field.
  The caller-side lookup, the missing-token policy and cross-vessel
  delegation (calling a vessel "as the user") are a proposed change:
  the [delegation proposal](../../openspec/changes/auth-token-delegation/proposal.md).
  Section numbers are shared between the two documents: §4.2, §4.4 and §5–§7
  are in the proposal.

---

## 1. Problem

The resolve contract on `VesselCapability` has `auth_scheme:
"none" | "ApiKey" | "Bearer"` (see `ResolveAuthScheme` in
`packages/vessel-discovery-client/src/types.ts` and
`repos/discovery-vessel/src/types.ts`). A caller that sees
`auth_scheme: "ApiKey"` has exactly one credential to reach for: its own
service key. The fleet's only such builder, `buildAuthHeaders` in
`repos/development-vessel/src/resolvers/concept.ts`, formats
`ApiKey $METABOB_API_KEY` unconditionally. That resolves to one identity:
**the caller's service key**. concept-db and activity-api both want exactly
this — they trust the caller's identity for tenant scoping.

The gap appears as soon as a vessel needs a *different* credential:

- **A user-scoped UI vessel** renders user-scoped UI state and
  needs the user's JWT so `$auth.user_id` in SurrealDB resolves to the
  end user, not goal-host-vessel.
- **identity-vessel**, when called from a vessel acting on behalf of a
  user, may need the user JWT to mint a delegated token.
- A future audit/billing vessel may want the original-user token,
  distinct from any intermediate service identity.

There is no way for these vessels to say "give me the user's token, not
yours." Callers resolve credentials by out-of-band convention, and that
convention says one thing only: service identity from env. Vessels
declare "I need Bearer auth" but callers must resolve the credential
out of band, which blocks fully automated discovery-driven invocation.

This spec defines the missing field. Making it safe to use end to end
(caller-side lookup and delegation) is the proposal's scope.

---

## 2. Constraints

**Foundation alignment.** Vessels declare what they need; callers honor
the declaration. Same shape as the four existing resolve contract fields. The
field is descriptive metadata on the registration record, not behavior.

**Backward compatibility.** Every call path uses service identity, and no
vessel advertises anything other than `caller_identity`. The
default-when-absent must reproduce that behavior bit-for-bit.

**No new vessels become reachable as a side effect.** Adding the field
must not change which vessels the caller can talk to. If a vessel asks for a
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
alternatives are in the [delegation proposal](../../openspec/changes/auth-token-delegation/proposal.md).

### 3.1 Symbolic strings (recommended)

```typescript
auth_token_source?:
  | "caller_identity"   // caller's own service token (the default behavior)
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
goal-host-vessel's specific configuration.

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
identity-vessel; not-found is a clean policy decision per the caller policy in the [delegation proposal](../../openspec/changes/auth-token-delegation/proposal.md).

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
 *   "caller_identity"  — caller's own service token (e.g., goal-host-vessel's
 *                        METABOB_API_KEY). Used by vessels that trust the
 *                        caller's federated identity for tenant scoping.
 *
 *   "user_identity"    — a user JWT the caller is acting on behalf of.
 *                        Used by vessels that need user-scoped state (UI
 *                        vessels, per-user audit). Caller must have a user
 *                        token in runtime context; if absent, dispatch
 *                        fails per the caller policy in the [delegation proposal](../../openspec/changes/auth-token-delegation/proposal.md).
 *
 *   "service_identity" — explicit alias for "caller_identity" reserved for
 *                        future when callers may have multiple service
 *                        tokens (per-vessel keys, per-environment keys).
 *                        Treated identically to "caller_identity".
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

## 8. Backward compatibility

- **No vessel advertises `user_identity`.** concept-db and activity-api
  both register `auth_token_source: 'caller_identity'`, and neither sets
  `auth_delegation_mode`, so no call path changes credential.
- **Default on read.** Discovery-vessel applies defaults
  (`caller_identity`, `forward`) at write time; the caller's header
  builder defaults its parameters; either way, callers keep their
  service-identity behavior.
- **Caller without the user-JWT plumbing.** A caller build that hasn't
  picked up the caller changes in the [delegation proposal](../../openspec/changes/auth-token-delegation/proposal.md) simply ignores both fields and runs the
  existing chain — every vessel wants `caller_identity`, which is
  what that build produces. New vessels needing `user_identity` will
  fail to authenticate against callers that do not send it, which is the right failure
  mode (the new vessel is not yet supported by that caller).
- **Receivers without delegation-chain awareness.** A vessel that
  doesn't yet read the delegation headers simply ignores them.
  Forwarding still works; the audit trail is incomplete until the
  receiver picks up the change. This is acceptable — the chain is
  advisory in forward mode.

---
