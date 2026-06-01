# Tasks — Substrate Fleet Federation

> Phase 1 is operator-authored and concrete; this is the next pick-up.
> Phase 2 sketches the deployment surface (work is owned by
> `2026-05-23-vessel-federation`; this file tracks completion).
> Phases 3–5 are deferred with explicit gates — they are the
> substrate's post-lift work per IAL §27.S.5, not operator-authored
> tasks.

## Sequencing

```
Phase 1 (image artifact)  ──┐
                            ├──> Phase 4 (self-install)
Phase 2 (H2) ──> Phase 3 ──┘
       │            │
       │            └──> Phase 5 (audit substrate)
       └──> Phase 4 directly (H2 needed by quorum-presentation)
```

Phase 1 and Phase 2 may run in parallel. Phase 3 strictly requires
Phase 2 (H2-derived identities for signature paths). Phase 4
requires Phase 1 (image artifact) and Phase 2 (identity) and Phase
3 (federated discovery routing layer). Phase 5 requires Phase 3
(foreign trace gating) plus H3 and H5 from
`2026-04-26-security-hardening-findings`.

---

## Phase 1 — Substrate image as deployable artifact

Concrete tasks ready for the next operator-driven pick-up. None
require H1–H5.

### 1.1 CI image build pipeline

- [ ] 1.1.1 (`scripts/substrate`, super-repo CI) Author a GitHub
  Actions workflow that builds `metabob/substrate:<git-sha>` from
  `scripts/substrate/` on every push to `dev`. The workflow SHALL
  also push the rolling `metabob/substrate:dev` alias.
- [ ] 1.1.2 (super-repo CI) Pin the build inputs: super-repo
  git-sha plus each vessel submodule's resolved commit. Record the
  resolved pin set in the image as a label
  (`metabob.substrate.build-pins`).
- [ ] 1.1.3 (super-repo CI) Verify build reproducibility: run two
  parallel builds on identical inputs in CI and assert image
  content digests match. Fail the workflow on mismatch.
- [ ] 1.1.4 (super-repo CI) Sign the published image with a cosign-
  equivalent key held by the CI identity. Publish the signature
  alongside the image tag. The signing key MUST be distinct from
  vessel pubkeys (H2) and fleet authority keys (H4).
- [ ] 1.1.5 (`scripts/substrate`) Author a `metabob/substrate:
  <git-sha>` Dockerfile under `scripts/substrate/` (or move the
  existing `Makefile` build logic into one) that the CI workflow
  invokes. Build output SHALL include the `bootstrap` binary
  from 1.2.

### 1.2 `metabob-substrate bootstrap` command

- [ ] 1.2.1 (`scripts/substrate`) Author a `bootstrap` shell script
  or Bun binary that implements `specs/substrate-image-artifact/
  spec.md §R2`. The command takes `--image`, `--workspace`,
  `--anthropic-api-key` and performs image pull, signature
  verification, secret generation, container start, seed-identity
  execution, and `~/.metabob/config.json` configuration.
- [ ] 1.2.2 (`scripts/substrate`) Bootstrap SHALL be idempotent
  (R2.3). Re-invocation against an existing workspace re-uses
  persisted secrets and skips already-completed steps.
- [ ] 1.2.3 (`scripts/substrate`) Bootstrap SHALL emit a
  structured `bootstrapTrace` log (R2.5) suitable for ingestion
  by a Phase 4 self-install activity. Format is JSONL with one
  record per step.
- [ ] 1.2.4 (`scripts/substrate`) Bootstrap SHALL fail closed on
  signature verification failure with an explicit error message.
- [ ] 1.2.5 (`scripts/substrate`) Wrap the existing
  `gen-env.sh`, `seed-identity.ts`, and `configure-local.sh`
  invocations from the current Makefile. These remain the source
  of truth for what bootstrap does; the binary is the new entry
  point.

### 1.3 `promote-substrate.sh`

