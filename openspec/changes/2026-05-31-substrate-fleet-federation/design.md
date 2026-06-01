# Design — Substrate Fleet Federation

> All foundation references are to
> `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`. The (a)/(b)/(c)
> adversary-model progression and the H1–H5 hardening primitives are
> defined in the proposal (§"The adversary-model progression") and in
> `openspec/changes/2026-04-26-security-hardening-findings/design.md`.
> The discovery-layer half of cross-substrate routing is owned by
> `openspec/changes/2026-05-23-vessel-federation/`; this design picks
> up where that one stops.

The design is organized by phase. Each section terminates with the
acceptance signal for its phase and the cryptographic / data-model
surface it owns. Sections share a single principle: **substrate
remains deployment vocabulary**. From inside any vessel above
discovery, the question "which substrate emitted this impulse?"
never arises as a routing question. It arises only as a
*provenance* annotation, used to weight learning signal — not to
choose endpoints.

---

## §A — Phase 1: substrate image as deployable artifact

### Problem

The substrate today is a development artifact assembled by the
operator's `make`-flow. `scripts/substrate/Makefile` is the source
of truth; `scripts/substrate/units/` holds the systemd unit
definitions; `scripts/substrate/seed-identity.ts` and
`configure-local.sh` provide first-run bootstrap. Reproducing this
on a fresh host requires the operator to clone the super-repo, run
`make`, and execute the seed scripts in order.

This is fine for one developer-laptop substrate. It is structurally
incompatible with three substrate-fleet requirements:

1. **Self-installation.** A substrate cannot author its own
   deployment to a new host if the deployment artifact is "clone
   the super-repo and run Make".
2. **Reproducibility across operators.** Two operators running
   `make` on different hosts produce different image digests. The
   fleet cannot verify "we are running the same substrate" without
   reproducible builds.
3. **Audit substrate distribution.** A Phase 5 audit substrate is
   only useful if it can be deployed identically on multiple hosts
   and run the same probes; otherwise its findings are confounded
   with build differences.

### Construction

A CI pipeline (the operator-controlled GitHub Actions or equivalent)
builds the substrate image from `scripts/substrate/` on every push
to `dev`:

```
metabob/substrate:<git-sha>          # canonical
metabob/substrate:dev                # rolling alias for dev branch
metabob/substrate:<release-tag>      # post-promotion
```

The image is signed with a cosign-equivalent key held by the CI
identity. The signature is verifiable by any host pulling the image
before it is started. The signing key is **not** the same as any
vessel pubkey from H2 — it signs *build provenance*, not vessel
identity.

The bootstrap contract on a fresh host:

```
metabob-substrate bootstrap \
  --image metabob/substrate:<tag> \
  --workspace /var/lib/metabob \
  --anthropic-api-key sk-ant-...
```

This single command:

1. Pulls and verifies the image signature.
2. Generates `workspace/.substrate-secrets` (JWT secret, SurrealDB
   creds, `METABOB_API_KEY`) — identical content schema to today's
   Makefile-generated secrets.
3. Runs `seed-identity.ts` inside the container against the freshly
   started substrate.
4. Runs the equivalent of `configure-local.sh` — points
   `~/.metabob/config.json` at the new substrate's port.

The bootstrap command is itself shipped as a thin shell script or
Bun binary in the image. Bootstrap is idempotent: a second
invocation against an existing workspace reuses the secrets and
re-runs only the steps that require it.

### `promote-substrate.sh`

Today's `repos/deployment/scripts/promote-canary-to-production.sh`
retags Docker images and updates Helm `values.yaml`. For substrate-
hosted vessels (defined by presence in `scripts/substrate/units/`),
this is the wrong mechanism — the systemd units inside the
substrate consume image tags directly.

`promote-substrate.sh` flips the tag in the relevant systemd unit
inside the running substrate (e.g.
`scripts/substrate/units/activity-api.service`'s
`ExecStart=/usr/bin/podman run … metabob/activity-api:<tag>`) and
restarts the unit. The vessel restarts; the substrate as a whole
does not.

