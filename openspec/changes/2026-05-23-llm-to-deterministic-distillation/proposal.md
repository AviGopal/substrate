# Proposal: LLM-to-Deterministic Distillation

## Why

The substrate's deepest cost-reduction lever is replacing expensive LLM
calls with cheap deterministic ones. The ribosome pattern already does
this *between activity templates* — extracting reusable templates from
successful execution patterns. This change extends ribosome to operate
*within* resolvers: when an LLM resolver consistently produces
semantically-equivalent outputs for inputs sharing a stable signature,
the ribosome extracts a **deterministic equivalent** and Thompson-
ranks it as a sibling resolver under the same shape.

Under cost-weighted Thompson (sibling spec), the distilled
deterministic resolver dominates the LLM resolver on routine inputs
because its cost is ~0 USD; the LLM resolver continues to be selected
for novel inputs that don't match any distilled pattern. Over time,
the LLM call rate strictly decreases as patterns are extracted. This
is the substrate's own **cost-reduction loop**: each iteration the
substrate gets cheaper to run, freeing budget for novel exploration.

This is also the most foundational of the post-lift acceleration
mechanisms because it directly demonstrates the substrate developing
itself: the substrate observes its own behaviour, identifies cost-
reducing patterns, and refactors its own resolver set. Each successful
distillation is evidence of substrate self-improvement.

## Self-application

Distillation is itself an activity catalog and resolver set, subject
to the same conditions as every other learning mechanism:

- **Foundation alignment** — distillation extracts deterministic
  resolvers from observed LLM resolver behaviour. The extraction is
  itself a ribosome pattern; ribosome is a four-primitive operation.
- **Closure** — distillation runs as a substrate-resident activity in
  `ribosome-vessel` (the existing lifecycle vessel from
  substrate-explicit-vessels). Operator does not author distilled
  resolvers; they are substrate-authored.
- **Confidence weighting** — distilled resolvers start with α
  inherited from the LLM resolver they replace, scaled by the
  distillation's `signal_confidence_weight` (computed from pattern-
  match stability across the sampled trace window).
- **Cost weighting** — the substrate Thompson-ranks distilled
  resolvers against their LLM ancestors. Cost-weighted sampling
  almost always picks the distilled resolver on matched inputs
  because its cost is near-zero; on unmatched inputs, the LLM
  resolver wins because the distilled resolver returns
  `no_match`.
- **The distillation extractor is itself distillable** — the
  `extract-deterministic-resolver` activity is an LLM activity (it
  uses an LLM to identify input/output patterns and synthesize the
  deterministic equivalent). As distillation accumulates evidence on
  the extractor's own behavior across pattern classes, the extractor
  itself can be partially distilled into deterministic-pattern
  recognition + selective LLM dispatch. The recursion bottoms out at
  a primitive pattern-matching circuit, which is the natural floor.
- **Reversibility** — a distilled resolver that accumulates β faster
  than its LLM ancestor (signal of pattern drift or input space
  evolution) is rolled back. Roll-back is itself an activity
  (`retire-distilled-resolver`) and a normal lifecycle event.

## What Changes