- [ ] 1.3.1 (`scripts/substrate`) Author `promote-substrate.sh`
  that updates a vessel's image tag in the relevant
  `scripts/substrate/units/<vessel>.service` file and restarts
  the systemd unit inside the substrate. The script SHALL accept
  `--vessel <name>` and `--tag <image-tag>`.
- [ ] 1.3.2 (`scripts/substrate`) Document the coexistence rule
  in `scripts/substrate/README.md` (or equivalent): vessels in
  `scripts/substrate/units/` are promoted via this script;
  vessels still on the Kubernetes path continue to use
  `repos/deployment/scripts/promote-canary-to-production.sh`.
- [ ] 1.3.3 (`scripts/substrate`) `promote-substrate.sh` SHALL
  verify the new image tag's signature before flipping the unit.
  Failed signature → refuse promotion.

### 1.4 Phase 1 verification

- [ ] 1.4.1 (operator) Bootstrap the substrate on a fresh VM (no
  prior Metabob state) using only the published image tag and an
  Anthropic API key. Measure cold-start to first green `/health`.
  Acceptance: under 10 minutes (R2.4).
- [ ] 1.4.2 (operator) Three independent operators bootstrap the
  same `metabob/substrate:<git-sha>` on three VMs. Assert all
  three reach green `/health` within the window. Assert image
  content digest identical across all three.
- [ ] 1.4.3 (operator) Parse a `bootstrapTrace` from 1.4.1 and
  assert it contains the R4.3 fields.

---

## Phase 2 — Vessel pubkey identity (H2 deployment)

This phase tracks completion of H2 across the substrate. The
implementation work is owned by
`2026-05-23-vessel-federation/tasks.md §1`. The fleet-federation-
specific task is the activation gate.

### 2.1 Track H2 rollout

- [ ] 2.1.1 (operator, tracking only) Confirm every vessel listed
  in `scripts/substrate/units/` has been migrated per
  `2026-05-23-vessel-federation/tasks.md §1.6–§1.7`. Update this
  task list with the confirmed-migrated set.
- [ ] 2.1.2 (operator, tracking only) Confirm discovery-vessel
  `enforcement` flag is flipped to `"reject"` per
  `vessel-pubkey-identity/spec.md §R1.2`.

### 2.2 substrate-h2-status impulse

- [ ] 2.2.1 (`discovery-vessel`) Implement `substrate-h2-status`
  shape on discovery-vessel per `vessel-pubkey-identity/spec.md
  §R1.4`. The shape body summarizes per-vessel pubkey + identity-
  vessel attestation state.
- [ ] 2.2.2 (`discovery-vessel`) The shape's resolver SHALL
  return live data from the registry; no caching beyond the
  existing registry TTL.

### 2.3 Activation gate plumbing

- [ ] 2.3.1 (`metabob-activity-api`) Phase 3 activation flag
  reads `substrate-h2-status` and refuses to enable foreign-
  provenance Thompson update paths (per `federated-discovery/
  spec.md §R3`) if any vessel reports incomplete H2.
- [ ] 2.3.2 (`concept-db`) Same gate for foreign-provenance usage
  ingestion (per `federated-discovery/spec.md §R2`).

---

## Phase 3 — Federated discovery + two-sided traces (DEFERRED)

**Gate (a):** Phase 2 complete (substrate-h2-status reports all
vessels migrated and enforcement=reject). Phase 1 not strictly
required but strongly preferred for ease of multi-substrate test.

**Gate (b):** H1 cryptographic implementation merged per
`2026-04-26-security-hardening-findings/tasks.md §1`. This is the
substantive blocker.

**Authoring expectation:** post-lift. Per IAL §27.S.5
"Federation" subsection, the substrate is expected to author H1
deployment as part of its post-lift agenda. This task list does
not enumerate the H1 implementation tasks (owned by security-
hardening) or the discovery-routing tasks (owned by vessel-
federation). It enumerates the **fleet-federation-specific
additions** that build on top.

### 3.1 Foreign-provenance annotation (sketch)

