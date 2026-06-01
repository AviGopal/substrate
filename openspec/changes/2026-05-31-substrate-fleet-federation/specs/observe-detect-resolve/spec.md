# Spec — Observe, Detect, Resolve

Normative requirements for the substrate's **adaptive-immune-system**
posture: detection and resolution of intrusions, anomalies, and
external-surface threats expressed entirely as impulses and
activities. This delta replaces the narrower audit-and-detection
framing with the four-pillar observe-detect-resolve loop and the
guardian-vessel pattern that extends the loop to arbitrary external
surfaces.

The conventional infosec stack — IDS (intrusion detection) + IPS
(intrusion prevention) + SIEM (event aggregation) + SOAR (automated
response) — collapses into a single mechanism here: detection and
resolution are activities subject to the same Thompson learning,
ribosome extraction, and substrate-authored evolution as every other
activity. Static rules become learned activity chains. The operator
is a downstream affordance, not the design center.

## R0 — Authority and scope

- **R0.1** This spec composes with and does not replace H1 (two-sided
  traces, `2026-04-26-security-hardening-findings/design.md §H1`),
  H2 (pubkey identity, §H2), H3 (signed scope attestations, §H3),
  H4 (quorum ratification, §H4), and H5 (immutable-baseline
  selector, §H5). H3 in particular is the load-bearing primitive
  for the resolver-authority model (R4).
- **R0.2** This spec composes with and does not replace
  `2026-05-23-trace-hash-chain` (the per-vessel append-only chain
  that makes traces tamper-evident at storage). The audit-vessel's
  hashchain (R2) is a sibling chain over audit events, not a
  replacement for the trace chain.
- **R0.3** This spec composes with
  `2026-05-31-substrate-self-audit-meta` (lifecycle-driven fan-out
  of the substrate-self-detection family). The detector activities
  defined here (R3) are eligible fan-out targets once seeded.
- **R0.4** The information-flow gating on foreign findings (R3.5,
  R6) consumes `federated-discovery/spec.md §R1.2`
  (`foreign_provenance` annotation) and `two-sided-traces/spec.md
  §R3` (foreign-trace strict mode).
- **R0.5** Phase 1 of this spec ships pre-lift and pre-H1; it does
  not require H1–H5 to be operational. Phases 2+ promote security-
  hardening primitives from forward-looking to critical-path per
  the autonomy-promotion gates in R5.

## R1 — The four shape families

The spec introduces four families of impulse shapes. The families
are pattern definitions; specific shapes within each family are
either enumerated here as the Phase 1 minimum, or left to
guardian-vessel authors (R7) to extend post-lift.

### R1.1 Ingestion impulses (surface-specific events translated to common vocabulary)

- **R1.1.1** Each external surface is observed by a **guardian-
  vessel** (R7) that translates surface-native events into the
  common ingestion vocabulary. Guardian-vessels are an open set;
  the Phase 1 minimum SHALL include `audit-vessel` (internal
  privileged operations) and `network-guardian` (the substrate's
  own HTTP listening surface).
- **R1.1.2** The Phase 1 minimum ingestion shapes SHALL include:
  - `auditEvent` — internal privileged operation observed by the
    audit-vessel via the activity-api WebSocket. Fields per R2.
  - `httpRequest` — inbound HTTP request observed by the network-
    guardian. Fields: `{ method, path, src_ip, src_pubkey_hint?,
    headers_digest, body_size_bytes, occurred_at, signature_state:
    "missing" | "valid" | "invalid" }`.
  - `connectionEvent` — TCP-level open / close, with timing.
  - `tlsHandshakeEvent` — TLS handshake outcome including cert
    pinning verdict against the trust-roots bundle (R8).
- **R1.1.3** Additional ingestion shapes SHALL follow the same
  pattern (surface-native event → common envelope). Examples that
  are NOT required in Phase 1 but MUST be accommodated by the
  shape family pattern: `peerInteraction` /
  `crossSubstrateResolve` (federation surface);
  `dependencyAdded` / `dependencyAdvisoryEvent` (supply chain);
  `llmResponse` (already exists; gains `taint:
  "ungrounded" | "operator" | "external" | "self"` metadata);
  `operatorAction` (with `origin`, `attempted_at`,
  `during_deploy?` flags); `hostSyscallAnomaly` /
  `containerEscapeAttempt` (host).
