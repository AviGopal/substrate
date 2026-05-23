# Capability: zk-trace-attestations

## Definition

H6 is the mechanism by which a signal from outside the substrate's
trust root earns a non-zero **`signal_confidence_weight`** in the
substrate's existing Thompson-aggregated learning loop. Without H6,
foreign signals weight zero (excluded from learning). With H6, the
weight is derived from verification of a zero-knowledge attestation
proving that the foreign signal satisfies a published predicate. The
cryptographic machinery lives inside resolver implementations; the
surface the rest of the substrate sees is the confidence-weight field
on the trace and the attestation impulse that produced it.

This capability spans two attestation surfaces under a single ZK
framework labelled H6:

- **Trace attestations** — a foreign vessel (one operated outside the
  substrate's trust root) may submit an execution trace to the
  substrate's learning loop with `signal_confidence_weight > 0` only
  when the trace carries a zero-knowledge attestation proving that the
  execution conformed to the published contract of the activity
  template it claims to have run. The attestation is verified by
  activity-api before any Thompson posterior update derived from the
  trace.
- **Governance attestations** — authority-update actions, governance
  policy executions, and federation-onboarding compliance reports may
  carry zero-knowledge attestations proving that the action satisfies
  the published governance rules without revealing the per-authority
  votes (G1), the data the rule was applied to (G2), or the trace
  contents that justify the compliance claim (G3). Governance actions
  carry their own confidence weighting expressed via the same field.

Both surfaces share the predicate-family / proof-system / federation-
handshake machinery defined below.

## Relation to the learning loop's existing aggregation

H6 introduces no parallel security subsystem. Each predicate family
binds to an existing learning-loop mechanism:

| Existing mechanism | Confidence axis H6 supplies |
|---|---|
| `Beta(1, 1)` prior on new templates | Prior on new foreign vessels derived from peer trust ancestry; informative prior replaces uniform when H6-trace-attestation is provisioned |
| Stratified failure-mode α/β updates (verifier_negative full β, budget_exhausted half β, etc.) | Additional `attestation_strength` axis on the same stratification table; `signal_confidence_weight` multiplies the per-failure-mode update magnitude |
| Validators-as-activities with self-correcting posteriors | Verifier-vessels are validators; peer-disagreement detection across verifier-vessel implementations produces the same β-on-disagreement signal that validator-dispatch already enforces |
| `improvise_share` rolling-window concentration | `traceContributionQuota` rolling-window concentration per source; same throttle, different axis |
| Composition-chain walking (Phase 18.4) for chain-credit | Hash-chain pointer on AET rows extends the walk with cryptographic linkage; chain-credit propagation unchanged |

H6 is the **confidence-weighting** generalisation of the substrate's
own noisy-signal aggregation. The cryptographic mechanism is the
contribution; the aggregation behaviour is unchanged.

## Properties

The completeness / soundness / zero-knowledge triad applies to ALL six
predicate families defined below (three trace families: executor /
resolver / lifecycle; three governance families: council / policy-
execution / aggregation). For each family, the attestation MUST satisfy:

- **Completeness**: an honest prover (a vessel running an honest
  execution; an authority set producing a rule-conformant AUM; a
  substrate whose trace window genuinely satisfies the invariant set)
  MUST produce an attestation that the corresponding verifier accepts.
- **Soundness**: a dishonest prover (forged trace, forged AUM with
  insufficient signers or non-monotonic sequence, governance action
  whose justifying data fails the published rule, federation-onboarding
  report whose window violates an invariant) MUST NOT produce an
  attestation that the verifier accepts, except with negligible
  probability bounded by the chosen proof system.
- **Zero-knowledge**: the verifier MUST NOT learn anything about the
  hidden witness (foreign vessel inputs and intermediate state for trace
  families; per-authority vote attributions for G1; underlying
  governance-rule input data for G2; trace contents for G3) beyond what
  is publicly stated in the published statement.

## Trace predicate families

Three trace predicate families correspond to the three vessel kinds.
A foreign vessel declares its predicate family in its discovery
registration via the `attestation_required` field; activity-api routes
to the appropriate verifier.

### Executor predicate

**Statement**: there exists an input impulse set I and an
`ExecuteOptions` O such that running activity template T (identified by
its public hash) against I under O yields the output impulse set O' and
trace metadata M recorded in the submitted trace, with budget B
respected and `failure_mode` matching the recorded value.

**Witness**: the full execution tape — inputs, intermediate state,
tool-call results, per-task timing and cost.

**Recommended proof system**: zk-STARK (no trusted setup, large
witnesses tolerated, post-quantum-safe).

### Resolver predicate

**Statement**: there exists an input pointer P such that the resolver's
published `resolve(P)` (identified by its public version hash) yields
the output impulse O recorded in the trace.

**Witness for deterministic resolvers**: the resolver's pure function
evaluation. Trivial circuit.

**Witness for LLM resolvers**: NOT a ZK proof. Instead, a chain of
provider-side signatures (e.g., Anthropic API response signed by
Anthropic) attesting that the recorded output corresponds to a real
LLM call with the recorded prompt hash. ZK over LLM weights is out of
scope.

**Recommended proof system**: Bulletproofs or SNARK for deterministic;
provider signature (not ZK) for LLM.

### Lifecycle predicate

**Statement**: there exists an execution trace E observed via the
public WebSocket channel such that
`assembleTemplateFromExecution(E)` yields the template T submitted
in the activityTemplate_update impulse.

**Witness**: the referenced trace E and the assembly function's
intermediate state.

**Recommended proof system**: Bulletproofs (small circuit).

## Governance predicate families

Three governance predicate families parallel the three trace families.
An authority set, a governance-policy evaluator, or a federation-
onboarding substrate declares its predicate family when emitting the
attestation; the verifying party (identity-vessel for G1, discovery-
vessel or activity-api for G2 depending on action type, the receiving
substrate for G3) routes to the appropriate verifier circuit.

### G1: Council predicate

**Statement**: there exists a subset S of size ≥ k drawn from the
authority set committed to by Merkle root M (the current AUM-log head)
such that every member of S produced a valid signature over AUM payload
P, and P satisfies the documented authority-update rules:

- R-G1.1 — the AUM payload's `prev_aum_hash` matches the verifier's
  current AUM-log tail hash (monotonic sequence).
- R-G1.2 — the AUM payload does not remove the last disablement secret
  pre-image hash from the authority state.
- R-G1.3 — if the AUM modifies the threshold k, the new threshold is
  ≥ the org's configured floor.
- R-G1.4 — every signature in S is a valid signature over P by a key
  whose membership in M's set is proved by the witness.

**Witness**: the individual authority signatures (k of them), each with
a Merkle-path proof of inclusion in M, the AUM payload, and the prior
AUM tail.

**Public statement (verifier sees)**: M, P, k, the verifier's prior AUM
tail hash. The verifier MUST NOT learn which specific authorities in M
signed.

**Recommended proof system**: Semaphore-style zk-SNARK (trusted setup
acceptable for fixed-size authority sets) when the authority set is
large enough that anonymity is meaningful; ring signatures otherwise.

### G2: Policy-execution predicate

**Statement**: there exists data D and an evaluation tape E such that
applying governance policy P (identified by public hash H_P) to D under
the published evaluation semantics produces verdict `ALLOW` for action A
(one of: `promote_to_baseline`, `deprecate_template`, `add_federation_peer`,
`quarantine_variant`, `approve_cross_org_federation`).

- R-G2.1 — H_P resolves to a policy known to the verifier's published
  policy registry; unrecognised policy hashes MUST be rejected.
- R-G2.2 — the evaluation tape E is well-formed under the policy
  language's published operational semantics (no off-circuit steps,
  no oracle calls outside the published witness shape).
