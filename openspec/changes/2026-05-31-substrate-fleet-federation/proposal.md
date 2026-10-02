# Proposal — Substrate Fleet Federation

**Date:** 2026-05-31
**Status:** Draft. Phase 1 (image artifact) is operator-authored and
land-able pre-lift. Phases 2–5 are post-lift siblings of the IAL,
authorable by the lifted substrate per the §27.S.5 federation agenda.
Phase 5 (open federation) is gated on §27.S.6 push-away measurement.
**Relates to:** `2026-04-26-impulse-activity-loop` §27.S.5 (federation
agenda) and §27.S.6 (push-away rubric); `2026-04-26-security-hardening-
findings` H1, H2, H3, H4, H5 (promoted from "forward-looking" to
critical-path here); `2026-05-23-vessel-federation` (the peer-aware
discovery primitive this change builds on); `2026-05-23-substrate-self-
deployment` (substrate-resident git authorship);
`2026-05-23-single-container-substrate` (the artifact this change
hardens into a deployable image); `2026-05-23-zk-trace-attestations`
(adjacent path for foreign-vessel proofs).

## Why now

The single-container substrate (Phase 26) is the unit of deployment.
The vessel-federation change (`2026-05-23-vessel-federation`) ships
the *discovery-layer* mechanism — pubkey-derived vessel ids and
peer-aware `/resolve`. What neither change ships is the **fleet**:

1. **A substrate cannot today be installed on a fresh host without
   developer-laptop steps.** `make -C scripts/substrate substrate-run`
   plus `seed-identity.ts` plus `configure-local.sh` is operator
   discipline, not a deployable artifact. Self-installation
   (substrate authoring its own deployment to a new host) is
   impossible until "substrate" is a thing that can be shipped.
2. **Cross-substrate information flow is undefined.** Vessel-
   federation ships the routing primitive but explicitly stops at
   "the key is comparable" — merging Thompson posteriors, sharing
   traces, ratifying foreign vessels into the local concept graph is
   "future spec" territory. Until those land, two substrates
   reachable to each other still operate as isolated learners.
3. **Adversarial audit between substrates has no scaffolding.** The
   substrate-closure properties (`substrate-closure-properties`) and
   lift-criterion-hardening (`lift-criterion-hardening`) both speak
   to *intra*-substrate adversarial probing — the substrate probing
   its own surfaces. Inter-substrate audit (one substrate
   adversarially probing another) is the structural mechanism by
   which the §27.S.6 push-away rubric scales beyond what one
   substrate can introspect about itself.

This change is the umbrella that turns substrate into a deployable
fleet member, defines how information crosses the substrate boundary
under signed evidence, and stages the path to open federation behind
gates that match the (a)/(b)/(c) adversary-model progression below.

The hardening items H1–H5 from `2026-04-26-security-hardening-
findings`, currently described as "forward-looking" in CLAUDE.md, are
promoted here from "graceful-degradation-acceptable" to
**critical-path** for the corresponding phases. The promotion is
listed explicitly per-phase in §"Phasing" and made testable in the
sibling spec deltas.

## The four requirements

This change introduces four structural capabilities. The first three
are inter-substrate (fleet) capabilities in dependency order; the
fourth is the substrate-internal observation-and-response loop that
makes the first three safe to operate and extends the same model to
arbitrary external surfaces. Per the deliberate non-conventional
framing in §"Observe, detect, resolve" below, this change ships the
LOOP, not just the LOG.

1. **Adversarial cross-substrate audit** — one substrate runs
   activities scoped to probe peer substrates for security and access
   regressions. The auditor's authority is attenuated via signed
   scope attestations (H3); the auditee's selector is protected from
   audit-induced poisoning by an immutable baseline (H5).
2. **Information sharing across the substrate boundary** — cross-
   substrate impulse resolution, traces, and learning signal flow
   under counterparty signatures (H1). The local Thompson posterior
   may update from a foreign trace only if both endpoints signed it.
   The concept graph admits foreign-provenance impulses but tags
   their origin and weights them under a separate confidence prior.