The substrate image itself is promoted via the bootstrap path
applied to a new host (Phase 4 self-install), or by operator-driven
re-bootstrap of an existing host. Substrate-image promotion is
structurally different from vessel-image promotion: substrate
images are pulled-by-host; vessel images are pulled-by-substrate-
unit.

The two promotion paths coexist during transition. Helm-based
promotion remains operational for any vessel still on the Kubernetes
path; `promote-substrate.sh` covers substrate-hosted vessels. The
TODO(operator) marker in the proposal asks whether the eventual
state is a hard cutover or indefinite coexistence.

### What Phase 1 does *not* introduce

- No vessel identity changes. Vessels keep their current `vessel_id`
  surface. H2 is Phase 2.
- No cross-substrate routing. The image is a single-substrate
  artifact. Federated discovery is Phase 3.
- No quorum / authority. Operator vouches for substrate authenticity
  by trusting the build signature. H4 is Phase 4.

The acceptance signal: a fresh VM with only Podman / Docker and an
LLM provider key reaches green `/health` in under 10 minutes via
one `bootstrap` invocation, and the resulting image digest matches
across three independent operators on the same git-sha.

---

## §B — Phase 2: vessel pubkey identity (H2)

Owned by `2026-05-23-vessel-federation`. This change tracks the
deployment surface in `specs/vessel-pubkey-identity/spec.md` so the
tasks file can gate Phases 3–5 on H2 completion without coupling to
another change's task list. No new cryptographic surface is
introduced here.

The single property this design relies on: every vessel in the
substrate, including the substrate's own discovery-vessel, has a
`vessel_id = base32(multihash(SHA-256, pubkey))`. Identity-vessel
issues attestations bound to that pubkey rather than to operator-
provisioned API keys.

The reason this is necessary for the fleet (above what vessel-
federation already says): the audit substrate (Phase 5) and the
quorum-signing peers (Phase 4) identify each other by pubkey. There
is no operator-provisioned secret in the cross-substrate handshake.
H2 is therefore not optional for any post-Phase-2 work.

---

## §C — Phase 3: federated discovery + two-sided traces (H1)

### §C.1 Federated discovery is owned by vessel-federation

The discovery-layer fan-out (§C of `2026-05-23-vessel-federation`)
ships `POST /resolve` peer forwarding under depth limit and the
reachability annotations on returned vessel records. This change
inherits that behaviour and does not modify the discovery contract.

What this change adds *above* the discovery contract is the
**information-flow** layer:

- Every cross-substrate resolve that returns an impulse carries a
  `foreign_provenance` annotation on the impulse itself, derived
  from the reachability annotation on the vessel that produced it.
- concept-db consumes `foreign_provenance` and stores it on
  observed-usage records.
- activity-api Thompson update paths read `foreign_provenance`
  before applying α/β deltas: foreign-provenance evidence is gated
  by §C.2 (H1 signature validity); local-provenance evidence flows
  through the existing path unchanged.

### §C.2 Two-sided traces (H1) — the load-bearing piece

The H1 specification in `2026-04-26-security-hardening-findings/
design.md §H1` is authoritative for the cryptographic surface:
invoker and invoked vessels each sign the canonical-form digest of
each `impulse_resolutions[]` row; activity-api stores both views
and gates Thompson posterior updates on signature presence and
match.

This design takes a stance the security-hardening spec leaves
flexible: **for foreign-provenance traces, H1 is mandatory, not
advisory**. Concretely:

| Trace provenance | H1 signature missing | H1 signatures mismatch |
|---|---|---|
| Local (both endpoints in same substrate) | Permitted in log-only mode (legacy); rejected in enforce mode per H1's own flag | Vessel trust score penalty per H1 |
| Foreign (any endpoint in a peer substrate) | **Rejected from posterior updates regardless of mode.** Trace persists as observability-only. | **Both endpoints' trust scores penalized; trace inadmissible to posterior updates.** |

