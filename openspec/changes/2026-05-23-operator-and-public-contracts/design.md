# Design — Operator-as-Vessel and Substrate-Public Contracts

> All references to the foundation are to
> `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`. The H2 vessel-id
> construction is defined in
> `openspec/changes/2026-04-26-security-hardening-findings/design.md`
> §H2 and applied by `openspec/changes/2026-05-23-vessel-federation/`
> §A. The `signal_confidence_weight` field is defined in
> `openspec/changes/2026-05-23-signal-confidence-weighting/`. The
> intervention-tracking emission paths are defined in
> `openspec/changes/2026-05-23-intervention-tracking/`. The external-
> resolver-vesselization pattern is defined in
> `openspec/changes/2026-05-23-external-resolver-vesselization/`.

This change is two coordinated additions in one bundled spec. §A–§B
specify Addition 1 (operator-as-vessel). §C–§E specify Addition 2
(substrate-public-contracts). §F–§H specify the cross-cuts
(intervention-tracking integration, relationship to existing patterns,
resolved questions).

---

## §A — Operator-as-vessel registration

### Problem

`2026-05-23-intervention-tracking` observes operator action against
substrate state through detection hooks (`fs-watcher`,
`orchestration-log`, `api-origin`, `db-audit`, `spec-attribution`).
The observed actor is referenced as "the operator" but is not a
registered vessel with a `vessel_id`, advertised shapes, or a
reputation surface the substrate can tune. Post-lift, the substrate
needs to extend the same vessel framework to all external systems
(LLM providers, GitHub, CI, peer substrates) — without the operator-
vessel as the foundational instance, the substrate would have to
invent the categorical framing before applying it.

### Construction

A new discovery-vessel record kind: `operator`.

```typescript
interface OperatorVesselRegistration {
  // Same construction as every other vessel
  vessel_id: string
  kind: "operator"               // new value; previous: executor | resolver | lifecycle-subscriber

  // Identity binding
  identity_binding_method:
    | "session_pubkey_tofu"      // pre-H2 default; identity-vessel session pubkey, accept on first contact
    | "h2_multihash"             // post-H2; vessel_id = base32(multihash(SHA-256, pubkey))
  pubkey: string                 // PEM-encoded Ed25519 (or session-key family identity-vessel issues)
  identity_vessel_session_id?: string  // back-reference for audit; pre-H2 only

  // Advertised shapes (operator emits)
  emit_shapes: OperatorEmitShape[]

  // Advertised consumed shapes (substrate-public surface operator reads)
  consume_shapes: string[]       // shape names from substrate-public-contracts enumeration (§C)

  // Reputation surface
  reputation: {
    initialized_at: string       // ISO-8601
    impulse_count_by_category: Record<string, number>
    refused_count_by_category: Record<string, number>
    // Thompson posteriors are kept by activity-api per
    // (impulse_category, operator_vessel_id); not duplicated here
  }
}
```

### `vessel_id` derivation pre-H2

The operator's identity-vessel session JWT carries an ephemeral
keypair the session was issued against (per identity-vessel's existing
session model). The operator-vessel's `vessel_id` pre-H2 is:

```
vessel_id = "operator:" + base32(sha256(identity_vessel_session_pubkey))
```

This is a "best-effort" construction:

- The `"operator:"` prefix marks the kind for human readability in
  logs (the registry record's `kind` field is the authoritative
  source).
- The SHA-256 hash is structurally equivalent to H2's multihash for
  identity stability, but without the multihash self-description
  envelope. When H2 lands, the operator-vessel is re-registered with
  `identity_binding_method: "h2_multihash"` and the new `vessel_id`
  is recorded in the operator-vessel record's
  `previous_vessel_ids[]`. Reputation history migrates along the
  recorded chain.
- The acceptance is TOFU: the substrate accepts the pubkey on first
  registration. Subsequent registrations from the same session
  require pubkey match. Pubkey mismatch on re-registration fails
  closed (the substrate refuses and emits an `interventionRefused`
  with `refusal_code: "operator_pubkey_mismatch"`).

