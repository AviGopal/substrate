# Tasks — shape-action-evidence-closure-proof

## A. Expectations (operator, day 0)
- [x] A1 Umbrella change created (this directory)
- [x] A2 `docs/architecture/SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md` with 7 falsifiable claims
- [x] A3.1 Fold reach-gated reward + `goal_execution_paths` into `SUBSTRATE_AS_MDP.md` (§2 reward, §12.6)
- [x] A3.2 Fold successor features (ψ occupancy, Q_sf blend, migration 149) into `SUBSTRATE_AS_MDP.md` (new §2.2; SF_BLEND opt-in status stated honestly)
- [x] A3.3 Fold D4/D5 cluster pooling + contamination guard into `SUBSTRATE_AS_MDP.md` §4.2 / `SUBSTRATE_AS_DEC.md` §4.1
- [x] A3.4 `SUBSTRATE_AS_DEC.md` §3 verified current; coarsening write path added to §4.1
- [x] A3.5 Close `SUBSTRATE_AS_SOFTWARE.md` §6 admission (marked Resolved 2026-07-01)
- [x] A3.6 Reconcile M7 tasks against landed code (11 ticked with evidence; structural deviations noted; rest left open)
- [x] A3.7 docs-align-scan: DEC/SOFTWARE/EXPECTATIONS zero drift; MDP flagged twice with contradictory rationales (assessed judge noise from stale diff window — claim verified true at goal-host src/index.ts:555; residual recorded)

## C1. Proof instrument + baseline (operator, day 0 — MUST precede B)
- [ ] C1.1 G3.3.1 `optimality_ratio` + closing/stable/regressing flags
- [ ] C1.2 G4.1.2 tier-descent detector (re-check per-task `resolver_tier` hydration first)
- [ ] C1.3 G4.1.3 CI-narrowing detector (`variant_performance_metrics` α+β growth)
- [ ] C1.4 G7.3.1 held-out → `rolling-pool.json` weekly promotion
- [ ] C1.5 Baseline run committed as `validation/baselines/2026-07-01-stratified.json`
- [ ] C1.6 Pre-B seeding/reach/hollow numbers recorded in design.md evidence table

## E1. Semantic cutover gate (operator, day 0-1 — MUST precede B)
> 2026-07-01: E1.1–E1.4 found ALREADY LANDED (prior work: feature-compose.ts gate + c1ab75c
> false-negative fixes; deployed in container; hollow patch absent from host+container;
> 25 unit tests pass in test/resolvers/feature-compose-semantic-gate.test.ts).
- [x] E1.1 `verifyPatchAddressesGap` in feature-compose.ts (reachability facts hard-fail + LLM judge)
- [x] E1.2 Mis-localization writeback (`suspected_real_location`)
- [x] E1.3 Flag `SEMANTIC_CUTOVER_GATE` default ON; unit tests (dead-code → UNFAVORABLE no-LLM; real-caller → judged)
- [x] E1.4 Revert hollow `recordOutcome`/`isNoOpBody` patch in container goal-host copy; restart; verify honest runtime
- [ ] E1.5 Live re-drive: hollow draft rejected OR sound patch lands (exercised by workstream B)

## B. Closure keystone via substrate (day 1-2)
> 2026-07-01: B1/B2 found ALREADY LANDED — goal-host `f85a6d5` (2026-06-30) implements
> `inferGoalTargetShapes` (src/goal-target-inference.ts) + `ffae04f` adds derivation-split
> composition; deployed in container; on origin/dev. Umbrella's B work became verification.
- [x] B1 Implementation exists (landed as goal-host `f85a6d5`, pre-dating this change)
- [x] B2 On `origin/dev` + deployed in container
- [x] B3 Unit tests: test/goal-target-inference.test.ts — 13 pass
- [x] B4 Live verify 2026-07-01 22:32+22:38 UTC: `inferred_target_shapes=["code_quality","problem_detection","sourceCodeAnalysis"]` for goal_hash 270b97f0 (2nd = cache hit); walk routed to genuine analysis producers; reach gate honestly HOLLOW'd shallow output and filed capability gaps
- [ ] B5 Seeding rate ≥0.8 over next ~20 organic dispatches (measure at F)

