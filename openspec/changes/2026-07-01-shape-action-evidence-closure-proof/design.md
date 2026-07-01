# Design — shape-action-evidence-closure-proof

## Sequencing spine (dependencies force this order)

```
A  expectations doc + doc-drift fold-in            — day 0 (operator, no deps)
C1 finish harness (4 tasks) + BASELINE run          — day 0 (must precede B)
E1 semantic cutover gate + revert hollow patch      — day 0-1 (must precede B)
B  goal-target-shape-inference via substrate gap    — day 1-2
E2 + D1 flag-OFF landings                           — parallel with B (inert)
G1/G2 interaction points + expectation gate         — day 2-4 (parallel with B)
D2/D3 substrate-dispatched seams                    — after B verified
G4 surface self-modification loop                   — after G2 accumulates evidence
C2 + F re-run, evidence table, staggered flag flips — day 5-7
```

Rationale: E1 before B (a hollow landing would poison the proof's first substrate-authored
commit); C1 baseline before B (no before/after otherwise); E2/D1 flag-OFF so B's deltas are
unconfounded; G4 only after G2 produces measured interaction failures.

## Key design decisions

1. **Expectations live in `docs/`, not `openspec/`** — `docs-align-scan.ts` `walkMd()` watches
   `docs/**/*.md` (minus archive), root CLAUDE.md, and vessel CLAUDE/README only. The openspec
   change is change-management; the doc is the machine-visible referent the closure loop verifies.
2. **Fold-in, not supersession banners** (A3) — the reach-judge quotes falsified sentences;
   leaving wrong sentences under a "superseded" banner keeps generating `documentation_drift`
   gaps and burns `doc_drift_fix` cycles.
3. **E1 is the one justified direct-edit exception to substrate-first** — bootstrapping the
   semantic verifier through the unverified authoring path is circular.
4. **The harness is operator-authored** (C1) — don't let the system under test author its own
   ruler mid-experiment.
5. **B's gap metadata is load-bearing** — `gap-to-feature.ts` defaults `target_vessel` to
   development-vessel; omitting it misroutes the patch. `anchor_strings` maximize surgical-op
   hit rate on goal-host's large index.ts. `spec_ref` gives the drafter the full root-caused
   proposal.
6. **G validates the surface by observed behavior, not modeled intent** — expectation scoring
   is in episode/shape space (class signatures, novelty counts); the LLM judge is for ambiguity
   only. Unmet expectation = real failure (verifier_negative-style β). Operator-presence guard:
   expectations score only when the environmental-signature `op` bit was set during the horizon.
7. **The human is the reach gate for surface changes** (G4) — a substrate-authored
   obsidian-vessel change is verified by post-deploy solicitation→response and novelty rates
   vs the pre-deploy window; regression → rollback + β on the authoring path.

## Evidence table (filled at C1 baseline and C2 re-run)

| # | Metric | Query / source | Baseline (pre-B) | Post-B | Floor |
|---|---|---|---|---|---|
| 1 | Target-shape seeding rate | goal-host journal `inferred_target_shapes` ÷ fresh NL dispatches | TBD (structurally 0) | TBD | ≥0.8 |
| 2 | Reach rate / hollow rate | `goal_execution_paths` success grouping; hollow = completed + empty `completion_shapes` | TBD | TBD | +15pts reach |
| 3 | Frontier closure velocity | `learning_mode` frontier size; `shape_closure_demand` queue depth | TBD | TBD | non-increasing while vocab grows |
| 4 | Signature discrimination | `context_thompson_scores` n_obs distribution; kappa spread; selection entropy | TBD | TBD | spread non-flat, entropy ↓ |
| 5 | Coverage-matrix fill | `compare-reports.ts --stratified` cells-below-floor delta | run 1 | run 2 | ≥1 closing cell |
| 6 | Substrate-authored commits | `git log origin/dev` substrate author × mitosis traces × metric delta | — | TBD | ≥1, causally tied |
| 7 | Interaction closure | solicitation→response rate; novel-episode-class rate; `forward_model_strength` trend | TBD | TBD | measured, non-declining, failures recorded |

## Live evidence log (2026-07-01, day 0)

- **B verified live (22:32 + 22:38 UTC):** two NL dispatches of goal_hash `270b97f0` both got
  `inferred_target_shapes: ["code_quality","problem_detection","sourceCodeAnalysis"]` (second
  was a goal_hash cache hit); walk routed to genuine analysis producers via the vessel-resolve
  satisfier. B1/B2 were found already landed (goal-host `f85a6d5`, 2026-06-30) — the umbrella's
  role shifted from driving B to verifying it.
- **Reach gate honest on both:** both walks judged HOLLOW ("sourceCodeAnalysis returned 0 files
  analyzed"), β-penalised `satisfier:sourceCodeAnalysis`, `status=failed` (not hollow-complete).
- **Claim-6 candidate:** the first hollow verdict filed a capability gap; the autonomous loop
  composed, passed the semantic gate (real reachability evidence), and landed
  `c271bb7` ("Substrate Autonomous", 22:33:40 UTC) on origin/dev — 62s from gap to landing.
  Causal-delta measurement pending (the authored resolver's shape is not yet in the inferred
  target vocabulary, so reach on this goal-class hasn't moved yet).
- **Root cause filed as gap** `gap-sourcecodeanalysis-empty-success`: analysis-vessel returns
  success with files_analyzed=0 → hollow producer → sibling-gap churn. Fix = honest empty-result
  failure + path resolution.
- **feature_compose failure modes observed (D1a attempts):** (1) planner invents plausible file
  paths (`src/routes/recommend.ts` ENOENT) — mitigate with explicit `file_facts` in gap metadata;
  (2) `old_string` mismatch editing ~10k-line files — mitigate by restructuring gaps so new logic
  is a `create_file` and anchored edits are minimal insertions at VERBATIM-quoted lines. Both
  attempts rolled back cleanly (no hollow landings — E1 doing its job).

## Risk register

- feature_compose one-shot unreliability (B, D3, G4): anchors + spec_ref; time-boxed fallback; E1 makes failures honest.
- Semantic-gate false negatives: inspect judge `reason` before re-drafting; don't let `failed_attempts` anti-thrash bury B.
- Concurrent-cutover clobbers / stale UNFAVORABLE locks: serialize gaps per vessel; prune stale mitosis state first.
- docker cp `src/src` nesting: use `src/.` → `…/src/` form.
- Obsidian plugin reload (G4): verify 27182 re-registration; keep prior build for rollback.
- Measurement confounds: strict flag discipline; staggered flips with gaps.
- Human-availability confound: `op`-bit guard (decision 6).
- relevance-sink-vessel crash-looping (known): check unit is active before trusting penalty-dependent metrics.