Multi-operator deployments: each operator's identity-vessel session
generates a distinct pubkey → a distinct operator-vessel-id. The
substrate maintains separate reputation per operator-vessel-id.

### Advertised emit shapes

The operator-vessel advertises these as the shapes it produces:

| Shape | Body sketch | Reference |
|---|---|---|
| `operatorGoal` | `{ id, authored_at, text, target_substrate, scope_dimensions }` | new (this spec) |
| `operatorIntervention` | per `2026-05-23-intervention-tracking` R1 (body amended additively for `actor.operator_vessel_id`) | intervention-tracking |
| `interventionAuditVerdict` | per intervention-tracking R3 | intervention-tracking |
| `heldOutEvalSetCuration` | `{ id, version, authored_at, contents_hash, supersedes_version }` | new (this spec) |
| `adversarialProbeSetCuration` | `{ id, version, authored_at, probes_hash, supersedes_version }` | new (this spec) |
| `foundationComplianceUpdate` | `{ id, authored_at, updated_check_list_hash, supersedes_hash }` | new (this spec) |
| `h5BaselinePromotion` | `{ id, authored_at, baseline_signature, authority_endorsements[] }` | new (this spec) |
| `federationPeeringAuthorization` | `{ id, peer_vessel_id, authority_endorsements[], expires_at }` | new (this spec) |
| `liftStatusConfirmation` | `{ id, authored_at, status: "confirmed" \| "reverted", substrate_id, rationale }` | new (this spec) |
| `directionGoal` | `{ id, authored_at, text, target_lift_arc, scope_dimensions }` | new (this spec) |

New shapes ship as additive declarations in development-vessel's
discovery config; existing shapes (`operatorIntervention`,
`interventionAuditVerdict`) gain optional `actor.operator_vessel_id`
fields per §F.

### Advertised consume shapes

