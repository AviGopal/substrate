# Proposal: Substrate Identity Resolution

## Why

The substrate handles configuration and credentials outside its own
primitives. Endpoints live as env-var defaults baked into source;
substrate identity (JWT issuer, org name, signing key fingerprint)
lives as string literals; credential rotation is an operational
process, not a substrate activity. The four-primitive model has a
blind spot exactly where the substrate's own identity should live.

The deployment-agnosticism audit (user conversation 2026-05-23)
identified five concrete leak points where vessel source defaults to
the (now-suspended) Metabob canary deployment:

| File | Hardcoded default |
|---|---|
| `identity-vessel/src/services/trace.ts:6` | `http://metabob-activity-api.activity-system.svc.cluster.local:8080` |
| `identity-vessel/src/services/jwt.ts:15` | `https://identity.metabob.com` |
| `identity-vessel/src/services/keyGeneration.ts:35` | `https://identity.metabob.com` |
| `discovery-vessel/src/middleware/auth.ts:63` | `https://identity.metabob.com` |
| `identity-vessel/src/services/discovery-client.ts:58` | K8s-DNS URL builder |

A fresh checkout assumes a substrate that is no longer the
operational target (per 2026-05-23 memory: kubectl/Helm suspended,
all dev runs against the local single-container substrate). The
single-container substrate boots only because operator-supplied env
vars override every default. The system's "agnostic by design" claim
is held closed by env-var discipline, not by spec.

This change replaces hardcoded defaults with **substrate identity
resolution**: a minimum-bootstrap-credential pattern in which every
vessel receives exactly two pieces of env-supplied material at boot
(`SUBSTRATE_IDENTITY_URL`, `VESSEL_BOOTSTRAP_KEY`) and resolves
everything else — substrate name, JWT issuer, peer endpoints, its
own real credentials — through the impulse-activity model. If
resolution fails, the vessel fails loudly with a known
`failure_mode.type`; no silent fall-through to a defunct
deployment.

## Self-application

This change is itself subject to the disciplines it enforces:

- **Foundation alignment.** `substrateIdentity` and
  `vesselCredentials` are new shapes resolved through existing
  primitives. No new mechanism is introduced — the substrate's
  identity becomes a normal impulse.
- **Closure.** After this change ships, `closure-audit
  --without=operator-shell` MUST verify that a fresh substrate boots
  with only `SUBSTRATE_IDENTITY_URL` + `VESSEL_BOOTSTRAP_KEY` in the
  environment and resolves everything else via the substrate itself.
- **Confidence weighting.** Substrate identity is the highest-trust
  data the substrate carries; impulses resolved against it inherit
  `signal_confidence_weight = 1.0` (in-substrate-authoritative,
  distinct from the external-source ceiling of 0.7). This is the
  natural top of the trust hierarchy already articulated in
  `2026-05-23-signal-confidence-weighting`.
- **Horizon framing.** All traces produced by this change carry
  `intent:substrate_maintenance` plus the sub-intent
  `intent:substrate_identity_resolution`. The ribosome at the
  substrate-maintenance horizon can extract patterns across
  identity-resolution traces alongside the sibling pipelines
  (external-resolver-vesselization, substrate-self-replacement).

## What changes

### Three new shapes

1. **`substrateIdentity`** — body:
   ```typescript
   {
     substrate_id: string;          // stable identifier
     name: string;                  // operator-chosen display name
     domain: string;                // e.g. "localhost", "example.com"
     jwt_issuer: string;            // full URL used as JWT iss claim
     signing_key_fingerprint: string;
     federation_membership: string[];   // federation ids, or [] if standalone
     established_at: string;        // ISO 8601, set at mint
   }
   ```
2. **`vesselCredentials`** — body:
   ```typescript
   {
     vessel_id: string;
     api_key: string;               // scoped to substrate_id
     api_key_expires_at: string | null;  // null = no expiry
     scopes: string[];              // e.g. ["read", "write", "admin"]
     issued_at: string;
     issued_by: string;             // identity-vessel id
   }
   ```
3. **`bootstrapAttestation`** — body:
   ```typescript
   {
     vessel_id: string;
     bootstrap_key_fingerprint: string;
     substrate_id: string;
     issued_at: string;
     attestation_token: string;     // signed claim that bootstrap succeeded
   }
   ```

### Three new activities

1. **`mint-substrate-identity`** — bootstrap activity, runs once per
   substrate at first boot. Generates the substrate's signing
   key, names the substrate, writes the canonical
   `substrateIdentity` record to identity-vessel's backing store.
   Replaces `scripts/substrate/seed-identity.ts` as the
   substrate-resident equivalent.
2. **`issue-vessel-credentials`** — identity-vessel-resident.
   Accepts a `bootstrapAttestation` impulse plus a vessel
   registration request; issues full-scope `vesselCredentials`
   bound to the substrate identity. The vessel's bootstrap key is
   marked consumed after first use.
3. **`resolve-substrate-context`** — the call every vessel makes at
   boot. Given `SUBSTRATE_IDENTITY_URL` + `VESSEL_BOOTSTRAP_KEY`,
   returns a tuple of `(substrateIdentity, vesselCredentials)`.
   On any failure (network, signature, expired key), the vessel
   refuses to start and emits a `failure_mode.type` trace.

### Source-level changes