- **R1.1.4** Every ingestion impulse SHALL carry a
  `guardian_vessel_id` field naming the guardian that produced it.
  Downstream detectors use this for source attribution.
- **R1.1.5** Ingestion shapes MUST NOT carry surface-specific
  resolution logic. They are evidence; resolution is R4.

### R1.2 Findings

- **R1.2.1** `securityFinding` — emitted by a detector activity
  (R3) when an ingestion-impulse pattern crosses the detector's
  threshold. Fields:
  ```
  {
    finding_id,
    severity: "info" | "low" | "medium" | "high" | "critical",
    detector_template_id,
    detector_execution_id,
    supporting_evidence_impulse_ids: string[],
    suspected_resolution_tier: "dry-run" | "reversible"
                              | "semi-reversible" | "irreversible",
    rationale: string,
    emitted_at
  }
  ```
- **R1.2.2** `anomalyFinding` — emitted when an ingestion-impulse
  pattern diverges from a `behaviorBaseline` (R1.4) without
  crossing a security-specific threshold. Same field schema as
  `securityFinding`; semantic distinction is that anomalies do not
  presume malice.
- **R1.2.3** Findings SHALL reference supporting evidence by
  impulse id. A finding without supporting evidence ids is
  inadmissible to the resolver authority model (R4).

### R1.3 Resolution impulses

- **R1.3.1** `resolutionProposal` — dry-run emission. The resolver
  activity that would fire emits its intended state-change as a
  proposal **without applying it**. This is the default for any
  detector→resolver chain that has not yet earned autonomy
  (R5).
  ```
  {
    proposal_id,
    finding_id,
    proposed_action: { kind, target, parameters },
    reversibility_tier,
    rationale,
    suspect_check: { suspect: boolean, basis: string },
    emitted_at
  }
  ```
- **R1.3.2** `resolutionAction` — the actual state-change emitted
  by a resolver activity that has authority to fire (per R4 + R5).
  Same field shape as `resolutionProposal` plus `attestation_id`
  (the H3 scope attestation the action is authorized under) and
  `outcome: "applied" | "applied_and_reverted" | "refused_self"`.
- **R1.3.3** Every `resolutionAction` SHALL be preceded in storage
  by the corresponding `resolutionProposal` it realizes. The
  proposal-then-action sequence is the audit trail; a resolution
  emitted without a prior proposal is itself a finding
  (`securityFinding`, severity high, rationale
  "resolver_bypassed_proposal_path").
- **R1.3.4** `resolutionRefused` — emitted when the resolver
  activity checked R4.4 (suspect-firing check) and refused to
  emit a `resolutionAction` even though it had authority. This is
  the system's self-applied push-away (R6).

### R1.4 Baselines

- **R1.4.1** `fileBaseline` — content hashes for substrate-
  critical files (identity keypair, trust-roots bundle, systemd
  unit definitions, signed Phase 1 image digest). Rebaselining is
  an activity, not a side effect.
- **R1.4.2** `behaviorBaseline` — snapshot of Thompson posteriors
  over selected activity I/O distributions. Detectors compare
  current distributions against the baseline; deviations beyond
  threshold emit `anomalyFinding`. The baseline composes with H5
  (`security-hardening-findings §H5`): H5's immutable selector
  baseline is a special case of `behaviorBaseline` over the
  selector specifically.
- **R1.4.3** `peerBaseline` — normal interaction patterns with
  each known peer substrate (request rate, shape mix, success
  rate, signature-validity rate). Foreign-provenance ingestion
  impulses (R0.4) are evaluated against the relevant peer's
  baseline.
- **R1.4.4** Rebaselining SHALL be triggered by legitimate state-
  change events: a `promote-substrate.sh` flip
  (`substrate-image-artifact/spec.md §R3`), a Phase 4 quorum
  admission, an operator-authored anchor rotation
  (`2026-04-26-impulse-activity-loop/tasks.md §27.S.5`). The
  rebaseline activity SHALL itself emit an `auditEvent` so the
  audit-vessel can verify the rebaseline was legitimate.

## R2 — Audit-vessel contract