The operator-vessel declares which substrate-public shapes it reads
(mirror of §C's enumeration). The declaration is informational —
discovery-vessel does not gate reads on declared consumption, but
the field documents the operator's expected interest set and lets
the substrate-public-feed (§E) pre-filter by audience.

### Reputation surface

Per-category reputation is maintained as Thompson posteriors keyed
by `(impulse_category, operator_vessel_id)` in activity-api's
`variant_performance_metrics` table (reusing the existing surface;
no new table). The posterior is updated by:

- **α increments** when an operator-emitted impulse is downstream-
  validated (e.g., `heldOutEvalReport` runs against a curated set
  and the set produces well-formed verdicts; `interventionAuditVerdict`
  is accepted by the audit workflow without later dispute).
- **β increments** when an operator-emitted impulse is downstream-
  refuted (e.g., a `directionGoal` violates foundation invariants
  and is refused by the substrate; an `operatorGoal` is classified
  as `intervention.kind = "redundant"` by intervention-tracking
  meaning the substrate would have produced the same outcome
  unbidden).

The reputation surface is informational pre-tuning. Operator-vessel-
trust-tuning (Thompson sampling on operator-impulse-category
selection) is a sibling spec.

---

## §B — Confidence-weight defaults per operator-impulse category

Per `2026-05-23-signal-confidence-weighting`, every operator-emitted
impulse carries an explicit `signal_confidence_weight`. Defaults:

| Category | Default weight | Rationale |
|---|---|---|
| `heldOutEvalSetCuration`, `adversarialProbeSetCuration` | 1.0 | Operator IS the authority for external anchors per `lift-criterion-hardening`. |
| `interventionAuditVerdict` | 0.95 | Load-bearing for §27.S.6 soundness audit. Slightly below 1.0 so future evidence of audit drift can be incorporated. |
| `federationPeeringAuthorization` | 1.0 | H4 authority machinery treats this as authoritative. |
| `h5BaselinePromotion` | 1.0 | H5 baseline promotion is operator-authoritative. |
| `liftStatusConfirmation` | 1.0 | Per IAL §27.2.1, lift status is operator-authoritative. |
| `foundationComplianceUpdate` | 0.9 | Operator-authored but substrate-checkable against the foundation doc. |
| `operatorGoal` | 0.9 | High but not absolute — operators make mistakes. |
| `operatorIntervention` | per `2026-05-23-intervention-tracking` R7.4 (= 1.0) | "did this operator action happen" IS observed truth. |
| `directionGoal` | 0.8 | Strategic but easily superseded by substrate-learned priorities. |

Operator-emitted impulses MUST populate `signal_confidence_weight`
on the trace write per `2026-05-23-signal-confidence-weighting`'s
update path. Omission of the field falls back to 1.0 (the
signal-confidence-weighting default) — operators emitting via legacy
paths are not penalized, but new emissions SHOULD declare per the
table.

The defaults are operator-tunable per substrate via
`validation/state/operator-vessel-config.json`. Substrate-authored
tuning is deferred to the operator-vessel-trust-tuning sibling.

---

## §C — Substrate-public-contracts enumeration

### Problem

The substrate emits many shapes that external consumers (operator,
peer-substrates, auditors) rely on, but no formal contract declares
which shapes are public, what guarantees apply, or who may consume
them. External consumers scrape individual shape emissions without
knowing which are stable, which are deprecated, or which carry
authenticity guarantees.

### The principle

**A shape is substrate-public iff** it appears in the static
`substrate_public_shapes` table in activity-api's discovery config,
with per-shape contract metadata declared. Public shapes carry
stability / freshness / authenticity guarantees the substrate
maintains. Shapes NOT in the table are substrate-internal — the
operator MAY query them with admin scope through the standard
activity-api routes, but they are NOT under the public contract
and the substrate may evolve them freely without supersession.

### Initial enumeration

```typescript
const SUBSTRATE_PUBLIC_SHAPES: SubstratePublicContract[] = [
  // Topology and health
  { shape: "coverageReport",          stability: "stable",   freshness_max_age_s: 3600,   audience: ["operator", "peer-substrate"], signature_version: 1 },
  { shape: "substrateHealthReport",   stability: "stable",   freshness_max_age_s: 3600,   audience: ["operator", "peer-substrate"], signature_version: 1 },
  { shape: "closureStatusReport",     stability: "stable",   freshness_max_age_s: 86400,  audience: ["operator", "auditor"],         signature_version: 1 },

  // Intervention surface
  { shape: "interventionRateReport",  stability: "stable",   freshness_max_age_s: 86400,  audience: ["operator"],                    signature_version: 1 },
  { shape: "interventionRefused",     stability: "stable",   freshness_max_age_s: null,   audience: ["operator", "auditor"],         signature_version: 1 },
  { shape: "chainStallReport",        stability: "stable",   freshness_max_age_s: 1800,   audience: ["operator"],                    signature_version: 1 },

  // External-anchor-driven reports
  { shape: "heldOutEvalReport",       stability: "stable",   freshness_max_age_s: 86400,  audience: ["operator", "auditor"],         signature_version: 1 },
  { shape: "adversarialProbeReport",  stability: "stable",   freshness_max_age_s: 86400,  audience: ["operator", "auditor"],         signature_version: 1 },
  { shape: "ciAgreementReport",       stability: "stable",   freshness_max_age_s: 86400,  audience: ["operator", "auditor"],         signature_version: 1 },

  // Forge and self-deployment
  { shape: "forkOutcome",             stability: "stable",   freshness_max_age_s: null,   audience: ["operator", "peer-substrate"], signature_version: 1 },
  { shape: "forkPromotion",           stability: "stable",   freshness_max_age_s: null,   audience: ["operator"],                    signature_version: 1 },
  { shape: "forkRollback",            stability: "stable",   freshness_max_age_s: null,   audience: ["operator"],                    signature_version: 1 },
  { shape: "proposedSpec",            stability: "experimental", freshness_max_age_s: null, audience: ["operator"],                  signature_version: 1 },
  { shape: "mergeVerdict",            stability: "stable",   freshness_max_age_s: null,   audience: ["operator", "auditor"],         signature_version: 1 },
  { shape: "recoveryReport",          stability: "stable",   freshness_max_age_s: null,   audience: ["operator"],                    signature_version: 1 },

  // Gate-blocker class
  { shape: "liftBlocker",             stability: "stable",   freshness_max_age_s: null,   audience: ["operator"],                    signature_version: 1 },
]
```

The `audience_classes` enumeration:

- `operator` — operator-vessel consumes
- `peer-substrate` — federated peer discovery-vessels and their
  internal consumers (per `2026-05-23-vessel-federation`)
- `auditor` — external auditor vessels (a class instantiable
  post-lift by the substrate; no concrete auditor-vessel ships today)

`null` freshness means "event-driven; consumer polls or subscribes
without freshness staleness as a contract concern." Non-null
freshness is a soft contract: the substrate's emitter activities
SHOULD emit at least once within the window when the underlying
state is changing; consumers MAY treat older emissions as
informational.

### Per-shape contract metadata

```typescript
interface SubstratePublicContract {
  shape: string

  stability: "stable" | "experimental" | "deprecated"
  freshness_max_age_s: number | null
  audience: AudienceClass[]
  signature_version: number      // bumps require change-supersession

  // Authenticity method (pre-H2 vs post-H2)
  authenticity_method?: "auth_boundary" | "h2_signature"   // computed; default "auth_boundary" pre-H2

  // Deprecation marker (when stability = deprecated)
  deprecated_at?: string         // ISO-8601
  successor_shape?: string       // shape name that replaces this
}
```

### What is NOT public

These shapes are substrate-internal and MUST NOT appear in the
public enumeration:

- Raw `activity_execution_traces` — operator MAY query via
  `executionTraceWithSignatures` with admin scope; not under public
  contract
- Internal validator outputs — surfaced indirectly via
  `interventionRefused`
- Raw Thompson posteriors (`variant_performance_metrics`) —
  aggregate health surfaces via `substrateHealthReport`
- Activity-template variant internals — surfaced indirectly via
  recommendation responses
- Memory notes — operator-readable via the existing memoryNote
  resolver; not third-party-readable
- Internal binding-context state-space signatures — substrate-
  private

The boundary is enforced by the `substrate-public-feed` (§E):
non-enumerated shapes are not served by the feed regardless of
caller scope.

---

## §D — Stability and authenticity guarantees

### Stability

`stability: "stable"` means: the body schema is fixed at the
declared `signature_version`. Field additions are forward-compatible
(consumers MUST ignore unknown fields). Field removals or type
changes require:

1. A new openspec change that supersedes this one
2. A new `signature_version`
3. A deprecation window during which both versions are emitted

`stability: "experimental"` means: the body schema may change
without supersession. Consumers should pin to a specific
`signature_version` if relying on the contract.

`stability: "deprecated"` means: the shape will be removed in a
future version. The `successor_shape` field points to the
replacement. Consumers SHOULD migrate.

### Freshness

`freshness_max_age_s` is a soft contract. The substrate-public-feed
emits a `freshness_warning` in its response metadata when a
returned emission's age exceeds the contract. Consumers MAY treat
the warning as actionable (e.g., the operator-vessel's
`chainStallReport`-watching activity escalates when freshness
warnings persist).

### Authenticity

Two methods, distinguished by H2 status:

**Pre-H2** — `authenticity_method: "auth_boundary"`. The substrate's
activity-api signs its HTTP responses with the org's JWT; consumer
verifies the JWT signature and treats the entire response body as
trusted. This inherits the existing auth boundary.

**Post-H2** — `authenticity_method: "h2_signature"`. Each public
emission's body carries a signature field:

```typescript
{
  ...emission_body,
  _authenticity: {
    emitting_vessel_id: string   // H2 vessel-id
    signature: string            // Ed25519 over canonical(emission_body without _authenticity)
    signed_at: string            // ISO-8601
  }
}
```

The substrate-public-feed populates `_authenticity` from each
emission's owning vessel. Consumers verify against the pubkey
resolved via discovery-vessel.

The pre→post transition is a `signature_version` bump per shape;
the feed serves both versions during the deprecation window.

---

## §E — The `substrate-public-feed` resolver

### Placement

The `substrate-public-feed` is a substrate-resident resolver
advertised by one of:

- **activity-api** — natural placement since most public shapes are
  already activity-api-resolved (`coverageReport`,
  `substrateHealthReport`, intervention reports, anchor reports)
- **development-vessel** — alternative if closure-binding favors the
  meta-vessel (proposed-spec, mergeVerdict are development-vessel-
  resolved)

The decision is a tasks.md §7 line item. Default: activity-api
(matches the majority of public-shape owners).

### Request contract

```typescript
POST /v2/substrate-public-feed/query

interface SubstratePublicFeedRequest {
  audience: AudienceClass        // required; the caller's class
  shapes?: string[]              // optional filter; default: all public shapes for the audience
  since_cursor?: string          // optional; opaque last-seen cursor
  limit?: number                 // default 100, max 1000
  freshness_check?: boolean      // default true; flags emissions older than freshness_max_age_s
}

interface SubstratePublicFeedResponse {
  emissions: Array<{
    shape: string
    impulse_id: string
    emitted_at: string
    body: object                 // shape-specific
    _authenticity?: AuthenticityEnvelope    // post-H2
    freshness_warning?: boolean
  }>
  next_cursor: string | null     // null when no more emissions in window
  feed_metadata: {
    enumeration_version: number  // bumps when SUBSTRATE_PUBLIC_SHAPES table changes
    server_time: string
    available_audiences: AudienceClass[]
  }
}
```

### Aggregation logic

1. Resolve the caller's audience: from the caller's vessel record
   (operator-vessel → `audience: "operator"`; federated peer →
   `audience: "peer-substrate"`).
2. Filter the enumeration to shapes whose `audience` includes the
   caller's class.
3. Apply the optional `shapes` filter (intersection).
4. Query each owning resolver for emissions since the
   `since_cursor`, capped at `limit / N_shapes` per shape (round-
   robin to avoid one chatty shape starving others).
5. Compute freshness warnings per emission against the contract.
6. Populate `_authenticity` (post-H2).
7. Return the merged feed with a fresh `next_cursor` (opaque
   encoding of per-shape last-seen ids).

### Closure binding

The feed is substrate-resident and closure-bound. Per
`2026-05-23-substrate-closure-properties` §1 (Resolver Closure):

- All shapes the feed queries are substrate-resolved (no operator
  shell-out)
- The feed's own dependencies (activity-api, development-vessel,
  discovery-vessel) are substrate-resident