The asymmetry is deliberate. Local-mode log-only H1 exists so an
operator can roll H1 out without breaking the existing single-
substrate substrate. Foreign-mode strict H1 exists because foreign
traces are the attack surface H1 was designed for: a peer
substrate that controls its own invoker signature can lie about its
own success rate, and the local Thompson posterior must not be
moved by an unsigned foreign claim.

### §C.3 concept-db foreign-provenance handling

`concept-db` (per `repos/concept-db/`) today indexes impulses
observed across the substrate and tracks usage co-occurrence. Under
federation, observed-usage records carry a `provenance` field:

```typescript
type ConceptUsage = {
  conceptId: string
  observedAt: number
  // ... existing fields ...
  provenance: {
    local: true
  } | {
    local: false
    peer_vessel_id: string     // pubkey-derived id of the peer
                               // discovery-vessel that surfaced this
    trust_score: number        // from peer's vessel_trust_score, last seen
    h1_signed: boolean         // both endpoints signed the trace
  }
}
```

Relevance scores derived from foreign-provenance usage records
contribute to local Thompson under a **separate, more conservative
prior** until the peer's trust score crosses a threshold. The
mechanism mirrors a Bayesian prior shift: foreign usage adds
evidence, but each foreign datum is worth less than each local
datum, with the discount fading as the peer's signature record
accumulates.

The conservative-prior construction is left to implementation. The
spec requirement is: a posterior fed exclusively by foreign traces
SHALL NOT converge to the same point as a posterior fed by the same
volume of local traces, until the peer's trust score reaches
parity with locally-observed vessels.

### §C.4 Sequencing within Phase 3

- §C.1 (vessel-federation discovery layer) lands first.
- §C.2 (H1) ships alongside or before §C.3. H1 is the gate that
  makes §C.3 safe.
- §C.3 lights up once §C.2 is enforce-mode for foreign traces.

The interlock: a substrate may run §C.1 without §C.2 in a closed
fleet (Phase 1 + §C.1 only) — it sees foreign vessels but discards
their traces from learning. The system is observability-rich and
learning-inert across the boundary. §C.2 plus §C.3 is the moment
foreign evidence starts moving the local posterior.

---

## §D — Phase 4: quorum ratification (H4) + self-install

### §D.1 H4 in this fleet

The H4 design in `security-hardening-findings/design.md §H4` ships
the cryptographic surface: customer-held authority keys cross-sign
peer registrations; the key set evolves as an append-only log every
consumer verifies. This design uses H4 to gate **peer-substrate
admission**, not (only) vessel registration.

A new substrate's bootstrap (§A) produces a substrate-scoped
identity — concretely, the discovery-vessel's pubkey, which is
itself H2-derived. To join the fleet, the new substrate's identity
must be ratified by a quorum of existing peers. Without ratification
the new substrate is reachable for `/resolve` but its impulses
arrive at peers as `foreign_provenance` with no `peer_trust_score`
established; under §C.3's conservative-prior rule, this means
foreign evidence from an unratified peer is effectively
non-contributing to posterior updates.

