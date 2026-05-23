# Proposal: ZK-Attested Cross-Vessel Trace Verification and Governance (H6)

> **Scope note.** This change covers BOTH cross-vessel trace attestations and
> cross-vessel governance attestations under a single ZK-attestation framework
> labelled H6. The two halves share predicate machinery, proof-system rubric,
> and federation handshake; they differ in what statement is being proved
> (honest execution vs. honest authority action). They are versioned together
> because the post-lift substrate cannot adopt one without the other being
> at least documented as a forward-looking commitment.

## Why

The security-hardening framework (`openspec/changes/2026-04-26-security-hardening-findings/`)
defines five hardenings (H1–H5) plus CC1 to close trust-boundary leaks in the
substrate. H1 (two-sided execution traces) requires both invoker and invoked
vessel to sign a trace so activity-api can pair signatures and gate Thompson
posterior updates on agreement. H3 (EIP-712-style scope attestations) requires
typed, nonced signed claims for delegation chains.

These hardenings work within a **single trust root**: identity-vessel as the
attestation authority. Inside one substrate, that suffices — every vessel
holds an identity-vessel-issued credential, and trace pairing reveals
disagreement.

The framework is silent on the case the next phase forces open:
**cross-substrate vessel federation**. Once vessels federate across trust
boundaries (multi-customer marketplaces, vendor-supplied vessels in customer
substrates, untrusted compute providers running shared resolvers), H1 stops
being load-bearing because the invoked vessel may be operated by an actor
the verifier has no reason to trust. The vessel can sign anything it likes;
the signature only proves identity, not honesty.

This is the ZK-proof shape (`zero-knowledge proof`):

> A protocol by which a prover convinces a verifier that a statement is
> true, without revealing anything beyond the truth of the statement.
> Properties: completeness, soundness, zero-knowledge.

For trace verification, the statement is **"this execution trace was produced
by an honest run of activity template T against inputs satisfying T's
contract, yielding outputs satisfying T's validators, within budget B"**.
The prover (the invoked vessel) produces this proof; the verifier
(activity-api) checks it. The verifier need not see — and crucially cannot
recover — the contents of the inputs, the intermediate state, or the
invoked vessel's internals. Posterior updates are gated on proof validity
rather than trace inspection.

This change introduces ZK trace attestations as **H6** in the
security-hardening framework. Status: **forward-looking**. Today's substrate
runs all vessels under shared trust root; H6 is **not load-bearing** until
federation lands. The change is drafted now because (a) it shapes the
substrate-explicit-vessels design (cross-vessel `VesselDaemon` boundaries
are the future ZK-proof surface), and (b) it gives the IAL Phase 27.3
checklist a deferred-but-documented item rather than leaving the federation
trust story implicit.

## The unifying framing: confidence-weighted posteriors

H6 is **not** a parallel security subsystem grafted onto the substrate.
The learning loop is structurally a noisy-signal aggregation system —
Thompson posteriors weight observations, stratified failure modes
discriminate among outcome types, validators-as-activities self-correct
through their own α/β, "state is a projection over traces" makes the
trace store the single source of truth. **Adversarial inputs are the
worst-case end of the noise distribution the loop already handles for
non-adversarial inputs.**

Each attack surface that motivates H6 is structurally identical to a
challenge the loop already solves; the defense is the existing
mechanism applied at strength. Five mirrors are explicit:

1. **Cold-start exploration ↔ vessel squatting**. New templates use
   `Beta(1, 1)` priors; new foreign vessels would inherit the same
   prior unless H6 supplies a basis for an informative prior derived
   from peer-substrate trust ancestry. Openness to novelty is
   structurally identical to susceptibility to squatting; the
   distinction lies entirely in the prior.
2. **Credit assignment ↔ Thompson reward poisoning**. The substrate
   already stratifies α/β updates by failure-mode (verifier_negative
   full β, budget_exhausted half β, cascading no double-count). H6
   adds one more axis to the same weighting function: confidence
   weight by attestation strength (in-substrate full weight, foreign
   verified full weight, foreign unattested zero weight). The Wang et
   al. pseudo-posterior construction (arXiv:2410.19705) reduces to
   this expression in the system's native vocabulary.