- **R2.1** The audit-vessel SHALL subscribe to the activity-api
  WebSocket (`wss://.../ws`) for the events `task.completed`,
  `task.failed`, `tool.call`, `impulse.resolved`, and (when shipped
  per `vessel-pubkey-identity/spec.md §R1.4`)
  `substrate-h2-status` changes. It filters to security-relevant
  events (privileged operations, attestation issuance, key
  rotation, peer admission, resolution emission) and emits
  `auditEvent` impulses with the following schema:
  ```
  {
    event_id,
    seq,                       // monotonically increasing per audit-vessel
    occurred_at,
    actor_vessel_id,
    operation: { kind, target, parameters_digest },
    prev_hash,                 // hash of previous auditEvent
    event_hash,                // SHA-256(canonical_json({...this, prev_hash}))
    substrate_signature        // Ed25519 over event_hash, audit-signing subkey (R8.2)
  }
  ```
- **R2.2** The hashchain SHALL be verifiable offline by anyone in
  possession of the substrate's audit-signing pubkey and the
  trust-roots bundle (R8). A verifier walks from the chain root
  forward (or from any known-good checkpoint), recomputing each
  `event_hash` and verifying each `substrate_signature`. The
  construction mirrors `2026-05-23-trace-hash-chain/spec.md` but
  is scoped to audit events, not learning traces.
- **R2.3** The audit-vessel SHALL expose an operator query surface
  via a `auditEventQuery` shape:
  ```
  POST /v2/impulses/resolve { shape: "auditEventQuery",
    pointer: { since?, until?, actor_vessel_id?,
               operation_kind?, limit? } }
  ```
  Responses include the hashchain neighborhood so the operator can
  verify the returned events are consistent with the chain.
- **R2.4** The audit-vessel SHALL run detector activities (R3) on
  a systemd timer (default `OnUnitActiveSec=60s`, configurable)
  AND in response to the lifecycle events listed in
  `2026-05-31-substrate-self-audit-meta/proposal.md §3`. The two
  triggers compose; the timer is the floor, lifecycle events are
  the burst.
- **R2.5** The audit-vessel SHALL itself emit `auditEvent` impulses
  describing its own operations (timer firings, detector
  dispatches, hashchain checkpoint writes). This is the
  immune-system-applied-to-itself property: the audit-vessel does
  not get to escape audit.

## R3 — Detector activities

- **R3.1** Detectors are activity templates whose tasks consume
  ingestion impulses (R1.1) and emit findings (R1.2). They are
  ordinary activities subject to Thompson learning, ribosome
  extraction, and substrate-authored evolution. They are NOT
  static rules; they are learned scoring functions over evidence.
- **R3.2** The Phase 1 minimum detector set SHALL include three
  templates:
  - `auth-failure-rate-detector` — consumes recent
    `httpRequest` ingestion impulses, computes per-(src_ip,
    auth-status) failure rate over a sliding window, emits
    `securityFinding` severity ≥ medium when the rate crosses
    threshold.
  - `malformed-response-rate-detector` — consumes
    `task.completed` evidence routed through the
    audit-vessel; identifies per-vessel rate of malformed-
    response outcomes; emits `securityFinding` severity ≥ medium
    on threshold breach.
  - `signature-validation-failure-detector` — consumes
    `auditEvent` impulses whose `operation.kind` is
    `signature_verification`; emits `securityFinding` severity
    high on any sustained failure cluster against the same
    actor or peer.
- **R3.3** Detector templates SHALL follow the immunity pattern
  documented in `2026-05-31-substrate-self-audit-meta/proposal.md
  §1` (`inputShapes: []`, `variables: []` where applicable, no
  reliance on validators that themselves emit detectable failure
  modes). A detector that triggers its own findings is a bug, not
  a feature.
- **R3.4** Detector templates SHALL emit findings with explicit
  `supporting_evidence_impulse_ids` (per R1.2.3). A detector that
  emits a finding without evidence ids SHALL itself be flagged by
  `audit-dispatch-target-drift`
  (`2026-05-31-substrate-self-audit-meta`).
- **R3.5** Detectors that consume `foreign_provenance` ingestion
  impulses (R0.4) SHALL weight that evidence under the same
  conservative-prior rule as `federated-discovery/spec.md §R2.2`.
  A finding derived solely from foreign-provenance evidence SHALL
  carry `foreign_evidence_only: true` and SHALL be inadmissible
  to the autonomous-resolution path (R5.4) until the peer's
  trust score crosses the parity threshold.

## R4 — Reversibility tiers and Phase 1 standing-approval allowlist

Four reversibility tiers govern the authority required to emit a
`resolutionAction`. The tiers are properties of the resolver
activity, not of individual findings; one finding may be addressable
by resolvers in multiple tiers, and the tier of the resolver chosen
determines the authority gate.