3. **Self-installation onto a new network-accessible host** — the
   substrate authors its own deployment to a fresh host: image pull,
   identity generation, presentation to N existing peers for
   ratification, quorum signature, peer admission. The bootstrap
   sequence runs without an operator on the new host.
4. **Observe, detect, resolve as a substrate-internal loop** —
   detection of intrusions, anomalies, and external-surface threats,
   plus resolution of them, expressed entirely as impulses and
   activities subject to the same Thompson learning and ribosome
   extraction as every other activity. A guardian-vessel pattern
   generalizes the same loop to any external surface (network,
   peers, supply chain, LLM outputs, operator inputs, host OS) under
   a common ingestion vocabulary. The four conventional infosec
   boxes (IDS + IPS + SIEM + SOAR) collapse into one mechanism.
   Phase 1 of this capability ships pre-lift and pre-H1; later
   phases compose with H1–H5 as they land. See
   `specs/observe-detect-resolve/spec.md`.

## Observe, detect, resolve — the LOOP, not just the LOG

The conventional infosec model — IDS logs events, humans read them,
humans act — is the wrong shape for this system. Requirement 4 ships
the **adaptive immune system** alternative: observe → detect →
resolve → learn, with the substrate as both observer and actor. The
operator is a downstream affordance, not the design center.

The structural moves:

- **Detection and resolution are activities**, not a separate
  control plane. They consume ingestion impulses, emit findings
  and resolution impulses, accumulate Thompson posteriors, and are
  extracted into reusable templates by the ribosome. Static
  infosec rules become learned activity chains.
- **Four reversibility tiers** (dry-run, reversible, semi-
  reversible, irreversible) gate the authority required to act.
  Phase 1 ships a small, explicitly enumerated standing-approval
  allowlist of reversible resolvers (rate-limit, quarantine, refuse
  invalid peer, reject overbudget resolution) that fire
  autonomously from day one under operator-issued standing H3
  attestations. Everything else is proposal-only until earned
  autonomy via Thompson promotion (§R5 of the spec).
- **Push-away applied to the substrate's own resolutions** — before
  any firing, the resolver checks whether the detection is suspect
  (operator-induced anomaly during deploy, recent rebaseline,
  adversarial induction, foreign-evidence-only). Suspect firings
  refuse with cited rationale; refusals feed positively into the
  Thompson posterior and into the §27.S.6 push-away ledger. This
  is the S3 push-away rubric applied to the system acting on
  itself.