3. **Validator correctness ↔ ZK verifier compromise**. Validators are
   already activities whose Thompson posteriors self-correct under
   downstream-disagreement signal. ZK verifiers are validators in this
   sense: multiple verifier-vessel implementations per predicate
   family, with peer-disagreement detection feeding posteriors, makes
   verifier hardening fall out of the existing loop rather than
   requiring separate machinery.
4. **Improvise-share telemetry ↔ Byzantine population bound**. The
   substrate already tracks rolling-window concentration of action
   sources (`improvise_share` went from 35% to 1.5% per Phase 18
   metrics). Per-source trace-contribution quotas are the same
   measurement applied to provenance instead of novelty; the
   throttling mechanism is the existing rolling-window count.
5. **Trace-projection invariant ↔ audit-log tampering**. The
   substrate's deepest idiom — state is a projection over traces —
   is already the auditability mechanism in principle. Hash-chained
   AET writes plus periodic external Merkle-root anchoring give the
   existing projection cryptographic teeth without changing what the
   projection projects.

The implication: **H6 is the mechanism by which a remote signal earns
a non-zero confidence weight in the existing aggregation**. Without
H6, foreign-vessel signals must weight zero (excluded from learning).
With H6, the weight is determined by attestation strength under the
predicate family the remote vessel commits to.

This reframing dissolves the "new subsystem" worry: H6 contributes
**five small additions** to existing schemas and resolvers, every one
of which lives inside the four-primitive model.

- A `signal_confidence_weight` field on trace writes (today implicitly
  1.0 for in-substrate writes; under H6, derived from attestation
  verification). Sibling change
  `2026-05-23-signal-confidence-weighting` adds this field ahead of
  H6 activation so the substrate has a hook to attach to.
- A `vesselTrustScore` prior used at vessel registration (today
  implicitly `Beta(1, 1)`; under H6, derived from peer trust ancestry).
- A peer-disagreement detector running over verifier-vessel outputs
  (today no verifier-vessel exists; H6 introduces verifier-vessel
  multiplicity from day one).
- A `traceContributionQuota` per source (today no quota enforced;
  H6's federation-admission path uses the same rolling-window
  concentration machinery as `improvise_share`).
- A hash-chain pointer on the AET schema (today none; H6's
  trace-projection auditability extends the existing composition-chain
  walking with cryptographic linkage).

The predicate-family material that follows ("Executor predicate",
"Resolver predicate", "Lifecycle predicate", "Council predicates",
"Policy-execution predicates", "Aggregation predicates") is the
**cryptographic mechanism** by which the confidence weights get
assigned. The cryptographic detail belongs inside resolver
implementations; the surface the rest of the substrate sees is the
confidence-weight field.

## What Changes

This change introduces **no immediate code**. It defines:

1. **The H6 threat model** — what cross-vessel federation breaks, why H1–H5
   do not close it, and where the ZK boundary sits.
2. **The trace-attestation circuit** (informal) — the predicate a vessel
   must prove. Three predicate families covering the three vessel kinds
   (executors, resolvers, lifecycle subscribers).
3. **The proof-system choice rubric** — when to use zk-SNARKs (small proof,
   trusted setup), zk-STARKs (no setup, post-quantum, larger proof), or
   Bulletproofs (range proofs for budget/cost bounds). The rubric is a
   forcing function for the implementation phase, not an implementation.
4. **The federation handshake** — how a foreign vessel registers with
   discovery-vessel and is admitted to the substrate's trace fabric.
   Requires H2 (pubkey-derived vessel id) and H4 (Tailnet-Lock-equivalent
   quorum ratification) as preconditions.
5. **The deferred-but-tracked status** for IAL Phase 27.3. H6 is documented
   on the pre-lift checklist as **post-lift work**; the substrate may enter
   lift without H6 deployed, but the federation roadmap is gated on it.

## Threat model (informal)

**In-substrate (today)**: vessel A invokes vessel B; both sign the trace
(H1); activity-api pairs signatures and updates Thompson posteriors. Trust
root: identity-vessel. Threat: a misbehaving vessel within the substrate
forges a trace to skew posteriors. H1 + H3 close this — the misbehaving
vessel's signature still identifies it; deviation surfaces through
mismatched pairings.