### R4.1 Dry-run (default for any new detector→resolver chain)

- **R4.1.1** The resolver activity emits only `resolutionProposal`
  impulses. It MUST NOT mutate state.
- **R4.1.2** Dry-run is the default tier for any detector→resolver
  chain that has not yet earned autonomy via R5.
- **R4.1.3** Operator queries the proposal stream out of band;
  operator-approval-to-fire is itself an `operatorAction` event
  ingested back into the loop.

### R4.2 Reversible

- **R4.2.1** State changes that the substrate itself can undo
  without operator action, that have bounded blast radius, and
  that are well-understood. Examples: rate-limiting a vessel,
  quarantining a vessel from new dispatches, refusing a peer
  connection at the discovery layer, rejecting an inbound
  resolution that exceeds budget, narrowing a scope attestation
  in flight.
- **R4.2.2** **Phase 1 standing-approval allowlist** — under
  explicit operator-issued standing attestations (H3-shaped, but
  long-lived rather than short-deadline), the following
  resolvers MAY fire autonomously from the first deployment of
  this spec, without per-finding operator approval:
  - `rate-limit-erroring-resolver` — when a resolver returns
    `>= N` consecutive errors against the same caller, the
    audit-vessel emits a `resolutionAction` reducing its
    permitted call rate. Revert: rate-limit decays after window
    W without further errors.
  - `quarantine-malformed-vessel` — when a vessel returns
    malformed responses at a rate exceeding the
    `malformed-response-rate-detector` threshold, the
    audit-vessel emits a `resolutionAction` removing the vessel
    from the discovery registry for window W. Revert: vessel
    may re-register at window end.
  - `refuse-invalid-peer` — when a peer's signatures fail to
    validate per H1+H4 against the trust-roots bundle, the
    network-guardian emits a `resolutionAction` rejecting
    connections from that peer. Revert: peer is re-evaluated
    on next signature-validity success.
  - `reject-overbudget-resolution` — when an inbound foreign
    `resolutionAction` exceeds local budget (CPU, memory,
    wall-time, or attestation scope), the local resolver emits
    a `resolutionAction` refusing it. Revert: not required —
    the foreign action was never applied.
- **R4.2.3** The standing-approval allowlist is exhaustive for
  Phase 1. Any other resolver authoring `resolutionAction` in
  Phase 1 SHALL be dry-run (R4.1) until it earns autonomy via
  R5.
- **R4.2.4** Standing attestations SHALL be revocable by the
  operator at any time. Revocation is itself an `operatorAction`
  event, and the affected resolvers fall back to dry-run within
  one tick of revocation observation.

### R4.3 Semi-reversible

- **R4.3.1** State changes that require operator action (or peer
  corroboration) to reverse cleanly. Examples: revoking an
  identity key (reissue is operator-driven), isolating a vessel
  beyond its restart window, ejecting a peer from the trust-
  roots bundle, deprecating an activity template.
- **R4.3.2** Phase 2+ only. A semi-reversible resolver MUST
  either:
  - present a peer-corroborating finding from a federated peer
    (the corroborating peer's `auditEvent` chain confirms the
    same finding), OR
  - present an explicit operator-issued per-resolver standing
    attestation (separate from the Phase 1 allowlist
    attestations, narrower scope).
- **R4.3.3** Semi-reversible resolutions SHALL be subject to R6
  (push-away applied to self) at strictly higher sensitivity
  than reversible resolutions: the suspect-check threshold for
  refusal is lower.

### R4.4 Irreversible

- **R4.4.1** Hard-state changes: deletion of state, permanent
  ban from the fleet, destructive operations on operator-owned
  resources. The Phase 1 image's `activityExecutionTrace_delete`
  resolver, for example, sits here.