- Delete the five hardcoded defaults listed in §Why.
- Replace with required-from-env-or-fail at boot in each vessel:
  - `SUBSTRATE_IDENTITY_URL` (required)
  - `VESSEL_BOOTSTRAP_KEY` (required for vessels that need
    credentials)
  - `DISCOVERY_VESSEL_URL` (required; falls through to identity
    resolution if absent)
- The `detectEnvironment()` functions in six vessels
  (identity-vessel, concept-db, activity-api, analysis-api,
  minibob, discovery-client) move to a single
  `packages/substrate-bootstrap/` library, OR are deleted in
  favour of explicit env-var configuration. Decision deferred to
  design §C.

### Identity-vessel role expansion

Identity-vessel is already the substrate's auth source of truth
(CLAUDE.md "Authentication" §). This change formalises its
expanded role:

- Owner of `substrateIdentity` shape (one record per substrate).
- Issuer of `vesselCredentials` (already; surfaces via shape now).
- Validator of `bootstrapAttestation` for vessel boot.
- Source of the JWT issuer URL, signing key, and substrate
  metadata — replacing any literal `metabob.com` references.

No new vessel is introduced. Identity-vessel grows into a role it
was implicitly already playing.

## Success criteria

1. **No hardcoded deployment defaults**: every literal
   `metabob.com`, `.svc.cluster.local`, `activity-system`
   namespace reference is removed from the five identified files
   plus any others found during DEV. Grep returns zero matches.
2. **Boot fails loudly on missing env**: a vessel started without
   `SUBSTRATE_IDENTITY_URL` exits within 5 seconds with a clear
   error message naming the missing variable.
3. **Boot succeeds on the local substrate** with only
   `SUBSTRATE_IDENTITY_URL`, `VESSEL_BOOTSTRAP_KEY`,
   `DISCOVERY_VESSEL_URL` set; all other endpoints/identifiers are
   resolved via `resolve-substrate-context`.
4. **`mint-substrate-identity` activity replaces `seed-identity.ts`
   as the bootstrap path**: the activity runs in the substrate's
   own systemd/equivalent unit; the bash script is archived.
5. **Closure-audit passes**: `closure-audit --without=operator-shell`
   on a fresh substrate launch succeeds without operator
   intervention beyond providing the two bootstrap env vars.
6. **Identity-vessel self-audit**: `audit-vessel-purity` (from
   `substrate-self-replacement-pipeline`, when shipped) against
   identity-vessel reports no `domain-local shapes` violation —
   identity-vessel now legitimately owns `substrateIdentity`.

## Capabilities

### New Capabilities

- `substrate-identity-resolution` — the three new shapes, three new
  activities, and the boot-time resolution contract. Spec:
  `specs/substrate-identity-resolution/spec.md`.

### Modified Capabilities

- `identity-vessel` gains the `substrateIdentity` shape, the
  `issue-vessel-credentials` activity (as a formal resolvable
  surface, not just an internal function), and validation of
  `bootstrapAttestation`.
- Every vessel that currently has hardcoded defaults loses them;
  the boot path becomes "resolve substrate context or die."
- `signal-confidence-weighting` gains an explicit
  `substrate-authoritative` tier at weight 1.0, distinct from the
  external-source ceiling of 0.7. Impulses resolved against
  `substrateIdentity` carry the authoritative weight.

## Dependencies

- `2026-05-23-signal-confidence-weighting` (committed) — provides
  the trust hierarchy this change writes into.
- `identity-vessel` is already in use as the auth source of truth
  per CLAUDE.md "Authentication". No new vessel needed.
- `discovery-vessel` registration accepts the existing field set;
  this change does not modify discovery's registration schema.

## Out of scope

- **Provider-credential handling** (Anthropic, OpenAI keys). The
  sibling change `provider-credentials-as-impulse` covers that;
  this spec ships only substrate-internal identity and vessel
  credentials.
- **Credential rotation activities**. Rotation is conceptually
  important but operationally deferred to the
  `provider-credentials-as-impulse` change.
- **Federation handshake**. Cross-substrate identity exchange is
  governed by `2026-05-23-vessel-federation`. This change supports
  it (the `federation_membership` field exists) but does not
  implement the handshake protocol.
- **Substrate-identity rotation**. Changing the substrate's name,
  signing key, or domain after mint is intentionally not in
  scope. If needed, mint a new substrate identity and migrate
  vessels — same primitive, just operator-initiated.
- **Multi-tenant vessels** (one vessel serving multiple
  substrates). The `substrateIdentity` shape is single-valued per
  vessel boot; multi-tenancy via per-call substrate context is a
  follow-on.
- **Migrating existing vessels' issued credentials**. New vessels
  minted after this change use the new flow; existing vessels
  with already-issued credentials keep working until they next
  re-bootstrap.

## IAL integration

This change is the **identity-resolution** member of the
post-lift-acceleration cluster:

- `forge-vessel` (Phase 22) mints vessels.
- `signal-confidence-weighting` weights their outputs.
- `external-resolver-vesselization` absorbs external resolvers as
  vessels.
- `substrate-self-replacement-pipeline` retires and replaces
  internal vessels.
- **this change** gives the substrate a self-resolved identity that
  none of the above can be honest about until it lands.

Without identity resolution, every other change in the cluster
inherits a configuration story that depends on operator-set env
vars and source-baked defaults. With it, the substrate's
self-reference is closed: it knows who it is, it can tell its
vessels who they are, and it does so via the same primitives it
uses for everything else.