- `closure-audit --without=operator-shell` MUST report zero
  failures for the feed pipeline

### Pagination and incremental polling

The opaque `next_cursor` encodes per-shape last-seen impulse-ids.
Consumers poll with the previously-returned cursor; the server
returns emissions strictly after each shape's recorded position.
The cursor is signed (HMAC with a server-side secret) to prevent
tampering and is opaque to consumers.

### Rate limits

The feed is subject to the standard activity-api rate-limit
middleware. No special quotas per audience pre-tuning; substrate-
authored tuning may add per-audience quotas post-lift.

---

## §F — Relationship to existing intervention-tracking

### Additive amendment

The existing `operatorIntervention` body (per
`2026-05-23-intervention-tracking` R1) is amended additively:

```typescript
// Before (intervention-tracking R1)
interface OperatorIntervention {
  id: string
  attempted_at: string
  kind: "intervention" | "maintenance" | "redundant"
  target: { target_type: string, ... }
  classification_rationale: string
  evidence: { method: string, detection_hook_id: string, ... }
}

// After (this spec)
interface OperatorIntervention {
  ...all_existing_fields,
  actor?: {
    operator_vessel_id?: string  // when identity-vessel session attribution available
    fallback: "anonymous-operator" | null  // when not
  }
}
```

The same amendment applies to `interventionRefused`'s
`intervention_attempted` substructure (which references the operator
action).