- **The guardian-vessel pattern** — one vessel per external surface,
  with a common ingestion vocabulary downstream. Phase 1 ships
  `audit-vessel` (internal privileged operations) and
  `network-guardian` (the substrate's own HTTP surface) as
  reference implementations. Substrate-authored guardians for
  additional surfaces (federation, supply chain, LLM output,
  operator input, host OS) follow post-lift per §27.S.5 cooperation
  agenda. The spec describes the pattern; it does not enumerate the
  closed set.
- **Container-local key model** — every substrate generates its own
  Ed25519 identity keypair on first boot under
  `/var/lib/substrate/identity.key` (or the configured workspace
  path); the private half never leaves the container. The audit-
  vessel's hashchain is signed by a deterministically-derived
  subkey of that identity. The only externally-provided key
  material is a trust-roots bundle (peer pubkeys + operator
  attestation pubkeys + fleet authority pubkeys) — authorization-
  only, never secret — provided via env var / mounted file / image
  bake-in. Substrate identity is bound to the workspace, not to
  operator-managed external secrets.

Requirement 4 stitches into the fleet phases at two points: (a) the
audit-vessel's `auditEvent` hashchain composes with H1's two-sided
trace signatures as siblings of the same construction (canonical-
JSON + SHA-256 chain + Ed25519 signature) over different event
classes; (b) the Phase 5 adversarial auditor substrate is a
specialized guardian-vessel whose probes drive detector improvement
on auditees under real adversarial pressure.

## The adversary-model progression

The three requirements are not parallel work. They unlock under
sequential adversary-model gates:

### (a) Trusted-peer audit

All substrates in the fleet are operator-controlled. An "adversarial"
substrate here is a *scoped probe*, not a hostile actor; it exists
because it is structurally easier to author offensive activities
against a separate substrate than against your own (the audit
substrate's traces don't pollute the auditee's posteriors; selector
boundaries are easier to test from outside).

- **Technical requirements:** H1 (two-sided traces) + H2 (pubkey
  identity, via `2026-05-23-vessel-federation`) + H3 (signed scope
  attestations) + H5 (immutable-baseline selector).
- **Phase coverage:** Phases 1–3 of this change. Phase 5 (audit
  substrate) becomes safe once H3 + H5 are operational.
- **What it does not require:** H4 (Tailnet-Lock ratification). All
  fleet members are operator-vouched. No quorum check needed for
  admission.

### (b) Semi-trusted federation

Substrates are operated by different parties, broadly cooperative but
mutually untrusted as code. An auditor on substrate A may be running
a version of `audit-peer` that substrate B has never seen; substrate
B must verify the auditor's authority without trusting substrate A's
build.

- **Technical requirements:** all of (a) + H4 (Tailnet-Lock-equivalent
  quorum ratification) + signed-trace revocation.
- **Phase coverage:** Phase 4 of this change.
- **Gate from (a) → (b):** H4 shipped, revocation tested. Concrete
  and technical.

### (c) Open federation

Anyone can spin up a substrate and peer with anyone. Sybil resistance
and reputation become load-bearing. The substrate must refuse
malicious peers on its own; it cannot rely on operator vouching.

- **Technical requirements:** all of (b) + reputation system + Sybil
  resistance + accumulated push-away evidence.
- **Phase coverage:** out of scope for this change. Captured here as
  the asymptote that the design must not foreclose.
- **Gate from (b) → (c):** **behavioural and measured**, not
  technical. Per `2026-04-26-impulse-activity-loop` §27.S.6, the
  substrate must demonstrate `interventionRefused` impulses with
  sound cited rationale across a sustained adversarial-exposure
  window before the fleet may admit untrusted peers. There is no
  concrete date for (c); it is the operationalization of S3.

The (a)/(b)/(c) progression is the substrate-fleet analog of the
S1 → S2 → S3 lift model. (a) is "operator-supervised cooperation".
(b) is "supervised federation with technical untrust between
parties". (c) is "the fleet exhibits push-away against hostile peers
without operator intervention" — which is exactly the §27.S.6 S3
condition translated to inter-substrate scope.

## Phasing

Phase numbering is independent of and does not extend the IAL phase
sequence (per the IAL's terminal-phase declaration).

### Phase 1 — Substrate image as deployable artifact

Pure packaging work. Requires *none* of H1–H5. Doable pre-lift; the
output unblocks measurement (cold-start time, failure surface,
config drift) before identity-layer work piles on top.

- CI builds a signed substrate image from `scripts/substrate/` (the
  `Makefile` already produces `metabob/substrate:dev`; CI produces
  `metabob/substrate:<git-sha>` and signs it).
- One-command bootstrap on a fresh host. The current developer-
  laptop sequence (`make substrate-run` → `seed-identity.ts` →
  `configure-local.sh`) collapses to `metabob-substrate bootstrap`
  invoked from a single binary or shell script that pulls the
  image and runs the equivalent seed steps inside the container.
- A `promote-substrate.sh` script replaces the existing `repos/
  deployment/scripts/promote-canary-to-production.sh` for substrate-
  hosted vessels. It flips an image tag in a substrate-side systemd
  unit (`scripts/substrate/units/`) rather than templating Helm
  values. Existing Helm-based promotion remains operational for any
  vessel still on the Kubernetes path; the two coexist during the
  transition.
- Identity-vessel keys, JWT secrets, and SurrealDB credentials
  continue to be generated on first run and persisted to
  `workspace/.substrate-secrets` per the current `Makefile`.

Phase 1's success criterion is observability: cold-start time on a
fresh VM under 10 minutes, no operator intervention beyond providing
`ANTHROPIC_API_KEY`.

Phase 1 additionally ships the observe-detect-resolve loop in its
entry form: the audit-vessel (with its hashchain over privileged
operations), the network-guardian (in front of the substrate's HTTP
surface), the three minimum detectors (auth-failure-rate,
malformed-response-rate, signature-validation-failure), the four
standing-approval reversible resolvers (rate-limit, quarantine,
refuse-invalid-peer, reject-overbudget-resolution), and the
container-local key model. This is the LOOP-in-Phase-1 commitment;
the autonomy-promotion mechanism (Phase 2+ of observe-detect-
resolve) and additional guardians (Phase 3+) are deferred.

### Phase 2 — Vessel pubkey identity (H2)

Apply H2 to every vessel that runs inside the substrate, including
the substrate's own discovery-vessel. `vessel_id =
base32(multihash(SHA-256, pubkey))`. Identity-vessel becomes the
attestation authority against the pubkey rather than the operator-
provisioned API key.

This is the H2 work already enumerated in `2026-05-23-vessel-
federation` §1; this change tracks its completion as a Phase 2
gate but does not re-author the requirements. The vessel-federation
spec is authoritative for H2.

### Phase 3 — Federated discovery + two-sided traces (H1)

Combines two siblings:

- **Federated discovery** — each substrate's discovery-vessel learns
  the discovery endpoints of peer substrates. Cross-substrate
  `/resolve` carries reachability annotations and routes under depth
  limit. This is the §C work of `2026-05-23-vessel-federation`;
  the present change adds the **information-flow** layer above it.
- **Two-sided traces (H1)** — Thompson updates derived from cross-
  substrate execution traces require both invoker and invoked
  signatures. concept-db gains a `foreign_provenance: true` flag on
  impulses sourced from a peer substrate; relevance scores from
  foreign-provenance impulses contribute to local Thompson under a
  separate, more conservative prior until peer trust accumulates.

The H1 promotion is the substantive new requirement: today H1 is
"forward-looking, Thompson stays advisory until shipped". Under
fleet federation, Thompson updates that mix local and foreign
traces *must* gate on signature validity. There is no degraded
fallback — an unsigned foreign trace is observability-only and
inadmissible to posterior updates.

### Phase 4 — Quorum ratification (H4) + self-install

A new substrate boots, generates its identity, presents its pubkey
and a registration intent to N existing peers, gathers their
authority signatures, and submits the quorum signature to the
fleet's authority log. Without quorum the new substrate is
reachable but not admitted to learning-signal exchange.

Self-install is the substrate-authored deployment artifact: the
existing substrate writes a configuration manifest for the new
host, dispatches the bootstrap (Phase 1 image plus identity), and
arranges the quorum presentation. The operator role on the new
host is reduced to providing network reachability and an LLM
provider key.

This phase imports H4 in full and consumes H3 (signed scope
attestations) for the bootstrap-authority delegation.

### Phase 5 — Adversarial auditor substrate

A substrate dedicated to adversarial probing of peers. Activities
scoped to probe authentication, scope-narrowing, foreign-trace
acceptance, posterior poisoning, and `interventionRefused`
emission. The auditor's authority is bounded by H3 signed scope
attestations (the auditor presents an attestation with a narrow
audience and a short deadline; the auditee verifies before
serving). The auditee's selector is protected from audit-induced
poisoning by H5 (immutable baseline that the audit cannot move).

The auditor substrate is operator-controlled in adversary model (a)
and may itself be federated under (b). Its findings flow back to
peer substrates as `interventionRefused` and `verifier_negative`
impulses, which contribute to the §27.S.6 push-away signal.

## Success criteria

Per phase:

- **Phase 1** — bootstrap on a fresh VM completes under 10 minutes.
  Three independent operators can bootstrap from the same signed
  image and reach the same `/health` green state. The substrate
  image is reproducible: same git-sha → same image digest.
- **Phase 2** — every vessel registered in the substrate has a
  pubkey-derived `vessel_id`. Vessel-federation §R1 acceptance
  applies.
- **Phase 3** — a substrate that has run for one week with no
  federation peer continues to operate. The same substrate, after
  peering with one other, sees `foreign_provenance` impulses
  arrive, gates Thompson updates on H1 signature validity, and the
  local posterior moves on foreign traces only after the peer's
  trust score crosses threshold.
- **Phase 4** — a new substrate bootstrapped by an existing
  substrate's `self-install` activity reaches a state where its
  registration is quorum-signed by N existing peers without operator
  intervention on the new host beyond network and LLM provider key.
- **Phase 5** — the auditor substrate authors probes for at least
  three distinct attack families (registration spoofing,
  scope-narrowing bypass, foreign-trace poisoning). Probes emit
  `interventionRefused` impulses on auditees when refused with
  cited rationale, and `verifier_negative` impulses when the audit
  succeeds in compromising the auditee. Both categories accumulate
  in the §27.S.6 push-away ledger.

## Out of scope

- **Open federation (adversary model (c)).** Captured as the
  asymptote; gated on §27.S.6 push-away measurement; not specced
  here. The design MUST NOT foreclose (c) — e.g. the federation
  protocol must accommodate Sybil-resistant peer admission as a
  future drop-in — but no Phase 6 is authored.
- **Reputation system / Sybil resistance.** Prerequisite for (c);
  out of scope here for the same reason.
- **Cross-substrate concept-graph merge.** Phase 3 admits foreign
  impulses; it does not merge foreign concept records into the
  local graph as if they were local. Merge semantics, especially
  around concept identity collisions and edge-weight reconciliation,
  belong to a follow-up.
- **Federated Thompson posterior merge.** Phase 3 admits foreign
  *trace evidence* (gated on H1) and updates the local posterior
  from it. Sharing posterior *state* between substrates (so a peer
  can read another's α/β directly) is out of scope; the
  vessel-federation spec is explicit that this requires its own
  treatment.
- **ZK foreign-vessel proofs.** `2026-05-23-zk-trace-attestations`
  is the relevant sibling. Its proofs are stronger than H1's
  signature gate but require more machinery. Phase 3 ships H1; ZK
  is the upgrade path.
- **Multi-substrate self-deployment.** `2026-05-23-substrate-self-
  deployment` is single-substrate. Coordinating a self-deployed
  change across federated substrates (rolling upgrade, gated by
  per-substrate verify-merge-candidate verdicts) is the relevant
  follow-up; out of scope here.
- **Substrate naming / addressing scheme above discovery.** Vessel-
  federation §E is explicit that no `substrate_id` field is added
  above discovery. This change inherits that invariant: peer
  substrates are reached via discovery-vessel pubkeys, never via a
  substrate-level identifier in any upstream vessel.

## Dependencies

- **`2026-05-23-vessel-federation`** — Phase 2 and the discovery-
  layer half of Phase 3 are owned there. This change consumes them
  and adds the information-flow + image-artifact + audit layers.
- **`2026-04-26-security-hardening-findings`** — H1, H2, H3, H4, H5
  are promoted from forward-looking to critical-path for the
  corresponding phases. The security-hardening spec remains
  authoritative for each primitive's cryptographic surface. **H3
  is on the critical path for *all* phases** including Phase 1:
  the Phase 1 standing-approval allowlist for
  observe-detect-resolve (§R4.2.2 of
  `specs/observe-detect-resolve/spec.md`) uses H3-shaped long-
  deadline attestations.
- **`2026-05-23-trace-hash-chain`** — the per-vessel append-only
  trace chain. The audit-vessel's `auditEvent` hashchain (§R2 of
  observe-detect-resolve) is a sibling construction at the
  privileged-operations layer. Both share canonical-JSON + SHA-256
  + Ed25519 surface; the operator may want to factor the
  canonical-JSON encoder into a shared package as the chain types
  multiply.
- **`2026-05-31-substrate-self-audit-meta`** — the lifecycle-driven
  fan-out for the substrate-self-detection family. The Phase 1
  detectors authored under observe-detect-resolve are eligible
  fan-out targets; the audit-vessel's systemd-timer dispatch (§R2.4)
  composes with self-audit-meta's lifecycle-event dispatch.
- **`2026-05-23-substrate-self-deployment`** — Phase 4 self-install
  composes the substrate-authored git + PR + merge mechanisms with
  the bootstrap-on-fresh-host artifact from Phase 1.
- **`2026-05-23-single-container-substrate`** — Phase 1 hardens
  this into a deployable image.
- **`2026-04-26-impulse-activity-loop`** §27.S.5 and §27.S.6 — this
  change is the structural realization of the "Federation" and
  "Security" subsections of the post-lift agenda.

## Capabilities

### New capabilities

- `substrate-image-artifact` — substrate as a signed reproducible
  image; bootstrap-on-fresh-host contract; `promote-substrate.sh`.
  Spec: `specs/substrate-image-artifact/spec.md`.
- `federated-discovery` — peer-substrate discovery contract above
  the vessel-federation discovery layer; cross-substrate impulse
  resolution; foreign-provenance tagging on concept-db.
  Spec: `specs/federated-discovery/spec.md`.
- `two-sided-traces` — counterparty trace signature schema;
  Thompson update gating on signature validity; advisory-vs-
  authoritative trace handling. Spec:
  `specs/two-sided-traces/spec.md`.
- `vessel-pubkey-identity` — tracks the H2 deployment surface
  this change consumes. The vessel-federation spec is
  authoritative; this delta exists so the tasks file can gate
  Phases 3–5 on it without depending on a separate change's task
  status. Spec: `specs/vessel-pubkey-identity/spec.md`.
- `observe-detect-resolve` — the substrate's adaptive-immune-
  system loop: four shape families (ingestion impulses, findings,
  resolution impulses, baselines); the audit-vessel hashchain;
  detector activities under Thompson learning; four reversibility
  tiers with a Phase 1 standing-approval allowlist; the
  autonomy-promotion mechanism; push-away refusal applied to the
  substrate's own resolutions; the guardian-vessel pattern as the
  general external-surface extension mechanism; container-local
  key model with trust-roots bundle. Spec:
  `specs/observe-detect-resolve/spec.md`.

### Modified capabilities

- `vessel-federation` — gains a Phase 3 requirement: cross-
  substrate `/resolve` results carry a `foreign_provenance` hint
  that callers (concept-db, activity-api) MUST honour when
  ingesting downstream impulses.
- IAL §27.S.5 "Federation" subsection — concretizes from a list of
  sibling-spec pointers into the (a)/(b)/(c) progression and the
  phased dependency on H1–H5.
- IAL §27.S.6 — gains the explicit statement that **open
  federation (c) is the operationalization of S3**. The existing
  push-away rubric becomes the gating measurement for opening the
  fleet to untrusted peers.

## TODO(operator)

- Confirm whether `promote-substrate.sh` should fully replace
  `promote-canary-to-production.sh` once all vessels are substrate-
  hosted, or whether the Helm-based promotion path is kept
  indefinitely as a fallback. The proposal currently assumes
  coexistence during transition; a hard cutover date would
  simplify Phase 1's success criterion.
- Confirm the N (quorum size) for Phase 4 ratification. H4 in
  security-hardening leaves this as org policy; for a fleet of
  three operator-controlled substrates a 2-of-3 default is natural,
  but the design must not assume a specific N.