- Foreign-provenance annotation flows from discovery-vessel
  reachability into impulse records. Concrete implementation
  point: wherever impulses are constructed for return after a
  peer-routed resolve (likely `discovery-vessel` itself or the
  callee's resolver wrapping).

### 3.2 Concept-db ingestion (sketch)

- Add `provenance` field to observed-usage records. Implement
  the separate-prior treatment per `federated-discovery/spec.md
  §R2.2`. The construction is implementation-defined; the
  testable property is the convergence-bound from R2.3.

### 3.3 Activity-API Thompson gating (sketch)

- Read `foreign_provenance` on traces; gate α/β delta per
  `federated-discovery/spec.md §R3` and
  `two-sided-traces/spec.md §R3`.

### 3.4 Pairing job extension (sketch)

- Extend the H1 pairing job to handle cross-substrate views per
  `two-sided-traces/spec.md §R4`. Federated-discovery resolve of
  the `executionTrace` shape on the peer is the mechanism.

---

## Phase 4 — Quorum ratification + self-install (DEFERRED)

**Gate:** Phase 1 + Phase 2 + Phase 3 complete. Adversary model
(b) is the target. H4 implementation per
`2026-04-26-security-hardening-findings/tasks.md §4` is the
substantive blocker.

**TODO(operator):** Confirm quorum size N for the operator-
controlled fleet. The H4 spec leaves this as org policy. For
three operator-controlled substrates the natural default is 2-of-3;
for the eventual semi-trusted federation, the number is policy-
defined per fleet.

### 4.1 Quorum-presentation activity (sketch)

- An activity dispatched by the originating substrate that
  requests N peers to sign authority endorsements for a new
  substrate's discovery-vessel pubkey. The activity collects
  signatures, submits them to the fleet's authority log,
  confirms quorum.

### 4.2 Self-install activity (sketch)

- Composes substrate-self-deployment's commit/PR/merge primitives
  with Phase 1's `bootstrap` command. Authors a bootstrap manifest,
  dispatches bootstrap on the target host via SSH or equivalent,
  performs 4.1 once the new substrate is reachable.

### 4.3 Enforcement-mode flip on peer table (sketch)

- discovery-vessel peer table enforcement flag flips from log-only
  (vessel-federation §C, current) to enforce-mode under H4. Peers
  without sufficient endorsements are not added to the peer set.

---

## Phase 5 — Adversarial auditor substrate (DEFERRED)

**Gate:** Phase 3 complete (foreign-trace gating operational) +
H3 and H5 implementations per
`2026-04-26-security-hardening-findings/tasks.md §3 and §5`.

**Authoring expectation:** post-lift, possibly substrate-authored.
The auditor is itself a substrate; its activity templates are
substrate-authored work targeting peers.

### 5.1 Audit activity templates (sketch)

- `audit-registration-spoofing`, `audit-scope-narrowing-bypass`,
  `audit-foreign-trace-poisoning`, `audit-baseline-displacement`
  per proposal §"Phase 5".

### 5.2 H3 scope attestation envelope (sketch)

- The audit substrate's identity-vessel issues scope attestations
  per H3 with narrow audience and short deadline. Auditees verify
  before serving. Failed attestation rejects probes at the
  auditee boundary.

### 5.3 Push-away ledger contribution (sketch)

- Audit findings flow back as `interventionRefused` (probe
  refused, auditee defended) or `verifier_negative` (probe
  succeeded, auditee did not defend) impulses. These accumulate
  in the §27.S.6 ledger with `source: "audit-substrate"`
  provenance.

---

## Phase 1 (continued) — Observe, detect, resolve (foundational loop)

The observe-detect-resolve loop ships in Phase 1 alongside the image
artifact. It does NOT require H1–H5 to be operational; the four
Phase 1 standing-approval resolvers (§R4.2.2 of
`specs/observe-detect-resolve/spec.md`) use operator-issued long-
deadline attestations, not the substrate's fleet-scope H3
construction. Phase 1 ships the LOOP, not just the LOG.

Concrete tasks ready for the next operator-driven pick-up.

### 1.5 Container-local key model + trust-roots bundle

- [ ] 1.5.1 (`scripts/substrate`) On first boot, generate Ed25519
  identity keypair at `/var/lib/substrate/identity.key` (or the
  configured workspace path). Derive an audit-signing subkey via
  HKDF with context `"metabob-audit-v1"`. Persist both. Per
  `observe-detect-resolve/spec.md §R8.1`–`§R8.2`.
- [ ] 1.5.2 (`scripts/substrate`) Load `trust-roots.json` from a
  known path (default `/etc/substrate/trust-roots.json`) at
  startup. Provide reload-on-SIGHUP and emit
  `trust_roots_refresh` `auditEvent` on reload per §R8.4.
- [ ] 1.5.3 (`scripts/substrate`) Document the trust-roots
  schema in `scripts/substrate/README.md`. Make explicit that
  the bundle is authorization-only (no secret material).
- [ ] 1.5.4 (`scripts/substrate`) Identity key rotation activity
  per §R8.6. Phase 1 is operator-initiated; the activity emits
  the cross-attestation `auditEvent`.

### 1.6 audit-vessel (Phase 1 guardian reference)

- [ ] 1.6.1 (`repos/audit-vessel`, new) Scaffold the audit-vessel
  per `2026-04-24` TypeScript vessel template
  (`docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md`). Single
  systemd unit under `scripts/substrate/units/audit-vessel.service`.
- [ ] 1.6.2 (`repos/audit-vessel`) Subscribe to activity-api
  WebSocket; filter to security-relevant events per §R2.1; emit
  `auditEvent` impulses with the §R2.1 schema. Signature uses
  the audit-signing subkey from 1.5.1.
- [ ] 1.6.3 (`repos/audit-vessel`) Implement the hashchain per
  §R2.2: `prev_hash` + `event_hash` + `substrate_signature` on
  every event. Construction reuses the canonical-JSON encoder
  from `2026-05-23-trace-hash-chain` (operator may need to
  factor it out of activity-api into a shared package; defer
  the refactor and inline the implementation for Phase 1).
- [ ] 1.6.4 (`repos/audit-vessel`) Implement `auditEventQuery`
  shape resolver per §R2.3. Response includes the queried
  events plus the hashchain neighborhood (prev + next event
  hashes) so the operator can verify locally.
- [ ] 1.6.5 (`repos/audit-vessel`) Implement systemd-timer
  detector dispatch per §R2.4 (default
  `OnUnitActiveSec=60s`). Also subscribe to lifecycle events
  per `2026-05-31-substrate-self-audit-meta`.
- [ ] 1.6.6 (`repos/audit-vessel`) Emit `auditEvent` for the
  audit-vessel's own operations per §R2.5 (timer firings,
  configuration reloads, hashchain checkpoints).