## E2/D1. Flag-OFF landings (parallel with B)
- [x] E2.1 Found already landed (`applyReputationFactor`, 8 tests pass, flag OFF)
- [x] D1.1 SUBSTRATE-AUTHORED: activity-api `64fd66d` (attempt 4 of the gap-spec crispness ladder) + defect-fix `526a0eb` (operator review found consumed-never-populated map + inverted success predicate; substrate fixed both from the follow-up gap)
- [x] D1.2 SUBSTRATE-AUTHORED: goal-host `0820eff` — picked up AUTONOMOUSLY from the filed gap (never operator-dispatched); repairKey computed + threaded into recommendExcluding; 9 tests pass
- [ ] D1.3 (new) Retry-outcome stamp: version-2 rows are read but never written — gap `gap-repair-signature-retry-outcome-unrecorded` filed (metadata seam through runGoal/ExecuteOptions)

## G. Implicit human-interaction closure (day 2-4, parallel with B)
- [x] G1.1 SUBSTRATE-AUTHORED: obsidian-vessel `82099b4a` (registry + stamping + episode propagation; attempt 2) + call-site fix `febe74e` (imports landed without calls — second consumed-never-populated instance; substrate fixed from follow-up gap). Deployed: plugin rebuilt in-container 23:03 UTC, obsidian-desktop active. Also fixed `sync-obsidian-vessel` Makefile (styles path bug that half-synced stale source).
- [ ] G1.2 dev-vessel: timer-driven episode collector → durable substrate records (privacy unchanged)
- [x] G2.1 SUPERSEDED by design: expectations are implicit in solicitations (G1's registry) — no separate emission needed
- [ ] G2.2 dev-vessel expectation-verify detector — gap `capability-gap-interaction-expectation-verify` filed with full v1 spec (met_novel/met_saturated/unmet/unscored_absent, verdict ledger, unmet→interaction_surface gaps); compose attempt 1 UNFAVORABLE (largest net-new resolver yet), retry next session
- [ ] G2.3 Operator-presence guard (env-signature `op` bit set during horizon, else unscored)
- [ ] G2.4 Calibration against `forward_model_strength` (deviation+met = information)
- [ ] G4.1 `interaction_surface_gap` filing on repeated unmet/flat-novelty solicitation classes
- [ ] G4.2 Substrate authors obsidian-vessel change → sync + restart → 27182 re-registers
- [ ] G4.3 Post-deploy interaction metrics vs pre-deploy baseline = reach gate; regression → rollback + β

## D2/D3. Substrate-dispatched seams (after B verified)
- [ ] D2.1 Info-gain bonus goal/gap dispatched (leaf-only `deltaAlpha_signature = base/(1+n)`)
- [ ] D2.2 Validation: same-goal 20-dispatch probe, drain-sink α growth linear→logarithmic
- [ ] D3.1 `capability-gap-noveltyimpulse` filed (target dev-vessel, `allowed_output_shapes: ["noveltyImpulse"]`)
- [ ] D3.2 Operator wires consumption (`lifecycle:execution:novelty`; learning-mode/boredom read novelty classes)

## C2/F. Measurement & acceptance (day 5-7)
- [ ] F1 Harness re-run vs 2026-07-01 baseline (optimality flags activate)
- [ ] F2 Evidence table filled in design.md (all 7 metrics, before/after)
- [ ] F3 Staggered flips: `CROSS_SIG_REPUTATION_PENALTY=1`, gap, `REPAIR_SIGNATURE_CONSUME=1`, gap
- [ ] F4 docs-align-scan zero drift against expectations doc
- [ ] F5 Archive this change