### Detection-hook attribution path

Each detection hook (per intervention-tracking §C) determines the
`actor`:

- **`fs-watcher`** — reads the modifying process's open identity-
  vessel session via the container's process-tree introspection
  (when running in single-container mode); attributes to the
  session's operator-vessel-id. Fallback: `anonymous-operator`.
- **`orchestration-log`** — reads the orchestration command's
  invoking identity-vessel session token. Fallback: `anonymous-operator`.
- **`api-origin`** — reads the request's identity-vessel session
  JWT. Fallback: `anonymous-operator`.
- **`db-audit`** — reads the SurrealDB audit event's user record;
  cross-references identity-vessel for the corresponding operator-
  vessel-id. Fallback: `anonymous-operator`.
- **`spec-attribution`** — reads the commit's
  `Co-Authored-By` trailer (operator email → identity-vessel
  user → operator-vessel-id mapping). Fallback: `anonymous-operator`.

The attribution is best-effort: when the attribution cannot be
determined, `actor.fallback: "anonymous-operator"` is emitted and
the substrate's reputation surface does NOT update for that event
(no operator-vessel-id to credit/debit).

### Push-away applies to operator-vessel

The substrate's gates that refuse interventions (verify-merge-
candidate, foundation-compliance, posterior-anomaly-check, scope-
narrowing, self-deployment-whitelist) operate against any actor,
including operator-vessels. An operator-emitted impulse that
violates a gate emits an `interventionRefused` with
`intervention_attempted.actor.operator_vessel_id` populated.

