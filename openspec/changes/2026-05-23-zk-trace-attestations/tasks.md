# Tasks: ZK-Attested Cross-Vessel Trace Verification (H6)

This change is forward-looking. The tasks below define **the implementation
roadmap** if/when federation is prioritised; none are gated on the substrate
entering lift state today.

## Phase 0 — Documentation alignment (immediate)

- [ ] 0.1 Append H6 to the security-hardening framework's enumeration in
  `openspec/changes/2026-04-26-security-hardening-findings/design.md` and
  `docs/IMPLEMENTATION_FINDINGS_2026_04.md` security section, with
  explicit pre-conditions (H1 + H2 + H4) and a `status: forward-looking`
  flag.
- [ ] 0.2 Append §27.3.d to IAL `tasks.md` Phase 27.3 as a deferred
  post-lift item, citing this spec.
- [ ] 0.3 Cross-link this spec from `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
  §887-907 (implicit vessels / unified execution path) — H6 is what
  closes the post-lift trust boundary that the four-primitive model
  presumes.
- [ ] 0.4 Update CLAUDE.md "Security Hardening (forward-looking)" section
  to add a sixth bullet for H6.

## Phase 1 — Threat-model deepening (gated on federation roadmap)

- [ ] 1.1 Document a concrete adversarial scenario for cross-substrate
  posterior poisoning. Witness: a benchmark execution where a foreign
  vessel falsely claims success to inflate its Thompson α. Measure the
  posterior shift across N invocations.
- [ ] 1.2 Decide the proof-system family per predicate family
  (executor / resolver / lifecycle). Document the choice rubric.
  Candidate libraries: `arkworks`, `risc0` for STARKs; `snarkjs` /
  `gnark` for SNARKs; `dalek-bulletproofs` for Bulletproofs.
- [ ] 1.3 Estimate proof-generation cost and verification cost per
  trace. Trace today is ~1–10 KB; STARK proofs may add 10–100 KB.
  Acceptable budget: verification ≤ 10% of trace-write cost.

## Phase 2 — Reference implementation (gated on Phase 1 close)

- [ ] 2.1 Implement a reference prover library exposing
  `proveExecution(trace, witness) → Proof` for one predicate family
  (likely lifecycle, smallest circuit) inside `ias-executor-ts`.
- [ ] 2.2 Implement the verifier in activity-api as a precondition for
  Thompson posterior writes from `is_foreign: true` vessels.
- [ ] 2.3 Integration test: a foreign vessel running the reference prover
  produces traces accepted by activity-api; a hand-modified (forged)
  trace is rejected.

## Phase 3 — Federation handshake protocol

- [ ] 3.1 Define the H2 + H4 + H6 handshake sequence as a discovery-vessel
  capability advertisement.
- [ ] 3.2 Implement the resolver-contract field `attestation_required`
  with values `none | identity | zk_<predicate_family>`.
- [ ] 3.3 Activity-api's posterior-update path checks the foreign vessel's
  `attestation_required` value and validates the proof accordingly.

## Phase 4 — Extension to executor + resolver families

- [ ] 4.1 Design and implement the executor predicate (largest circuit).
  Likely zk-STARK based.
- [ ] 4.2 Design and implement the resolver predicate for deterministic
  resolvers. For LLM resolvers, integrate provider-signature attestation
  as a degraded substitute.
- [ ] 4.3 Red-team exercise: deliberately forged traces from a foreign
  vessel produce `verifier_negative` and are excluded from learning.

## Phase 5 — Post-lift integration

- [ ] 5.1 IAL `tasks.md` Phase 27.3.d closure criteria met.
  `validation/state/lift-status.json` `blockers["27.3.d"]` cleared.
- [ ] 5.2 Federation roadmap (`openspec/changes/2026-05-23-vessel-federation/`)
  gates its production-readiness on Phase 4 completion.

## Notes

The implementation timeline is open-ended. Phase 0 is the only phase
required to land in the current iteration; it adds documentation
referencing H6 so the security-hardening framework and IAL checklist
acknowledge the post-lift trust boundary.

Phases 1–5 are committed to only when:
- The substrate has entered lift (IAL Phase 27 hand-over complete), and
- A concrete federation use case (multi-customer substrate sharing,
  vendor-supplied vessels in customer substrates, or untrusted compute
  providers) is on the near-term roadmap.

Until then, H6 remains documented intent.

## Phase G — Governance attestations (forward-looking, parallel track)

The governance half of H6 (G1 council / G2 policy-execution / G3
aggregation) runs as a parallel track to the trace half. Phase G0
(documentation) lands in the current iteration; subsequent governance
phases are committed to only when (a) the authority set grows beyond
operator-held mode (c), or (b) the substrate enters lift under a
vessel-held-authority configuration, or (c) a federation deployment
needs G3 onboarding compliance.

### Phase G0 — Governance documentation alignment (immediate)

- [ ] G0.1 Append G1/G2/G3 to the H6 entry in
  `openspec/changes/2026-04-26-security-hardening-findings/design.md`
  (cross-referencing H4 for G1 layering and H5 for G2 layering) and to
  `docs/IMPLEMENTATION_FINDINGS_2026_04.md` security section.
- [ ] G0.2 Append §27.3.i to IAL `tasks.md` Phase 27.3 as a deferred
  post-lift item, citing this spec's governance predicate families.
- [ ] G0.3 Update CLAUDE.md "Security Hardening (forward-looking)"
  section to clarify that H6 covers both trace and governance
  attestations.

### Phase G1 — Council predicate (gated on multi-org authority demand)

- [ ] G1.1 Document a concrete adversarial scenario for vote-disclosure
  attacks on H4 AUM logs (bribery, coercion, defect-early collusion).
  Quantify the threshold at which the explicit per-key log becomes a
  liability vs. an audit aid.
- [ ] G1.2 Decide between Semaphore-style zk-SNARK and ring-signature
  constructions based on expected authority-set size. Document the
  choice rubric.
- [ ] G1.3 Reference implementation: a council-predicate prover that
  produces an attestation for a k-of-n authority signature over an AUM
  payload. Identity-vessel verifier accepts the attestation in place of
  the explicit per-key signature list.
- [ ] G1.4 Red-team: forged AUM with insufficient signers or
  non-monotonic sequence MUST be rejected without disclosing legitimate
  prior signer identities.

### Phase G2 — Policy-execution predicate (gated on H5 expansion)

- [ ] G2.1 Codify the H5 baseline-promotion rule, the
  quarantine-trigger rule, and at least one federation-peering rule as
  policies in a policy language amenable to circuit compilation.
  Publish each policy's hash to the policy registry.
- [ ] G2.2 Reference implementation: a policy-execution prover that
  emits a G2 attestation for a baseline-promotion action. Activity-api
  accepts the attestation in place of the bare AUM-signed promotion
  log entry.
- [ ] G2.3 Red-team: a promotion attempt whose underlying rolling-window
  data fails the published threshold MUST be rejected by the verifier,
  WITHOUT the verifier seeing the underlying window data.

### Phase G3 — Aggregation predicate (gated on federation onboarding)

- [ ] G3.1 Define the federation-onboarding invariant set Q and publish
  its hash. At minimum: τ_β threshold, scope_widening zero count,
  monotonic-convergence-across-reports, zero admin-scope mutations from
  autonomous paths.
- [ ] G3.2 Select a sublinear-space STARK prover implementation
  (reference: arXiv:2509.05326). Prove a substrate's trace window can
  produce a G3 attestation in space sublinear in N.
- [ ] G3.3 Reference implementation: a peer substrate produces a G3
  attestation over its trace window; the receiving substrate's
  discovery-vessel admits the peer based on G3-verifier acceptance
  alone (no trace replay).
- [ ] G3.4 Red-team: a substrate whose window contains a minority of
  invariant-violating traces but claims PASS MUST be rejected by the
  verifier.

### Phase G4 — Post-lift integration

- [ ] G4.1 IAL `tasks.md` Phase 27.3.i closure criteria met if a
  governance domain is active (multi-org authority, vessel-held
  authority, or federation onboarding).
  `validation/state/lift-status.json` `blockers["27.3.i"]` cleared (or
  marked not-applicable if no governance domain is active).
- [ ] G4.2 The federation-readiness roadmap
  (`openspec/changes/2026-05-23-vessel-federation/`) gates its
  production-readiness on G3 when federation onboarding is required to
  proceed without trace replay.