**Cross-substrate federation (tomorrow)**: vessel A in substrate S1 invokes
vessel B operated by a third party. B's signature attests B's identity but
not B's honesty. B can fabricate a successful trace, pocket the credit, and
poison S1's posteriors. Detection requires either (a) replaying B's
execution in S1 (defeats the federation benefit), or (b) ZK proof of honest
execution attached to the trace.

**Why H1 is insufficient cross-substrate**: H1's pairing is "two parties
agree on what they jointly remember". When the parties have aligned
incentives to falsify (e.g., B benefits from being credited; A may benefit
from a partner's success), the pairing is meaningless. ZK adds the third
ingredient: proof of correctness, not just proof of agreement.

## Governance threat model (informal)

H1–H5 protect the *execution* surface inside a single substrate. They are
silent on two governance surfaces that come under load as soon as either
(a) the authority set grows (federation, multi-org councils) or (b) the
substrate is expected to self-govern post-lift:

**Authority-vote disclosure**: H4 records every Authority Update Message
(AUM) as a list of explicit per-key signatures. In a small council (3–5
operator-held keys) this is acceptable — operators trust each other and
audit one another. As the authority set grows (federated substrates,
multi-tenant councils where authorities are themselves vessels) the
identity-revealing log becomes an attack surface: bribery, coercion, and
collusion are all easier when "who voted yes" is on the public log.
Authority-update votes inherit, at the governance layer, the same
preference-revealing failure mode that Thompson-Sampling-bias prevention
(H5) was designed to fix at the selection layer.

**Opaque governance action**: H5 (immutable-baseline selector) gates
promotion-to-baseline behind an authority signature, but the rule the
authority *applied* to data when deciding to promote is opaque. The log
says "authority K signed promotion of variant V at time T"; it does NOT
say "K confirmed that V's rolling-window pass rate exceeded the
documented threshold across N traces with the documented decay function."
Auto-regression similarly produces a quarantine action whose justifying
data is not auditable: a peer substrate accepting traces from a quarantined
vessel has no way to verify the quarantine was warranted under published
policy. Today this is closed by trusting the operator; under federation
or self-governance, the rule itself must be the auditable artifact.

**Federation-time compliance**: a peer substrate onboarding via federation
must demonstrate that *its* learning loop has not been drifting outside
the framework's invariants (no admin-scope mutations from autonomous
paths, monotonic convergence under the published harness, no β explosion
beyond declared thresholds). Replaying its traces is not viable — the
traces contain the peer's proprietary impulse content. ZK aggregation
over a trace window is the natural primitive.

## Predicate families

A vessel kind determines the predicate it must prove:

### Executor vessels (e.g., goal-host-vessel)

Predicate: **"There exists an input impulse set I and a template T such
that running T against I, under the published `ExecuteOptions`, yields the
outputs O recorded in the trace, with `failure_mode = null`, within budget
B."**

Proof witness: the full execution tape (impulse contents, intermediate
state, tool-call results). The verifier sees only O, the trace metadata,
and the proof. zk-STARKs are the natural fit: large execution tapes
benefit from no trusted setup and post-quantum guarantees.

### Resolver vessels (e.g., llm-resolver-vessel)

Predicate: **"There exists an input pointer P such that `resolve(P)` under
the resolver's published version yields the output O recorded in the
trace."**

For deterministic resolvers (local-tools-vessel): proof is straightforward
— pure-function evaluation circuit. For LLM resolvers: proof is harder
because the LLM is non-deterministic. **Open question**: do we attest the
LLM call (witnessed via a model-provider signature, not ZK) or attest a
re-derivable hash of the prompt + the *claim* about the output? The latter
is the realistic path; full ZK over LLM weights is out of reach.

### Lifecycle vessels (e.g., ribosome-vessel)

Predicate: **"There exists an execution trace E observed via the public
WebSocket channel such that `assembleTemplateFromExecution(E)` yields the
template T submitted in the activityTemplate_update impulse."**

Proof is straightforward — pure-function evaluation of the assembly
algorithm over a referenced trace. Bulletproofs may suffice; the circuit
is small.

### Council predicates (governance — G1)

Predicate: **"k of n authorities from the published authority set
(committed to by the AUM-log Merkle root M) signed an AUM payload P, and
P satisfies the documented authority-update rules (no removal of the last
disablement secret, threshold remains ≥ floor, AUM sequence number is
strictly monotonic with the prior accepted AUM)."**