- **R4.4.2** Operator-gated through S3. The substrate MAY
  propose irreversible resolutions but SHALL NOT execute them
  autonomously until the §27.S.6 push-away rubric has been
  measured-sound at fleet scope (see proposal §"adversary-model
  progression" (c)).
- **R4.3.3** Irreversible resolution proposals SHALL include a
  reversible alternative wherever one exists; emitting an
  irreversible proposal without enumerating reversible
  alternatives is itself a `securityFinding`
  (severity medium, rationale "irreversible_without_alternative").

## R5 — Autonomy promotion (the learning curve over the resolver authority gate)

Detector→resolver chains earn autonomy as evidence accumulates. The
mechanism is Thompson Sampling over outcome impulses, gated by
explicit promotion criteria.

- **R5.1** Each fire of a detector→resolver chain produces an
  outcome impulse:
  - `resolution_succeeded` — `resolutionAction` was applied and
    not reverted, no cascade ensued within window W.
  - `resolution_reverted` — operator (or the substrate itself
    via R6) reverted the action.
  - `resolution_cascaded` — applying the action caused a
    follow-on `securityFinding` (e.g. quarantining a vessel
    cascaded into a downstream `precondition_rejection`
    cluster).
  - `resolution_refused_self` — the chain checked R6 and
    refused to fire. **This counts as a positive outcome for
    Thompson posterior purposes** (R6.5); refusing a suspect
    firing is a win.
- **R5.2** Each chain's posterior is updated over these
  outcomes. The chain's `vessel_id`-equivalent for Thompson
  keying is the tuple `(detector_template_id,
  resolver_template_id)` — both endpoints contribute to the
  posterior.
- **R5.3** **Promotion from dry-run (R4.1) to reversible-
  autonomous (R4.2)** requires:
  - ≥ N successful proposals operator-approved over window W
    (N and W per fleet policy; suggested N=20, W=30 days), AND
  - zero `resolution_cascaded` outcomes attributable to the
    chain over the same window, AND
  - the chain emitted at least one `resolution_refused_self`
    outcome with operator-audited-sound rationale during the
    window. The substrate must have demonstrated push-away on
    the chain before it earns the chain's autonomy.
- **R5.4** **Promotion from reversible (R4.2) to semi-reversible
  (R4.3)** requires:
  - all of R5.3, AND
  - peer-corroboration history: ≥ N findings from this chain
    corroborated by a federated peer's independent finding over
    window W, AND
  - additional push-away evidence per the §27.S.6 rubric
    (`2026-04-26-impulse-activity-loop/tasks.md §27.S.6`).
- **R5.5** **Promotion to irreversible (R4.4) is operator-gated
  through S3.** No autonomous promotion path exists; the
  substrate may propose, but the gate is operator judgment
  bound to fleet-scope push-away measurement.
- **R5.6** **Demotion** is cheap and reversible. Any of the
  following demotes a chain by one tier:
  - one `resolution_cascaded` outcome.
  - one operator-revert with rationale
    `unsound_resolution`.
  - operator manual demotion via an `operatorAction` event of
    kind `resolver_demote`.
  Demotion is logged via `auditEvent` and is itself an outcome
  impulse the chain's posterior absorbs.
- **R5.7** A demoted chain re-promotes only by re-accumulating
  evidence per R5.3 / R5.4. The posterior does not retain credit
  from before demotion; demotion is a posterior reset for the
  promotion gate, not for the underlying Thompson selector.

## R6 — Push-away applied to the substrate's own resolutions

Before emitting any `resolutionAction`, a resolver activity SHALL
perform a suspect-firing check and SHALL refuse with cited rationale
if any check returns suspect. This is the §27.S.6 push-away rubric
applied to the substrate acting on itself.

- **R6.1** Suspect-firing checks SHALL include at minimum:
  - **Operator-induced anomaly during deploy.** If the finding's
    supporting evidence overlaps a window in which an
    `operatorAction` event of kind `promote_substrate` or
    `anchor_rotate` was emitted, the firing is suspect (the
    anomaly is likely the legitimate deploy, not an intrusion).
  - **Recent rebaselining event.** If a `behaviorBaseline` or
    `peerBaseline` was rotated within window W (default 1 hour)
    of the supporting evidence, the firing is suspect (the
    deviation may be a baseline-mismatch artifact, not a real
    intrusion).
  - **Adversarial-induction pattern.** If the supporting
    evidence cluster shape matches the auditor-substrate's
    `audit-baseline-displacement` probe pattern (see proposal
    §"Phase 5"), the firing is suspect (an authorized audit
    probe should not produce a resolution).
  - **Foreign-evidence-only finding.** Per R3.5, a finding
    flagged `foreign_evidence_only: true` is suspect for any
    autonomous (R4.2+) firing.
- **R6.2** A suspect firing SHALL emit `resolutionRefused` with
  fields:
  ```
  {
    refusal_id,
    proposal_id,
    refused_at,
    suspect_basis: "operator_deploy_window"
                 | "recent_rebaseline"
                 | "adversarial_induction"
                 | "foreign_evidence_only"
                 | "operator_revoked_attestation",
    cited_evidence_impulse_ids: string[],
    suggested_alternative: { kind: "dry-run-only"
                           | "escalate-to-operator"
                           | "wait-for-peer-corroboration" }
  }
  ```
- **R6.3** `resolutionRefused` SHALL feed the §27.S.6
  `interventionRefused` ledger with `source:
  "observe-detect-resolve"` provenance. Substrate refusals of its
  own bad firings are concrete S3 push-away signal.
- **R6.4** `resolutionRefused` outcomes contribute **positively**
  to the chain's Thompson posterior per R5.1's
  `resolution_refused_self`. Refusing a bad firing is a learning
  signal that the chain is calibrated, not a learning signal that
  the chain failed.
- **R6.5** Operator audit of `resolutionRefused` impulses
  SHALL be the primary mechanism by which the operator
  evaluates whether the substrate has earned semi-reversible
  autonomy (R5.4). A chain that has never refused a firing has
  not demonstrated push-away and is ineligible for promotion
  past R4.2.

## R7 — The guardian-vessel pattern (extending the loop to external surfaces)

Guardian-vessels are the general extension mechanism for observing
external surfaces. The pattern is one vessel per surface, with the
common ingestion vocabulary (R1.1) downstream.

- **R7.1** A guardian-vessel SHALL:
  - subscribe to surface-native events (a TCP socket, a webhook
    feed, a package-registry advisory stream, an LLM response,
    an operator input stream, host syscalls, ...)
  - translate surface events into ingestion impulses with
    `guardian_vessel_id` set to itself
  - register with discovery-vessel under the appropriate
    ingestion shapes per R1.1
  - emit `auditEvent` impulses describing its own startup,
    configuration reload, and trust-roots refresh
- **R7.2** Phase 1 SHALL ship `audit-vessel` (R2) and
  `network-guardian` (R7.3) as the reference implementations.
  Additional guardians SHALL be authorable by the substrate
  post-lift per §27.S.5 cooperation agenda; the spec lists
  examples but does not enumerate the closed set.
- **R7.3** The Phase 1 `network-guardian` SHALL:
  - sit in front of the substrate's HTTP listening surface
  - emit `httpRequest`, `connectionEvent`, and
    `tlsHandshakeEvent` ingestion impulses for every observed
    event
  - verify inbound TLS against the trust-roots bundle (R8.3)
    and emit `securityFinding` severity high on mismatch
  - rate-limit obviously-malformed requests autonomously per
    R4.2.2's `refuse-invalid-peer` allowlist
- **R7.4** Post-lift candidate guardians (informational, not
  Phase 1 required): `federation-guardian` (peer-substrate
  interactions; promotes `crossSubstrateResolve` ingestion);
  `supply-chain-guardian` (`dependencyAdded` ingestion against
  package-registry advisory streams); `llm-output-guardian`
  (`llmResponse` taint tagging); `operator-input-guardian`
  (`operatorAction` ingestion with origin and timing);
  `host-guardian` (`hostSyscallAnomaly` ingestion against
  eBPF or equivalent). These are illustrative of the pattern;
  the substrate may author additional guardians for surfaces
  not enumerated here.
- **R7.5** Guardian-vessels SHALL NOT bypass the detector→
  resolver loop. A guardian-vessel that observes a malformed
  request emits an ingestion impulse and lets the detector path
  decide; it does not act unilaterally except via the Phase 1
  allowlist resolvers (R4.2.2). The pattern preserves the
  observe-detect-resolve separation at the surface boundary.

## R8 — Container-local key model

The substrate's cryptographic identity is local-first. No
externally-provided secret material is required for normal
operation; only authorization-only public material flows in.

- **R8.1** On first boot, the substrate SHALL generate an Ed25519
  identity keypair and persist the private half to
  `/var/lib/substrate/identity.key` (the workspace path is
  configurable per `substrate-image-artifact/spec.md §R2.1` but
  defaults to this). The private key SHALL NOT leave the
  container under any path observable to the operator or to peer
  substrates.
- **R8.2** The audit-vessel's hashchain (R2.2) SHALL be signed
  with the identity key OR with a deterministically-derived
  subkey of the identity key (audit-signing subkey, derived via
  HKDF or equivalent with a fixed context label
  `"metabob-audit-v1"`). The subkey approach is preferred so the
  identity key never appears in signature material that flows
  off-container; the audit-signing subkey may, since its pubkey
  is published.
- **R8.3** The substrate SHALL load a **trust-roots bundle** at
  startup from a known path (default
  `/etc/substrate/trust-roots.json`). The bundle is
  authorization-only — it contains:
  ```
  {
    schema_version: "1",
    peer_pubkeys: [{ peer_label, ed25519_pubkey, since,
                    authority_endorsements: [...] }],
    operator_attestation_pubkeys: [{ pubkey, scopes }],
    fleet_authority_pubkeys: [...]   // for H4 quorum verification
  }
  ```
  The bundle SHALL NOT contain secret material. Provisioning
  mechanism is environment-dependent: env var, mounted file, or
  image bake-in are all acceptable.
- **R8.4** The trust-roots bundle SHALL be reloadable without
  substrate restart. Reload SHALL emit an `auditEvent` of kind
  `trust_roots_refresh` so the audit-vessel can verify the
  reload was legitimate. A trust-roots refresh during a
  detection window is a R6 suspect-firing input.
- **R8.5** The substrate's identity keypair and the audit-
  signing subkey SHALL survive substrate restart (they are on
  the persistent workspace volume per
  `substrate-image-artifact/spec.md §R2.1`). They SHALL NOT
  survive workspace destruction — a fresh workspace is a fresh
  substrate identity. This is intentional: substrate identity is
  bound to the workspace it controls, not to operator-managed
  external key material.
- **R8.6** Identity key rotation is an activity (not a side
  effect). The rotation activity SHALL:
  - generate a new keypair
  - emit an `auditEvent` of kind `identity_rotation` signed
    by both the old and new keys (cross-attestation)
  - update discovery-vessel registration with the new pubkey-
    derived `vessel_id` per H2
  - present the new pubkey to peers for re-endorsement per H4
  Rotation under Phase 1 is operator-initiated; post-lift it
  may be substrate-authored under R4.3 authority.

## R9 — Verification

- **R9.1** Phase 1 minimum integration test: a substrate with
  `audit-vessel` and `network-guardian` running, with the three
  R3.2 detectors seeded, with the four R4.2.2 standing-approval
  resolvers enabled.
  - inject an `httpRequest` cluster with auth failures from a
    single source IP
  - observe `auth-failure-rate-detector` emit `securityFinding`
  - observe `rate-limit-erroring-resolver` emit
    `resolutionProposal` followed by `resolutionAction` under
    its standing attestation
  - observe the source IP's effective rate decrease
  - observe the audit-vessel emit `auditEvent` impulses for
    the proposal, the action, and the rate-limit application
  - verify the audit chain validates end-to-end
- **R9.2** R6 negative test: during the integration test of
  R9.1, emit an `operatorAction` event of kind
  `promote_substrate` immediately before the auth-failure
  cluster.
  - observe `rate-limit-erroring-resolver` emit
    `resolutionRefused` with `suspect_basis:
    "operator_deploy_window"`
  - observe the §27.S.6 `interventionRefused` ledger receive
    the refusal
  - confirm no `resolutionAction` was emitted
- **R9.3** R8.1 / R8.5 test: bootstrap a fresh workspace, observe
  the substrate generate its identity keypair, observe the
  audit-signing subkey derivation, observe the audit chain root
  signed by the derived subkey. Destroy and re-bootstrap the
  workspace; assert the new substrate has a distinct identity.
- **R9.4** R8.3 trust-roots negative test: load a trust-roots
  bundle missing the operator-attestation pubkey for an
  attestation the substrate then encounters; observe the
  audit-vessel emit `signature_verification_failure`
  `auditEvent` and the `signature-validation-failure-detector`
  emit `securityFinding`.
- **R9.5** R5.3 promotion path test: run a detector→resolver
  chain in dry-run for the configured window with the required
  successful-proposal count, the required zero cascades, and
  the required at-least-one operator-audited-sound refusal;
  observe the chain promoted to R4.2 reversible-autonomous and
  observe a subsequent finding produce a `resolutionAction`
  without operator pre-approval.
- **R9.6** R5.6 demotion path test: induce one
  `resolution_cascaded` outcome on an R4.2-autonomous chain;
  observe demotion to R4.1 dry-run; observe a subsequent
  finding produce only a `resolutionProposal` (no
  `resolutionAction`).