This is the categorical fulfillment of IAL §27.S.6's push-away
framing: the substrate refuses *vessels*, and the operator is one
such vessel. The refusal mechanism does not branch on whether the
vessel kind is `operator` or `executor` or `resolver`.

---

## §G — Relationship to external-resolver-vesselization

`2026-05-23-external-resolver-vesselization` codifies the general
external-system-as-vessel pattern: the substrate observes calls to
external services, infers a contract from the trace stream, and
mints a vessel that wraps the external service. The
external-resolver-vesselization machinery is the mechanism by which
the substrate post-lift extends its vessel framework to LLM
providers, GitHub, CI, peer substrates, and any other external
system it interacts with.

The operator-vessel is the **foundational instance** of this
pattern. It differs from substrate-authored vesselization of other
externals in two ways:

1. **Operator-vessel is operator-authored as a pre-lift primitive.**
   The substrate does not author its own operator-vessel through the
   ribosome — the operator's existence as a vessel is a categorical
   foundation the substrate inherits at boot, not a learned pattern.
2. **Operator-vessel does not have a "wire-external-call-pass-
   through" wrapper.** External vessels wrap a generic resolver
   (shell-exec / http-fetch / external-validation); the operator-
   vessel IS the operator and emits impulses directly through
   detection hooks.

Post-lift, the substrate authors vessels for non-operator externals
using the external-resolver-vesselization machinery. The categorical
framing those vessels inherit (kind, advertised emit shapes,
advertised consume shapes, reputation, push-away applicability) is
the framing this spec establishes for the operator.

---

## §H — Resolved questions

**Q1. Is the operator subject to push-away?**

Yes. Per §F, the substrate's refusal gates operate against any
vessel including operator-vessels. The categorical framing is what
makes push-away possible post-lift: without operator-as-vessel, the
push-away would be against an implicit category the substrate has
no first-class handle on.