Witness: the individual authority signatures, the secret indices into the
authority set, the AUM payload, the prior AUM tail. The verifier sees:
the authority-set commitment M, the AUM payload, the achievement of
threshold k, and the new AUM sequence number. The verifier does NOT see
which authorities signed.

Recommended construction: Semaphore-style ZK group-membership proof
(zk-SNARK with trusted setup tolerable for a fixed-size authority set)
when the council is large enough that anonymity is meaningful; ring
signatures (no trusted setup; proof size linear in authority-set size)
for small councils that nonetheless want disclosure-resistance.

This predicate REPLACES H4's explicit per-signature counting for orgs
that opt in to anonymous voting. The AUM log still exists and is still
append-only; only the per-vote attribution is hidden.

### Policy-execution predicates (governance — G2)

Predicate: **"governance action A (one of: promote-variant-to-baseline,
deprecate-template, add-federation-peer, quarantine-variant,
approve-cross-org-federation) was authorized because the substrate's
governance policy P (identified by its public hash H_P), applied to
witnessed data D, evaluates to ALLOW."**

Witness: the data D that triggered the action — rolling-window stats for
H5 promotion, federation-peering policy parameters, quarantine-trigger
metrics, etc. — plus the evaluation tape of P over D. The verifier sees:
the action A, the policy hash H_P, the ALLOW verdict, and the action's
timestamp. The verifier does NOT see D.

Recommended construction: zk-STARK over the policy circuit. STARKs are
chosen because policy witnesses can be large (full rolling windows),
because no trusted-setup ceremony is desired for governance code, and
because post-quantum safety matters for long-lived audit logs.

This predicate REPLACES the implicit "operator looked at the data and
decided" pattern AND H5's bare AUM-signed promotion (where the log
records the signature but not the proof that the documented promotion
rule was followed). G2 makes governance actions auditable rule executions
rather than opaque human decisions.

### Aggregation predicates (governance — G3)

Predicate: **"across N traces in window W from substrate S, the aggregate
satisfies the published federation-onboarding invariants Q (identified by
hash H_Q): no β explosion beyond threshold τ_β; no scope_widening failure
mode in the window; monotonic convergence across declared reports; no
admin-scope mutations from substrate-self-initiated paths; trace-count N
above declared floor; reporting honest about its own failure modes via
H6-trace attestations on each trace in W)."**

Witness: the N traces themselves and the invariant-evaluation tape. The
verifier sees: window bounds (W start/end), the invariant-set hash H_Q,
the trace count N, the PASS/FAIL verdict, and the substrate identity S.
The verifier does NOT see trace contents.

Recommended construction: zk-STARK with a sublinear-space prover.
Reference: arXiv:2509.05326 ("Zero-Knowledge Proofs in Sublinear Space").
Linear-memory provers do not scale to gigabyte-scale trace windows; the
sublinear-space construction is what makes federation-onboarding
practical for substrates with non-trivial trace volume.

This predicate is NEW; today's framework has no analogous primitive.
Federation onboarding under H6 uses G3 instead of trace replay.

## Why H6-governance is structurally load-bearing post-lift

IAL Phase 27 (lift) declares: "subsequent topology refinement is
performed by the substrate itself." Phase 27.3 specifies *what* must be
demonstrably autonomous (boredom-vessel, convergence reports, topology
discovery) but does NOT specify *who holds authority keys* after lift.
Two paths are structurally available:

