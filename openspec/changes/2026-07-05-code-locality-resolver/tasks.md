# Tasks: code-locality resolver

Substrate-first: each slice is dispatched as a goal via `mcp__metabob__run_goal_async`
where feasible (edit-intent goals naming `repos/<vessel>/src/...` route to
feature_compose). Operator fallback only on structurally intractable blockers,
and every fallback ships with the detector that would have caught it.

## 1. Attribution repair (traces record consulted + changed material)
- [ ] 1.1 ias-executor-ts trace sink: populate `outputState.filesModified` /
      `filesCreated` from applied compose ops (stop hardcoding `[]`)
      (`src/adapters/activity-api-trace-sink.ts`)
- [ ] 1.2 ias-executor-ts trace sink: emit `outputState.materialsConsulted`
      (locator strings, `file:<path>`) hoisted from read-resolution outputs
- [ ] 1.3 activity-api: additive migration + schema for `materialsConsulted`
      on executed tasks (null-safe for legacy traces)
- [ ] 1.4 Verify: dispatch one edit-intent goal; its durable trace carries
      non-empty consulted + changed sets (inspect via execution_trace)

## 2. Consolidation tick (mining)
- [ ] 2.1 activity-api: `locality_associations` table (org-scoped PERMISSIONS)
      + `localityAssociation_write` impulse shape
- [ ] 2.2 dev-vessel: `code-locality-mine` resolver mirroring
      trace-failure-pattern-report (read traces → kind_key → locators →
      upsert associations; failure-mode-stratified α/β; fallback locator
      derivation from impulse_resolutions when materialsConsulted absent)
- [ ] 2.3 dev-vessel: seed activity template for the tick; wire into the
      existing boredom/upkeep cadence (no new scheduler)
- [ ] 2.4 Verify: after ≥5 edit-intent traces, associations exist for ≥1
      recurring goal-kind with sane counts

## 3. Cued-recall resolver
- [ ] 3.1 activity-api: `codeLocality` read shape (+ generic `localityRecall`)
      — goal or (target_shapes, goal_type) in → ranked locators + posterior +
      gate out; deterministic tier; advertised via discovery
- [ ] 3.2 Verify: resolve `codeLocality` for a mined kind; response matches
      the association table and reports `gate:"shadow"`

## 4. Shadow mode (apprenticeship)
- [ ] 4.1 goal-host: on edit-intent dispatch, best-effort resolve
      `codeLocality`; write `{kind_key, predicted, gate}` into trace metadata
      (advisory bag — never influences selection)
- [ ] 4.2 mining tick: score predicted ∩ actually-consulted → α on matches,
      mild β on predicted-but-unconsulted-on-reached (superstition decay)
- [ ] 4.3 Verify: shadow predictions accumulate α/β across ≥5 dispatches;
      agreement visible in association rows

## 5. Confidence gate + injection (promotion)
- [ ] 5.1 goal-host: when recall returns `gate:"active"` (mean ≥ 0.7,
      samples ≥ 8), mint recalled materials as first-class impulses into the
      pool pre-drafting; below gate, unchanged deliberate path
- [ ] 5.2 Verify: force a key past the gate (or accumulate naturally); a
      gated dispatch shows injected impulses in input_impulse_ids and reaches

## 6. Blame verification (habit repair)
- [ ] 6.1 Verify: induce `reached:false` on a gated dispatch → relevance-sink
      penalty lands on the recalled impulse ids AND association β increments;
      repeated failure closes the gate (recall reverts to shadow)
- [ ] 6.2 Detector: dev-vessel scan flagging associations whose gate flapped
      open→closed (habit-repair candidates) as substrateGap rows

## 7. Generic-mechanism closure
- [ ] 7.1 Doc: material-agnostic contract (`localityRecall`, locator scheme,
      kind key) in docs/architecture — written as expectation/closure, with
      the second-instantiation test (memoryNote locality possible with zero
      schema change) stated explicitly