- R-G2.3 — the verdict step in E is `ALLOW` for action A; any other
  verdict (DENY, DEFER) MUST cause verification to reject.

**Witness**: the data D (rolling-window stats, peer-policy parameters,
quarantine-trigger metrics, federation-onboarding inputs) and the
evaluation tape E.

**Public statement (verifier sees)**: action A, policy hash H_P, the
ALLOW verdict, and the action's timestamp. The verifier MUST NOT learn
the contents of D beyond what the action descriptor itself necessarily
reveals (e.g., the identity of the variant being promoted is public; the
rolling-window stats that justified the promotion are hidden).

**Recommended proof system**: zk-STARK over the policy circuit. STARKs
are chosen for large witnesses, no trusted setup, and post-quantum
audit-log longevity.

### G3: Aggregation predicate

**Statement**: there exists a set of N traces `{T_1, ..., T_N}` from
substrate S, each carrying a valid H6-trace attestation (executor,
resolver, or lifecycle as appropriate), all bounded within window W,
such that the aggregate satisfies the invariant set Q (identified by
public hash H_Q).

- R-G3.1 — each `T_i` in the witness carries a valid H6-trace
  attestation under the receiving substrate's verifier; un-attested
  traces in the window MUST cause verification to reject.
- R-G3.2 — N is ≥ the floor declared for invariant set Q.
- R-G3.3 — every invariant in Q evaluates to PASS over the aggregate;
  any FAIL MUST cause verification to reject. Q SHALL include at
  minimum:
  - no β explosion beyond the published threshold τ_β,
  - zero `failure_mode = scope_widening` traces in the window,
  - monotonic convergence across declared report emissions,
  - zero admin-scope mutations from substrate-self-initiated paths.
