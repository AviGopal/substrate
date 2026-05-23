# Tasks: LLM-to-Deterministic Distillation

## Phase 1 — Pattern stability scanner

- [ ] 1.1 New activity template `pattern-stability-scanner`.
  Inputs: source resolver id, problem class window. Outputs:
  `distillationCandidate` impulses or no-op.
- [ ] 1.2 Implementation: groups traces by
  `(input_signature, output_signature)` where signatures are
  deterministic hashes of normalized impulse contents. Computes
  cluster stability score = `1 - (output_variance / output_mean)` for
  the dominant cluster within each input signature.
- [ ] 1.3 Threshold τ_stability = 0.85. Cluster size ≥20 traces.
- [ ] 1.4 Run via weekly substrate cron activity in
  `ribosome-vessel`. Per-resolver scan; emits per-pattern
  `distillationCandidate` impulses.
- [ ] 1.5 Output to `validation/state/distillation-candidates.json`
  for operator visibility (read-only; operator does not author).

## Phase 2 — Extract-deterministic-resolver activity

- [ ] 2.1 New activity template `extract-deterministic-resolver`.
  Inputs: a `distillationCandidate` impulse. Outputs:
  `deterministicResolverProposal` impulse.
- [ ] 2.2 Implementation: dispatches LLM resolver (per MAB; likely
  Sonnet or Opus) with a prompt structured around:
  - The candidate's input signature pattern.
  - 5 representative supporting traces (5 sampled at random from
    the pattern's supporting set).
  - Output specification: a JSON resolver definition.
- [ ] 2.3 Output JSON resolver schema:
  ```
  {
    resolver_id: string,
    source_resolver: string,
    problem_class: string,
    matchers: [{ input_signature_pattern, output_template }],
    fallback_to: string  // "<source_resolver>"
  }
  ```
- [ ] 2.4 The extractor itself is an LLM activity. Its Thompson
  α/β is tracked per `(extractor_template, problem_class)`. Future
  versions may be distilled (the recursive case).

## Phase 3 — Validator gate

- [ ] 3.1 New validator-activity `verify-distilled-resolver`. Inputs:
  `deterministicResolverProposal` + held-out 20% of the candidate's
  supporting trace set. Outputs: `validation_result`.
- [ ] 3.2 Runs the proposed resolver against each held-out trace.
  Compares outputs to the LLM resolver's recorded output (semantic
  similarity metric per problem class).
- [ ] 3.3 Accept if accuracy ≥0.95 AND zero LLM calls made by the
  distilled resolver (verifies determinism).
- [ ] 3.4 Failure mode for rejection: `verifier_negative` with
  context indicating accuracy + LLM-call-count.

## Phase 4 — Promotion via substrate-forge

- [ ] 4.1 New activity `distillation-promotion`. Inputs: validated
  `deterministicResolverProposal`. Outputs: `forkPromotion` chain.
- [ ] 4.2 Substrate-forge spawns a fork with the distilled resolver
  registered as a sub-resolver under the source shape. Fork runs
  for 24h with `signal_confidence_weight ≈ 0.7`.
- [ ] 4.3 Fork emits `forkOutcome` comparing α-per-dollar of
  distilled vs source on production-shaped problem classes.
- [ ] 4.4 If `forkOutcome.outcome = success`, promotion proceeds via
  standard `forkPromotion` to the canonical substrate.

## Phase 5 — Distilled resolver registration

- [ ] 5.1 Promoted distilled resolvers live in
  `repos/<source-vessel>/distilled/<problem-class>/<resolver-id>.ts`.
- [ ] 5.2 Substrate-self-deployment (sibling spec) commits the new
  file, opens a PR, merges through substrate CI closure.
- [ ] 5.3 On restart, `<source-vessel>` discovers files under
  `distilled/` and registers them as sub-resolvers via the standard
  discovery advertisement.

## Phase 6 — Reversibility

- [ ] 6.1 Monitor distilled resolver β-rate. A 7-day rolling window
  with β > α + 5 triggers `retire-distilled-resolver` activity.
- [ ] 6.2 Retirement: remove the sub-resolver advertisement; emit a
  `distilledResolverRetired` impulse with the β-rate evidence.
- [ ] 6.3 The retired distilled resolver remains in the repo but
  inactive. Future re-promotion possible if patterns re-stabilize.
- [ ] 6.4 The retirement event is itself a learning signal: the
  `pattern-stability-scanner` adjusts its τ_stability threshold
  for the problem class if retirement is frequent.

## Phase 7 — Distillation report

- [ ] 7.1 New impulse shape `distillationReport`, emitted weekly by
  ribosome-vessel. Body:
  ```
  {
    week_starting,
    candidates_identified,
    candidates_extracted,
    candidates_promoted,
    candidates_retired,
    llm_call_rate_pre_distillation,
    llm_call_rate_post_distillation,
    cost_savings_usd_week,
    cost_savings_usd_cumulative
  }
  ```
- [ ] 7.2 Workbench surfaces the report as a dashboard view.
- [ ] 7.3 Phase 19 reuse-harness adds `distilled_call_share` as
  a column.

## Phase 8 — Self-distillation

- [ ] 8.1 The `pattern-stability-scanner` includes its own
  resolver in the resolvers it scans.
- [ ] 8.2 When the scanner's own traces show stable patterns
  (specific input signatures consistently yielding specific
  `distillationCandidate` outputs), the scanner identifies itself
  as a distillation candidate.
- [ ] 8.3 The same `extract-deterministic-resolver` activity
  extracts a deterministic equivalent. Recursion bottoms out at
  pattern-matching circuitry.
- [ ] 8.4 Self-distillation is an explicit success criterion: at
  least one self-distillation event observed within 12 weeks of
  deployment.

## Phase 9 — IAL integration

- [ ] 9.1 Amend IAL §27.3.g with §27.3.g.10.
- [ ] 9.2 Update CLAUDE.md "Ribosome Pattern" section to describe
  the within-resolver distillation extension.

## Phase 10 — Canary validation

- [ ] 10.1 Baseline: capture pre-distillation LLM call rate +
  total LLM cost over a 7-day window.
- [ ] 10.2 Deploy. Within 4 weeks, first distilled resolver
  promoted.
- [ ] 10.3 At 12 weeks: validate ≥20% of LLM resolver calls
  intercepted by distilled resolvers; ≥40% cost reduction.
- [ ] 10.4 Deliberate-drift test: seed inputs that drift from a
  known distilled pattern. Verify automatic retirement within 7
  days.