- **Operator-held authority** (H4's default mode (c)): humans remain
  governance authorities even when execution is autonomous. Conservative.
  H6-governance is optional; H4's explicit-signing log is sufficient
  because the authority set is small and operator-trusted.
- **Vessel-held authority** (currently unspecced): vessels themselves
  hold authority keys and vote on governance actions. Necessary for
  federation to scale beyond what humans can sign per-action; necessary
  for a substrate to genuinely self-govern under stable cryptographic
  constraints rather than wait for human authority on every promotion.

Without H6-governance, vessel-held authority means every vessel sees
every other vessel's votes on the AUM log — replicating, at the
governance layer, the same preference-revealing attack surface that H5
was designed to prevent at the selection layer. A learning-vessel that
sees how its peers vote can shape its own behaviour to maximise the
chance of being selected as a baseline; a council member vessel that
sees an emerging vote pattern can defect early to extract concessions.

**H6-governance is what makes vessel-held authority safe.** It is the
missing piece of the post-lift story: without it, lift forces the choice
between (a) keeping operator-held authority indefinitely (which means
the substrate is autonomous in execution but not in governance — a
half-lift) or (b) accepting vessel-held authority over an
identity-revealing AUM log (which is structurally unsafe).

This change therefore frames H6 as: **H6-trace is the cross-substrate
trust boundary primitive; H6-governance is what makes the post-lift
substrate self-governing under cryptographic constraints that operators
set at lift-time and need not re-confirm thereafter.**

## Federation handshake

A foreign vessel joins the substrate's trace fabric via this sequence:

1. **H2 — pubkey identity**: foreign vessel publishes its pubkey-derived
   `vessel_id`; discovery-vessel verifies the registration challenge.
2. **H4 — quorum ratification**: high-risk shape registrations require
   cross-signing from a quorum of authority keys (substrate operator +
   foreign vessel's home substrate).
3. **H6 — ZK attestation contract**: foreign vessel commits to its
   predicate family (executor / resolver / lifecycle) and the proof system
   it will use. Discovery-vessel records this in the resolver contract.
4. **Per-invocation**: activity-api requires a ZK proof attached to every
   trace from a foreign vessel. Proofs are verified before Thompson
   posterior updates. Failure → trace is recorded but excluded from
   learning; vessel's trust score (H1) decrements.

## Acceptance (post-lift)

H6 is considered shipped when:

1. A reference foreign vessel runs in a separate substrate, executes
   activities against the local substrate's goals via federation, and its
   traces produce verifiable ZK proofs.
2. Activity-api's posterior-update path rejects un-attested or
   verification-failed traces from foreign vessels.
3. A red-team exercise (deliberately forged trace from a foreign vessel)
   produces a verifier_negative on the substrate side and is excluded
   from learning.
4. **G1 (council)**: an AUM accepted under the council-predicate path
   advances the AUM log without revealing which authorities signed.
   A red-team exercise — a forged AUM with insufficient signers, or a
   non-monotonic sequence number — is rejected by the verifier without
   the verifier ever learning the signer identities for the legitimate
   AUMs that preceded it.
5. **G2 (policy-execution)**: a baseline-promotion action accepted under
   the policy-execution predicate path produces a verifier-checkable
   proof that the published promotion rule was applied to real rolling-
   window data; an action whose justifying data fails the rule (red-team:
   a promotion attempt below threshold) is rejected by the verifier
   without the verifier seeing the underlying rolling-window data.
6. **G3 (aggregation)**: a peer substrate completes federation onboarding
   by producing a G3 proof over a declared trace window; the verifier
   accepts the proof without seeing trace contents and rejects a forged
   aggregation (red-team: a substrate that claims invariant Q while a
   minority of traces in its window violate Q).

## Status

**This change is forward-looking and not gated on the substrate entering
lift state.** Inclusion in the IAL checklist is as a post-lift item; the
substrate's first lift may proceed without H6 if shared-trust assumptions
hold for all participating vessels.

## Capabilities

### New Capabilities

- `zk-trace-attestations` (this change) — H6 in the security-hardening
  framework. Forward-looking; gated on H1 + H2 + H4 + federation phase.
  Spec: `specs/zk-trace-attestations/spec.md`.

### Modified Capabilities

- Security hardening framework (`openspec/changes/2026-04-26-security-hardening-findings/`)
  is amended to list H6 alongside H1–H5 and CC1, with explicit pre-conditions
  and a post-lift status flag.
- IAL Phase 27.3 (pre-lift readiness checklist) gains §27.3.d (cross-vessel
  trust boundary attestations, **deferred to post-lift**).

## Out of scope

- **Implementation**. This change is a contract and threat model; the
  proof-system selection, circuit design, prover/verifier integration,
  and federation protocol details ship in follow-on changes once
  federation is on the near-term roadmap.
- **ZK over LLM weights**. Treated as out of reach. LLM resolver
  attestation uses provider signatures + content hashing instead.
- **Privacy-preserving impulse-relevance learning**. A related idea —
  federated learning with ZK aggregation, so vessels contribute
  relevance signals without revealing which impulses they processed —
  is noted but is its own design space.