- R-G3.4 — the prover MUST be capable of producing the proof in
  sublinear space relative to N (linear-memory provers do not scale to
  federation-relevant trace volumes; reference: arXiv:2509.05326).

**Witness**: the N traces themselves and the per-invariant evaluation
tape.

**Public statement (verifier sees)**: substrate identity S, window
bounds W, invariant-set hash H_Q, trace count N, PASS verdict. The
verifier MUST NOT learn the contents of any `T_i`.

**Recommended proof system**: sublinear-space zk-STARK.

## Federation handshake

A foreign vessel joins the substrate via:

1. **H2 — pubkey-derived vessel id**. Foreign vessel publishes pubkey
   and signs a registration challenge.
2. **H4 — quorum ratification**. The substrate operator's authority key
   and the foreign vessel's home substrate's authority key co-sign the
   registration.
3. **Predicate-family declaration**. Foreign vessel declares
   `attestation_required: zk_<family>` in its discovery resolver-contract.
4. **Verifier provisioning**. Activity-api loads the verifier circuit
   for the declared family.

## Activity-api integration

Per invocation:

- Trace arrives with `is_foreign: true` and an attached `attestation`
  blob.
- Activity-api routes to the verifier for the foreign vessel's declared
  predicate family.
- On verification success: trace is recorded; Thompson posteriors are
  updated as if the trace were native.
- On verification failure: trace is recorded with `verifier_negative`
  failure mode; posteriors are NOT updated; foreign vessel's H1 trust
  score decrements.
- On missing attestation: trace is rejected at the API surface (4xx);
  no trace is recorded.

## Acceptance

H6 is shipped when, in a federation deployment with at least one
foreign vessel:

1. A reference foreign vessel produces traces accepted by activity-api
   for each of the three predicate families.
2. A red-team forged trace (manually edited to claim a non-existent
   success) is rejected by the verifier with `verifier_negative`.
3. Thompson posteriors derived from accepted foreign traces are
   indistinguishable in distribution from posteriors derived from
   native traces over a benchmark window.
4. The federation handshake (H2 + H4 + H6) completes in ≤30s for a
   freshly-registered foreign vessel.

## Status

Forward-looking. The capability ships in stages per
`tasks.md`. Phase 0 (documentation) lands in the current iteration;
Phases 1–5 are committed to only when federation is on the near-term
roadmap.