1. **Pattern stability detection**: a new `pattern-stability-scanner`
   activity runs over the trace store for each LLM resolver. For each
   `(resolver, problem_class)` pair, it identifies inputs sharing a
   stable signature (hash of normalized input impulse contents +
   shape) whose outputs cluster tightly (small output-variance under
   the resolver's domain similarity metric).
2. **Candidate extraction**: when a pattern shows stability above
   threshold τ_stability = 0.85 across ≥20 traces, scanner emits a
   `distillationCandidate` impulse. Body
   `{ candidate_id, source_resolver, problem_class, input_signature_pattern, output_pattern, n_supporting_traces, stability_score }`.
3. **Extract-deterministic-resolver activity**: dispatches an LLM
   resolver (Sonnet or Opus per MAB) to:
   - Analyze the supporting traces.
   - Synthesize a deterministic resolver implementation as JSON
     describing input-pattern → output-pattern matching rules.
   - Emit a `deterministicResolverProposal` impulse.
4. **Validator gate**: a `verify-distilled-resolver` validator-activity
   runs the proposed deterministic resolver against a held-out 20% of
   traces. If accuracy ≥0.95 and cost ≥0 (i.e., the proposal is
   actually deterministic), the validator's verdict is positive.
5. **Promotion via substrate-forge**: a `distillation-promotion`
   activity uses `substrate-forge-vessel` to spawn a fork with the
   distilled resolver registered as a sibling sub-resolver under the
   source shape. Fork runs evaluation; outcome compared against
   canonical. Promotion via standard `forkPromotion` flow.
6. **Distilled resolver registration**: distilled resolvers live in a
   `repos/<source-resolver>-distilled/` directory tree (one per
   source). Each is a small TypeScript file generated by the
   `extract-deterministic-resolver` activity, committed to dev branch
   via the substrate-self-deployment sibling spec.
7. **Reversibility**: a distilled resolver accumulating β > α + 5
   over a 7-day window triggers `retire-distilled-resolver` activity:
   removes the sub-resolver advertisement; LLM resolver resumes full
   routing.
8. **Distillation report**: weekly `distillationReport` impulse with
   per-resolver distillation stats: candidates identified, candidates
   promoted, candidates retired, net LLM-call rate reduction,
   accumulated cost savings.

## Success criteria

1. **Pattern stability scanner operational**: scans all LLM resolvers
   weekly; emits `distillationCandidate` impulses for stable patterns.
2. **First distilled resolver**: at least one
   `deterministicResolverProposal` passes the validator and is
   promoted within 4 weeks of deployment.
3. **Cost reduction measurable**: after 12 weeks of operation, ≥20%
   of all LLM resolver calls are intercepted by distilled
   deterministic resolvers. Average LLM cost per substrate-hour is
   ≥40% lower than pre-distillation baseline.
4. **No accuracy regression**: distilled-resolver-intercepted calls
   show ≥0.95 accuracy against LLM-resolver outputs on held-out
   traces.
5. **Reversibility tested**: at least one distilled resolver is
   automatically retired after deliberately seeded drift (test).
6. **Self-distillation evidence**: at least one pattern in the
   `extract-deterministic-resolver` activity's own trace stream is
   identified as distillation candidate (the extractor distilling
   itself).
7. **Closure**: `closure-audit --without=operator-shell` zero
   failures for distillation pipeline.

## Capabilities

### New Capabilities

- `llm-to-deterministic-distillation` — pattern stability scanner;
  deterministic-resolver extractor activity; validator gate;
  promotion via forge; reversibility via β-rate monitoring; weekly
  distillation report. Spec:
  `specs/llm-to-deterministic-distillation/spec.md`.

### Modified Capabilities

- `ribosome-vessel` (from substrate-explicit-vessels) gains the
  pattern-stability-scanner + extraction activities.
- `cost-weighted-posteriors`: the `distillation_candidates` field in
  `costWeightingReport` is consumed by this spec.
- `llm-resolver-model-mab`: distilled resolvers register as
  sub-resolvers under the existing shape; MAB selection treats them
  as one more arm.
- IAL Phase 27.3.g gains §27.3.g.10: distillation pipeline
  operational; first distilled resolver promoted; cost reduction
  reported.

## Dependencies

- `2026-05-23-substrate-explicit-vessels` (committed) —
  ribosome-vessel must exist.
- `2026-05-23-signal-confidence-weighting` (committed) —
  per-trace confidence weighting.
- `2026-05-23-cost-weighted-posteriors` (sibling) — distilled
  resolvers' value comes from cost-weighted selection.
- `2026-05-23-substrate-forge-vessel` (sibling) — promotion path.
- `2026-05-23-substrate-self-deployment` (sibling) — distilled
  resolvers must commit to dev branch through substrate-resident
  git authorship.

## Out of scope

- **Distillation of non-LLM resolvers**. Deterministic resolvers
  generally don't have a cheaper analog. The cost ceiling is already
  near-zero.
- **Cross-resolver pattern sharing**. Distilled resolvers are per
  source resolver. Patterns shared across resolvers are out of scope
  (federation territory).
- **Online learning of deterministic resolvers**. Distillation is a
  ribosome operation, not an online-update mechanism. The deterministic
  resolver is fixed once promoted; updates happen via re-promotion.
- **Distillation in foreign vessels**. Foreign-vessel distillation is
  an H6 / federation concern.