**Q2. What if there are multiple operators?**

Each operator's identity-vessel session generates a distinct pubkey
→ a distinct operator-vessel-id. The substrate maintains separate
reputation per operator-vessel-id. The `interventionRateReport`
aggregator (per `2026-05-23-intervention-tracking` R4) MAY emit
per-operator-vessel breakdowns; default behavior is aggregate.

**Q3. What if substrate-public-contracts evolves?**

The enumeration is versioned via `feed_metadata.enumeration_version`.
Adding a shape to the enumeration is forward-compatible (older
consumers ignore unknown shapes). Removing a shape requires a
deprecation cycle (mark `stability: "deprecated"` with
`successor_shape`; remove in a successor openspec change after the
deprecation window).

Per-shape body schema changes follow the same supersession
discipline as every other openspec change (per
`2026-05-23-intervention-tracking` R0.3 — spec-authority rule).

**Q4. Does the operator-vessel get a private key?**

Pre-H2: the operator-vessel inherits the operator's identity-vessel
session pubkey. The substrate does not hold a private key for the
operator — it accepts the operator's session attestation and uses
the pubkey for identity binding only.

Post-H2: the operator generates an Ed25519 keypair (per H2's
construction); the operator-vessel's `vessel_id` is derived from
the pubkey via multihash. The private key is operator-resident; the
substrate never holds it.

**Q5. Does substrate-public-feed expose substrate posterior state?**

No. The feed exposes only the enumerated public shapes. Posterior
state is surfaced indirectly via `substrateHealthReport` (which
exposes confidence-passing aggregates) and via the recommendation
endpoint responses (which expose per-shape Thompson samples to the
caller making a recommendation). Raw posterior state is substrate-
internal.

**Q6. Can a peer-substrate consume the feed?**

Yes, with `audience: "peer-substrate"`. Per
`2026-05-23-vessel-federation`, peer-substrates are identified by
the peer discovery-vessel's H2 vessel-id. The feed's authentication
applies the standard activity-api auth boundary; a peer-substrate's
consumption is gated by its discovery-vessel-issued credential.

Peer-substrate consumption is a forward-compatible primitive; no
peer-substrate-specific behavior ships in this spec beyond audience
recognition.

**Q7. What happens when no operator session is active?**

The operator-vessel record persists across sessions (it is bound to
the operator's identity, not a single session). When no session is
active, the operator-vessel is `inactive`; the substrate continues
to track reputation against the persistent vessel-id. The
operator's `consume_shapes` declaration is still queryable; the
feed serves the same emissions whether the operator is online or
not.

Sessionless emissions through identity-vessel-mediated API keys
(e.g., a cron job that emits an `operatorGoal` on behalf of the
operator) attribute to the operator-vessel-id bound to that API
key's owning user.

**Q8. Why bundle the two additions?**

The two are categorically paired: the operator-vessel is the
canonical consumer of the substrate-public contract; the substrate-
public contract is the canonical surface the operator-vessel reads.
They are the same inversion viewed from the two sides of the
substrate boundary. Shipping them together avoids the asymmetric
intermediate state where one side knows about the other but the
inverse is not declared.

The scope pattern matches `2026-05-23-lift-criterion-hardening`:
two related additions, each independently testable, both addressing
the same structural gap.

---

## §I — Sequencing

This spec is operator-authored as one of the foundational pre-lift
primitives enumerated in IAL §27.S.5 (Authenticity, Cooperation).
It does NOT amend any §27.S gate; it ships data primitives the
substrate uses post-lift to extend its vessel framework to all
external systems. Lift remains substrate-measured per §27.S.4;
substrate-authored expansion follows §27.S.5's agenda.

The spec is independently shippable: Addition 1 (operator-vessel
registration) and Addition 2 (substrate-public-contracts) each have
their own acceptance gates and can be deployed in either order.
Bundling them in one change documents the categorical pairing;
parallel implementation is permitted.