- [ ] 1.6.7 (operator verification) Walk the hashchain offline
  with the audit-signing pubkey + a known-good checkpoint;
  assert chain validates end-to-end on a one-hour event volume.

### 1.7 network-guardian (Phase 1 guardian reference)

- [ ] 1.7.1 (`repos/network-guardian`, new) Scaffold the
  network-guardian. Sits in front of the substrate's HTTP
  listening surface; one systemd unit.
- [ ] 1.7.2 (`repos/network-guardian`) Emit `httpRequest`,
  `connectionEvent`, and `tlsHandshakeEvent` ingestion impulses
  per `observe-detect-resolve/spec.md §R1.1.2` for every
  observed event. Set `guardian_vessel_id` to itself.
- [ ] 1.7.3 (`repos/network-guardian`) Verify inbound TLS
  against the trust-roots bundle (R8.3); emit
  `securityFinding` severity high on mismatch.

### 1.8 Phase 1 detector minimum

- [ ] 1.8.1 (`repos/development-vessel`) Seed
  `auth-failure-rate-detector` activity template per §R3.2.
  Consumes recent `httpRequest` ingestion impulses; computes
  per-(src_ip, auth-status) failure rate over a sliding window;
  emits `securityFinding` on threshold breach with
  `supporting_evidence_impulse_ids`.