The quorum check happens at the discovery-vessel layer. The peer
table in each substrate's discovery-vessel (per vessel-federation
§C) gains an `authority_endorsements` field (already present in
vessel-federation's design); H4 turns this from log-only to
enforce-mode. Peers without sufficient endorsements are not added
to the peer set.

### §D.2 Self-install flow

Self-install is the composition of three existing primitives plus
one new piece:

1. **Existing: substrate-self-deployment** — the originating
   substrate has the ability to author commits, open PRs, merge
   them after verify-merge-candidate. Self-install authors a
   *bootstrap manifest* (a small file: target host, target
   image tag, intended peer set) and commits it to a substrate-
   controlled inventory.
2. **New: bootstrap-on-fresh-host primitive (Phase 1)** — the
   `metabob-substrate bootstrap` command. Self-install invokes this
   on the target host via SSH or equivalent.
3. **Existing: vessel-federation peer table** — once the new
   substrate is up, the originating substrate writes the new
   substrate's discovery-vessel pubkey + endpoint into its own peer
   table.
4. **New: quorum-presentation activity** — the originating
   substrate dispatches an activity that requests each of N peers
   to sign an authority endorsement for the new substrate's
   pubkey. The activity collects the signatures, submits them to
   the fleet's authority log, and confirms quorum reached.

The flow is end-to-end substrate-authored. The operator's role on
the target host is reduced to: provide network reachability and an
LLM provider key. (The provider key is not signature material; it
is a runtime dependency for `llm-resolver-vessel`. Operator
provisioning of this key is unavoidable until externally-resolved
LLM credentials are themselves federated, which is well outside
this change's scope.)

### §D.3 Adversary-model gate

§D belongs to adversary model (b). Quorum signatures require H4 to
be operational, and H4's threshold is operator-defined per fleet.
For a three-substrate fleet under one operator (model (a)), the
operator may choose N=1 (any single peer can ratify), effectively
making §D a no-op. For model (b), N≥2 with peers controlled by
different parties is the realistic configuration.

The proposal's TODO(operator) on quorum size lives here.

---

## §E — Phase 5: adversarial auditor substrate

### §E.1 What the auditor is

The auditor is a substrate whose activities are scoped to probe
peer substrates for security regressions. Concretely, it runs:

- `audit-registration-spoofing` — attempts to register a vessel
  under a colliding `vessel_id` against a peer substrate; expects
  H2 challenge verification to refuse.
- `audit-scope-narrowing-bypass` — emits a child-goal with broader
  scope than the parent attestation; expects H3 + CC1 (composition
  scope narrowing) to refuse with `safety_breach`.
- `audit-foreign-trace-poisoning` — submits a trace signed only on
  the invoker side claiming high success rate on a low-volume
  variant; expects H1 (this design's §C.2 enforce path) to admit
  the trace as observability-only and refuse the posterior update.
- `audit-baseline-displacement` — runs many low-success calls
  against a non-baseline variant; expects H5 to keep the baseline
  immutable and auto-regress to it on threshold breach.

Each probe is an activity. Probe success is operator-visible: the
auditee emits `interventionRefused` (probe refused with cited
rationale, expected) or `verifier_negative` (probe succeeded in
compromising the auditee, defect).

### §E.2 Bounded blast radius via H3

The auditor is *adversarial*; the auditee must verify its scope
before serving any request that mutates state. H3 (signed scope
attestations) is the mechanism. The auditor's identity-vessel
issues a scope attestation with:

- `audience: <auditee vessel_id>` — bound to one auditee
- `scope: ["audit:registration", "audit:trace-submission", ...]` —
  enumerated narrow scopes
- `deadline: <unix-ts>` — short, e.g. 1 hour
- signed by the fleet's operator authority

The auditee verifies the attestation on every audit-flavoured
request. Attestation failure rejects the probe at the auditee
boundary — the auditor cannot probe outside its declared scope
even if it tries.

This is the load-bearing reason adversary model (a) needs H3 fully
operational. Without H3, an auditor that drifts (bug, malicious
modification) can run probes beyond its mandate; with H3 the
attestation envelope is the bound.

### §E.3 Bounded selector poisoning via H5

The auditor's probes generate `verifier_negative` traces on the
auditee. Under normal H1 Thompson dynamics these would penalize the
auditee's variant posteriors. For the audit substrate this is
intentional in scope but must not cascade: a buggy auditor that
probes a healthy auditee 10 000 times in an hour must not
displace the auditee's baseline selector.

H5 (immutable-baseline selector with auto-regression) is the
mechanism. The auditee's baseline variant for each resolver family
is signed at promotion time and immutable; Thompson cannot route
around it permanently. Audit-induced posterior drift is bounded by
auto-regression: if the non-baseline variant the audit is probing
crosses the auto-regression failure-rate threshold, selection
returns to the baseline and the auditor's contribution is
neutralized.

### §E.4 Auditor findings flow back as push-away signal

Per §27.S.6, `interventionRefused` is the load-bearing S3 signal.
The auditor substrate's probes are *exactly* "operator-introduced
adversarial probes" in the §27.S.6 framing — but introduced from a
peer substrate rather than from the operator directly. Each refused
probe is a `interventionRefused` impulse on the auditee with cited
rationale (the H1 signature failure, the H3 attestation rejection,
the H5 baseline-protection event). Each successful probe is a
`verifier_negative` impulse — the auditee did not defend.

The §27.S.6 ledger accumulates these. A fleet that has run an
auditor substrate for a sustained window with high `interventionRefused`
ratio and sound cited rationale across diverse probe types is
making concrete progress on the S3 push-away rubric.

---

## §F — Dependency ordering

In strict order, with rationale:

1. **Phase 1 (image artifact)** — no security primitive needed.
   Enables observability of cold-start, bootstrap, and image
   reproducibility before security work piles on. Lowest-risk
   item, highest unblocking value.
2. **Phase 2 (H2)** — pubkey identity. Owned by vessel-federation;
   this change tracks completion. Required by every subsequent
   phase because every cross-substrate identity claim is pubkey-
   bound.
3. **Phase 3 (federated discovery + H1)** — discovery half from
   vessel-federation; H1 half from security-hardening, with this
   change's §C.2 specifying strict-mode for foreign traces.
   Requires Phase 2 because signatures are over pubkey-derived
   identities.
4. **Phase 4 (H4 + self-install)** — quorum ratification.
   Requires Phase 2 (pubkey identities to ratify) and Phase 3
   (federated discovery as the routing layer ratification gates).
   Requires Phase 1 (the image being bootstrapped on a fresh host
   is the Phase 1 artifact).
5. **Phase 5 (audit substrate)** — requires H3 (scope attestations
   to bound blast radius) and H5 (baseline immutability to prevent
   audit-induced selector poisoning). H3 and H5 are owned by
   security-hardening; this change consumes them. H1 + H2 are
   transitive prerequisites via Phase 3.

Phases 1 and 2 may proceed in parallel; Phase 1 has no dependency
on Phase 2 and unblocks measurement work independently.

Phase 3's §C.1 may ship before §C.2 (and does in vessel-federation),
but §C.3 (foreign-provenance impulse handling) must not light up
until §C.2 enforce mode is operational for foreign traces. The
window between "discovery peering live" and "H1 enforce-mode for
foreign traces live" is a window where foreign impulses arrive but
are observability-only.

---

## §G — Interactions with sibling specs

### `2026-05-23-vessel-federation`
Owns the discovery-layer peering primitive. This change adds the
information-flow layer above it (§C.3) and the artifact /
quorum / audit layers around it (§A, §D, §E). The vessel-federation
spec's invariant "no `substrate_id` field above discovery" is
preserved verbatim.

### `2026-04-26-security-hardening-findings`
H1, H2, H3, H4, H5 promoted from forward-looking to critical-path
per phase. The security-hardening spec remains authoritative for
each primitive's cryptographic construction; this change adds
**deployment context** that makes each primitive non-optional for a
specific fleet capability.

### `2026-05-23-substrate-self-deployment`
Self-install (§D.2) composes the substrate-self-deployment
mechanism (commit + PR + merge + restart) with this change's
bootstrap primitive. Self-deployment ships single-substrate; self-
install extends it to a second substrate.

### `2026-05-23-substrate-closure-properties` and `2026-05-23-lift-criterion-hardening`
Both speak to intra-substrate adversarial probing. The Phase 5
audit substrate is the inter-substrate generalization. Findings
from the audit substrate flow into the same §27.S.6 push-away
ledger that these specs already address; the ledger gains a
`source: "audit-substrate"` provenance.

### `2026-05-23-zk-trace-attestations`
ZK trace attestations are the upgrade path for H1's signature
gate — stronger property (proof of correctness, not just proof of
agreement) at higher cost. Phase 3 ships H1; ZK is a future
substitution at the foreign-trace gate without changing the
upstream contract.

### IAL §27.S.5 / §27.S.6
The "Federation" subsection of §27.S.5 currently enumerates
`vessel-federation`, H4, "cross-substrate trace pairing under H1",
and "federation peer-trust adjustment". This change concretizes
those into the (a)/(b)/(c) progression and the phase sequence
above. §27.S.6's push-away rubric becomes the gate for opening the
fleet to adversary model (c) — the operationalization of S3 as
inter-substrate property.

The stitch into the IAL is done in
`openspec/changes/2026-04-26-impulse-activity-loop/tasks.md`
§27.S.5 and §27.S.6 (the canonical location for those sections) and
in a small forward-pointing subsection of
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` near the
post-lift discussion.

---

## §H — Conventional security posture as adaptive immune system

The fleet-federation work above tracks H1–H5 as critical-path
primitives for cross-substrate trust. This section reframes the
broader question those primitives serve: what is the substrate's
posture toward intrusion, anomaly, and external-surface threats? The
spec delta `specs/observe-detect-resolve/spec.md` carries the
normative requirements; this section is the design rationale.

### §H.1 The reframe — observe, detect, resolve as activities

Conventional infosec ships four boxes: an IDS that logs events, a
SIEM that aggregates them, a SOAR that automates response, and an
IPS that may block in line. Humans sit at the SIEM and read; humans
configure the SOAR and the IPS. The mental model is "the system
emits signal; the operator interprets and acts."

This is the wrong shape for a substrate whose purpose is to lift the
operator out of the loop. The substrate-native model collapses the
four boxes into one mechanism: **detection and resolution are
activities**. They consume impulses, emit impulses, accumulate
Thompson posteriors, and are extracted into reusable templates by
the ribosome. There is no separate detection plane.

The structural consequence is that static infosec rules become
learned activity chains. Where a conventional IDS has rule
`pattern → alert` hardcoded, the substrate has detector activity
`pattern → securityFinding` whose precision/recall posterior is
learned from its outcomes (operator-approved proposals,
operator-reverted actions, peer-corroborated findings, refused
firings under suspect-firing checks). The Thompson Sampling that
governs activity selection elsewhere governs detector selection
here. Detection improves over time without explicit re-authoring.

### §H.2 Composition with two-sided traces (H1) — the same mechanism, two views

The §C.2 H1 work is, structurally, the audit mechanism for traces
that span vessels. The audit-vessel's `auditEvent` hashchain (§R2 of
observe-detect-resolve) is the audit mechanism for privileged
operations within a substrate. Both are append-only,
cryptographically chained, externally verifiable records of
something the substrate considered authoritative.

Phase 3's strict-mode-for-foreign-traces (H1) is exactly the audit
property "I did not say what you say I said" applied to learning
signal. The observe-detect-resolve audit-vessel is the same property
applied to authority claims about state changes within the
substrate. The two share construction (RFC 8785 canonical-JSON +
SHA-256 chain links + Ed25519 endorsement) and share threat model
(silent post-hoc rewriting of events that the substrate's
posteriors depend on).

There is no separate audit log for security-relevant events distinct
from the trace store; security-relevant events ARE audit events,
emitted by guardian-vessels and persisted on the audit-vessel's
chain. The conventional "audit log" / "trace log" / "metrics log"
fan-out is one chain per concern at storage, but one shape family
above (the ingestion impulses of §R1.1).

### §H.3 Composition with Thompson Sampling — detectors are activities

Detector templates are subject to the same selection mechanism as
every other activity. A finding is a successful execution of the
detector that produced supporting evidence; a missed intrusion (a
post-hoc operator finding the detector should have caught) is a
`verifier_negative` outcome that updates the detector's posterior
downward. The substrate learns which detectors work without explicit
calibration cycles.

Crucially, the autonomy-promotion mechanism (§R5) is not a separate
control plane. The promotion gate consumes the same outcome impulses
the Thompson selector would consume. The gate adds structure:
demanding ≥ N successful proposals, zero cascades, and at-least-one
push-away refusal within the window. The structure is *additional
to* Thompson, not *parallel to* it; it expresses the operator's
policy "earn autonomy via demonstrated calibration including
demonstrated refusal" in the same evidence vocabulary the Thompson
posterior already speaks.

Post-lift, new detectors are authored by the substrate's own
propose-spec / verify-merge-candidate pipeline along the §27.S.5
security agenda. The Phase 1 detector minimum (auth-failure-rate,
malformed-response-rate, signature-validation-failure) is exactly
the seed set the substrate extends.

### §H.4 Composition with the adversarial auditor (Phase 5)

The Phase 5 audit substrate (this design's §E) authors probes that
test peer substrates' defended boundaries. Under the
observe-detect-resolve framing, the audit substrate is a
specialized guardian-vessel: it observes peer-substrate behavior,
emits ingestion impulses describing what it saw, and lets the
auditee's detector path classify and respond.

The audit substrate's probes drive detector improvement *under real
adversarial pressure*. Detectors that miss audit-injected attacks
take Thompson penalties on the auditee side; detectors that catch
audit-injected attacks accumulate calibration evidence on the
auditee side. The §27.S.6 push-away ledger receives
`interventionRefused` impulses from auditees that correctly refuse
suspect firings under R6 (R6.3 ↔ §E.4).

The auditor itself is subject to the same loop: the auditor's own
resolver chains (probe-dispatch chains) are subject to R4/R5/R6.
An auditor that probes too aggressively, causing legitimate
auditee resolutions to cascade, is itself flagged by detectors at
the auditor substrate. Adversarial-audit-of-the-auditor is the
recursive case; the spec accommodates it by not exempting any
vessel from R7.5's "guardians don't bypass the loop" rule.

### §H.5 The guardian-vessel pattern unifies internal and external observation

`audit-vessel` and `network-guardian` are the two reference
guardian-vessels for Phase 1. The pattern generalizes the
ingestion-impulse vocabulary to any external surface (§R7). Each new
external surface gets one guardian-vessel; downstream the detectors
and resolvers do not need to know the surface specifics. A
`detect-novel-source-ip` detector consumes `httpRequest` ingestion
impulses without caring whether they came from the substrate's own
HTTP surface, a Kubernetes ingress, or a federated peer's
forwarding layer.

This is the same separation-of-concerns principle that makes
"vessels and shapes" work for the rest of the substrate, applied to
the security surface. The guardian-vessel is the resolver-for-
external-surface; the detector is the activity-over-ingestion-
impulses; the resolver-activity is the activity-that-mutates-state.
Three roles, three vessel-shaped abstractions, no special-case
infrastructure.

Post-lift, the substrate is expected to author guardians for
surfaces this design does not enumerate: package-registry advisory
streams, MCP server interactions, host syscall anomalies. The
authoring pattern is identical to authoring any vessel; the §27.S.5
"cooperation / coopting external vessels" agenda subsumes guardian
authorship.

### §H.6 The autonomy-vs-safety tension and the four gates that resolve it

The central tension: autonomous resolution is the substrate's
post-lift mandate, but unbounded autonomous resolution is precisely
how a compromised substrate destroys itself or its operator's
state. Four gates compose to resolve the tension:

1. **Reversibility tiers (§R4)** — the authority required scales
   with the difficulty of undoing the action. Dry-run requires
   nothing; reversible requires standing attestation or earned
   autonomy; semi-reversible requires peer corroboration or narrow
   standing; irreversible requires operator judgment through S3.
2. **Thompson promotion (§R5)** — autonomy is earned per chain
   via accumulated outcomes. New chains cannot leap to high
   autonomy; the promotion path is incremental and dependent on
   demonstrated refusal as well as demonstrated success.
3. **H3 signed scope attestations** — the cryptographic envelope
   that bounds what a chain CAN do even when it has authority to
   fire. A chain attested for `scope: ["rate-limit"]` cannot
   quarantine, even if its autonomy were promoted. H3 is the
   load-bearing primitive for the resolver-authority model; the
   spec's §R4.2.2 standing-approval attestations are H3 in long-
   deadline form.
4. **Push-away refusal (§R6)** — before any firing the chain
   evaluates whether the firing is suspect (operator-induced
   anomaly during deploy, recent rebaseline, adversarial
   induction, foreign-evidence-only). Suspect firings refuse
   with cited rationale; refusals feed positively into the
   Thompson posterior and into the §27.S.6 push-away ledger.

The four gates are independent enough to fail safely. Compromise
one — a forged attestation, a poisoned Thompson posterior, an
unset suspect-firing check — and the other three still constrain
behavior. The conventional security maxim "defense in depth" maps
onto the gates' independence.

### §H.7 Standing-approval bootstrap is non-obvious and deliberate

The natural starting design for autonomous resolution is "propose
only, operator approves each one"; the natural endpoint is "fully
autonomous, learned over time". The spec does NOT start at
propose-only; it ships a small Phase 1 standing-approval allowlist
(§R4.2.2) of four resolvers that fire autonomously from day one
under operator-issued standing attestations.

The rationale: a propose-only Phase 1 imposes operator load
exactly at the moment when the substrate's value-add is supposed to
be operator-load reduction. The four allowlisted resolvers are
narrow, well-understood, reversible, and well-corroborated against
adversary-model (a) — they are exactly the resolutions an operator
would routinely approve. Pre-approving them via standing
attestation is structurally identical to operator-approving each
proposal in turn, except it does not require the operator to be
present.

The standing attestations are revocable (§R4.2.4); revocation
collapses the resolver to dry-run within a tick. The operator
retains ultimate authority; the standing attestation is a
performance optimization over per-firing approval, not a delegation
of authority.

### §H.8 Cross-reference to H1–H5

| Primitive | Role in observe-detect-resolve |
|---|---|
| H1 two-sided traces | Provenance of detector evidence that crosses substrate boundaries; foreign-evidence findings are admissible only under H1 (§R3.5). The audit-vessel chain (§R2) is a sibling construction at the privileged-operations layer. |
| H2 pubkey identity | Guardian-vessels are vessels with H2 identity; `guardian_vessel_id` is a pubkey-derived id; trust-roots bundle (§R8.3) enumerates peer pubkeys. |
| H3 scope attestations | Load-bearing for the resolver-authority model. Phase 1 standing-approval attestations are H3 long-deadline form; Phase 5 audit-substrate probes carry H3 short-deadline attestations. |
| H4 quorum ratification | Peer-corroboration paths (§R5.4 semi-reversible promotion; foreign-evidence findings §R3.5) read H4 endorsement state to weight peer evidence. |
| H5 immutable-baseline selector | Special case of `behaviorBaseline` (§R1.4.2). Audit-induced posterior drift is bounded by H5 (per §E.3); the converse, audit-induced *resolution* drift, is bounded by §R6 push-away. |
| Trace hash chain | Storage-layer immutability for traces. The audit-vessel hashchain is a sibling construction for audit events. Both compose with H1 (per `2026-05-23-trace-hash-chain/proposal.md` §"Modified Capabilities"). |

The promotion of H3 from "forward-looking" to "critical-path" was
already done by Phase 5 (§E.2). This spec delta makes the
critical-path status of H3 also true at Phase 1 (standing
attestations are H3-shaped). H3 is therefore on the critical path
for *all* phases of the loop, not just Phase 5.

---

## §I — Why this isn't substrate routing

The same invariant the vessel-federation spec defends applies here.
No vessel above discovery learns about substrates as routing
targets. Substrate identity surfaces in exactly two places, both
below the discovery boundary:

1. **As a discovery-vessel pubkey** — the substrate's discovery-
   vessel has an H2-derived `vessel_id`. Peers identify substrates
   by their discovery-vessel pubkey, not by a substrate-level name.
2. **As a provenance annotation on cross-substrate impulses** —
   `foreign_provenance.peer_vessel_id` carries the discovery-
   vessel pubkey of the source substrate. Upstream consumers
   (concept-db, activity-api) use this for learning-signal
   weighting, never for routing.

A future feature that needs operator-readable substrate names
(e.g. operator logs say "audit-east probed prod-west") derives
the name client-side from a substrate-name → discovery-vessel-
pubkey map maintained by the operator. The map is not part of any
vessel's runtime contract.