- [ ] 1.8.2 (`repos/development-vessel`) Seed
  `malformed-response-rate-detector` activity template per
  §R3.2. Consumes `task.completed` evidence via the
  audit-vessel; per-vessel malformed-response rate; emits
  `securityFinding` on threshold breach.
- [ ] 1.8.3 (`repos/development-vessel`) Seed
  `signature-validation-failure-detector` activity template
  per §R3.2. Consumes `auditEvent` impulses where
  `operation.kind == "signature_verification"`; emits
  `securityFinding` severity high on sustained failure
  cluster.
- [ ] 1.8.4 (`repos/development-vessel`) All three detector
  templates follow the immunity pattern per §R3.3
  (`inputShapes: []`, structural immunity to the bug class
  they detect). CI check via `scripts/check-shape-dispatch.ts`.

### 1.9 Dry-run resolver path end-to-end

This is the foundational requirement before any autonomous fire.

- [ ] 1.9.1 (`repos/audit-vessel` or new
  `repos/resolution-orchestrator`) Implement the
  `resolutionProposal` emission path. A detector→resolver
  chain that has not earned autonomy SHALL emit only
  `resolutionProposal` per §R4.1. Operator queries the
  proposal stream out of band.
- [ ] 1.9.2 (`repos/audit-vessel`) Implement the
  proposal-then-action sequencing constraint per §R1.3.3. A
  `resolutionAction` emitted without a preceding
  `resolutionProposal` emits a `securityFinding` severity
  high with rationale `"resolver_bypassed_proposal_path"`.
- [ ] 1.9.3 (`repos/audit-vessel`) Implement R6 suspect-firing
  check infrastructure per `§R6.1`: detection of
  operator-deploy-window overlap, recent-rebaseline overlap,
  adversarial-induction pattern match, and foreign-evidence-
  only flag check. The four checks are pluggable; Phase 1
  ships at minimum the operator-deploy-window check (the
  others depend on Phase 3+ machinery and may be stubbed to
  return non-suspect).
- [ ] 1.9.4 (`repos/audit-vessel`) Implement
  `resolutionRefused` emission per §R6.2 when any
  suspect-firing check returns suspect. Wire emission into
  the §27.S.6 push-away ledger (per
  `2026-04-26-impulse-activity-loop/tasks.md §27.S.6`) with
  `source: "observe-detect-resolve"`.

### 1.10 Phase 1 standing-approval allowlist (the four autonomous resolvers)

Each is a resolver activity authored under a long-deadline operator
attestation. The attestation is operator-issued and revocable per
§R4.2.4. Phase 1 ships the four and ships nothing else autonomous.

- [ ] 1.10.1 (`repos/audit-vessel` or
  `repos/resolution-orchestrator`) Author
  `rate-limit-erroring-resolver` per §R4.2.2. Standing
  attestation issued by the operator at deploy time; resolver
  emits `resolutionProposal` then `resolutionAction` under
  the attestation when its R6 suspect-check returns
  non-suspect.
- [ ] 1.10.2 Author `quarantine-malformed-vessel` per §R4.2.2.
  Same pattern; quarantine is a discovery-vessel update
  removing the vessel for window W.
- [ ] 1.10.3 Author `refuse-invalid-peer` per §R4.2.2.
  Network-guardian-side; rejects connections from the named
  peer until next signature-validity success.
- [ ] 1.10.4 Author `reject-overbudget-resolution` per
  §R4.2.2. Local resolver refuses inbound foreign
  `resolutionAction` that exceeds budget; emits the refusal as
  `resolutionAction` itself (the refusal is the state
  change).
- [ ] 1.10.5 (operator) Issue the four standing attestations
  at deploy time. Document the operator's revocation procedure
  (issue an `operatorAction` of kind
  `revoke_standing_attestation`).

### 1.11 Phase 1 verification

- [ ] 1.11.1 Integration test per `§R9.1`: inject an
  `httpRequest` cluster with auth failures; observe finding,
  proposal, autonomous action, and audit chain validation
  end-to-end.
- [ ] 1.11.2 R6 negative test per `§R9.2`: emit
  `operatorAction promote_substrate` immediately before the
  auth-failure cluster; assert the resolver refuses with
  `suspect_basis: "operator_deploy_window"` and no
  `resolutionAction` is emitted.
- [ ] 1.11.3 Container-local key test per `§R9.3`: bootstrap
  fresh workspace; assert identity generated; assert
  audit-chain root signed by derived subkey; destroy and
  re-bootstrap; assert distinct identity.
- [ ] 1.11.4 Trust-roots negative test per `§R9.4`.

---

## Phase 2 (continued) — Observe-detect-resolve autonomy promotion (DEFERRED)

**Gate:** Phase 1 of observe-detect-resolve operational. The four
allowlisted resolvers have run autonomously for the configured
window (suggested 30 days). Phase 2 promotes additional chains from
dry-run to reversible-autonomous per §R5.3.

### 2.4 Promotion mechanism (sketch)

- Implement the per-chain Thompson posterior over
  `resolution_succeeded` / `_reverted` / `_cascaded` /
  `_refused_self` outcomes per §R5.1–§R5.2.
- Implement the §R5.3 promotion gate: N successful
  operator-approved proposals, zero cascades, at-least-one
  operator-audited-sound refusal in window W.
- Implement §R5.6 demotion: one cascade, one operator-revert
  with `unsound_resolution`, or one
  `operatorAction resolver_demote`.
- Wire promotion / demotion as `auditEvent` emissions.

### 2.5 First reversible-autonomous chain (sketch)

- The first chain authored under the promotion path (rather
  than the standing-approval bootstrap) demonstrates the gate
  end-to-end. Candidate authoring is substrate-side post-lift;
  the operator's role is to observe whether the substrate
  authors detectors that earn promotion and to audit refusals.

---

## Phase 3+ (continued) — Observe-detect-resolve deferred

- **Semi-reversible promotion** (§R5.4) — gated on Phase 3+
  federation work. Peer corroboration history requires federated
  peer findings, which require Phase 3's federated discovery and
  H1.
- **Additional guardian-vessels** (§R7.4) — `federation-guardian`,
  `supply-chain-guardian`, `llm-output-guardian`,
  `operator-input-guardian`, `host-guardian`. Authoring is
  substrate-side post-lift per §27.S.5 cooperation agenda.
  Operator does not enumerate the closed set.
- **Irreversible resolver autonomy** (§R4.4) — operator-gated
  through S3. No task list entry; the gate is fleet-scope
  push-away measurement per §27.S.6.

---

## Open questions for operator

- **TODO(operator):** Hard cutover from Helm-based promotion to
  `promote-substrate.sh` (Phase 1 R3 / proposal Phase 1) — date
  or indefinite coexistence?
- **TODO(operator):** Quorum size N for Phase 4 — depends on
  fleet topology and adversary model.
- **TODO(operator):** Whether the Phase 1 image build's signing
  key lives in CI provider's secret store or in a separate
  operator-controlled vault. Either is defensible; CI-store is
  simpler, vault is harder to compromise.
- **TODO(operator):** Promotion thresholds for §R5.3
  (dry-run → reversible-autonomous): N successful proposals and
  window W. The spec suggests N=20, W=30 days; the actual numbers
  depend on the substrate's trace volume and operator's audit
  budget.
- **TODO(operator):** Whether the Phase 1 standing-approval
  attestations are issued per-substrate at bootstrap (operator
  runs `metabob-substrate bootstrap` and the bootstrap binary
  prompts for attestation issuance) or out-of-band via an
  identity-vessel admin endpoint. The former is operator-friendlier
  but bakes the attestation into bootstrap; the latter cleanly
  separates concerns. Either works; this informs Phase 1
  implementation of 1.10.5.
- **TODO(operator):** Whether the audit-vessel's hashchain
  checkpointing strategy (every N events vs. every T seconds vs.
  on substrate-shutdown only) affects the operator's verification
  workflow. Trace-hash-chain explicitly defers compression /
  pruning; the audit chain inherits the same posture for Phase 1
  but the operator should confirm the chain's expected long-run
  growth rate is acceptable on the workspace volume.
