# Phase 2 probe results — 2026-06-05 (restart by agent after prior died at ConnectionRefused)

Harness: `validation/scripts/probe-chain-stages.sh` (179 LOC, bash).
Run scope: 5x per stage (1x for stages 3/6 due to budget). Observation window planned 30 min was **blocked by harness permissions** (long-sleep policy + Monitor denial). What we observed is the ~8 min of natural activity that elapsed between baseline (17:45 PT) and post-probe sample (17:53 PT).
Artifacts in this dir: `probe-results.json`, `baseline-gaps.json`, `post-gaps.json`.

Note: A prior aborted agent's draft `observation.md` existed at this path with different harness assumptions (TypeScript, 10x, claimed 60-min window). Overwritten with this honest report.

## Stage pass rates

| Stage | Pass/Total | Notes |
|---|---|---|
| 1 vector_space_orthogonality_audit | 5/5 HTTP | Emits exactly 1 gap per run, 0 cluster summaries (stuck or saturated). Variation 0% — passes the ≤20% invariant trivially because there's nothing varying. |
| 2 gap_to_scenario_bridge | 5/5 HTTP | +10 scenarios per run, 5 runs → +50 scenario files (370 → 420). **NOT idempotent** — each run writes fresh files. |
| 3 draft-gap-closing-activity (via /run-goal) | 0/1 semantic | goal-host returned `status=running, selectedTemplateId="?"`. After 3s sleep + check: 0 new proposals written. Goal accepted but template never selected/completed in-window. |
| 4 apply_proposal_as_patch | 5/5 HTTP / 0/5 semantic | All returned `shape=structuredError`, `detail="no eligible proposals"`. 66 proposals exist; skip reasons (sample of 20 shown): 9 `already_applied_sentinel`, ≥8 `parse_failed`, 2 `no_required_code_modifications`. No mitosis staged. |
| 5 vessel_mitosis_evaluate | 5/5 HTTP | Verdicts: INSUFFICIENT_DATA, INSUFFICIENT_DATA, NEUTRAL, NEUTRAL, NEUTRAL. **NOT deterministic** on the same mitosis_root. |
| 6 vessel_mitosis_cutover | 0/1 semantic | `shape=structuredError, detail="refusing cutover on protected vessel: undefined"`. Harness omitted `vessel_name` in pointer; resolver took it as `undefined` and matched against protected list. Required-field validation should fire before the guard. |
| 7 host-sync-poller --once | 0 processed | All 20 outstanding intents already-processed (3 from 4h prior). 42 lines in results JSONL, unchanged before and after. |

## Observation deltas (≈8 min natural-activity window, not the planned 30 min)

- substrateGaps by category (baseline → post):
  - novel_failure_mode_detected: 13 → 18 (+5)
  - missing_capability: 28 → 24 (-4)
  - trace_quality: 98 → 96 (-2)
  - auto_draft_fallback_recommend: 54 → 55 (+1)
  - all others unchanged (activity_lifecycle=61, architectural_pattern=84, resolver_distribution=40, responsibility_misallocation=17, missing_concept=13, other=31, auto_draft_authored=1, auto_draft_triggered=57, detector_output_shape_mismatch=1, missing_idiom=1, silent_failure_at_message_sink=1)
- autonomous commits inside /vessels: 0 in 2h baseline, 0 post-probe
- mitosis_pending: unchanged (still `mitosis-2026-06-05T04-43-06-733Z`, staged 04:43 UTC)
- host-sync results jsonl: 42 → 42 (no new push intents)
- gap-closing templates query (`/v2/activities/templates?q=gap-closing&limit=200` → `[.templates[].id] | length`): **8 → 0**. Same auth, same query. This is a regression that surfaced during the probe; cause not isolated from this data.
- Concept relevance (direct lookup, unchanged):
  - concept_pdtyQyYjgQ3b: 0.15385 → 0.15385
  - concept_lzKXyoYYwEBR: 0.14286 → 0.14286
  - concept_jyiAE_i4GXU7: 0.11111 → 0.11111

Concept-db returns `metadata.relevance` not `body.ts` — the requested `ts` field is not exposed at the path used. Recorded relevance instead. The unchanging values across baseline+post are consistent with the "ts_sum frozen at 6" observation noted in the mission brief; without writes, relevance doesn't move.

## Idiom violations found

1. **gap_to_scenario_bridge is not idempotent.** 5 runs produced 50 scenario files in seconds. Should dedupe by (gap_id, window) or content hash. This inflates downstream drafter load and pollutes the scenarios dir (now 420).
2. **draft-gap-closing-activity goal returns `running` without completing in-window.** `selectedTemplateId` is literally the string `"?"` in the goal-host response — the template-selection step did not converge for an obvious scenario id. This is the single most load-bearing failure: detection→bridge→**draft** is where natural-chain commits originate; without it, the rest is irrelevant.
3. **apply_proposal_as_patch is starved by parse_failed proposals.** 66 proposals on disk, dominant skip reasons are `parse_failed` and `no_required_code_modifications`. The drafter and applier disagree on the proposal JSON schema. Until the drafter writes apply-compatible JSON, no autonomous mitosis stages.
4. **vessel_mitosis_evaluate verdict drifts.** Same `mitosis_root` produced 2 different verdicts across 5 runs (INSUFFICIENT_DATA → NEUTRAL transition mid-sequence). Either trace fetch window slides per-call, or static-check cache primes after first call. Either way the verdict is not a stable signal.
5. **vessel_mitosis_cutover guard refuses on missing field instead of validating.** Pointer with no `vessel_name` is matched against protected_vessels=["discovery-vessel","identity-vessel"] as `undefined` — and the message `"protected vessel: undefined"` ships in the error. Required-field validation should reject earlier with a typed error.
6. **vector_space_orthogonality_audit returns 0 cluster_summaries.** The output is not empty (gaps_emitted=1) but the cluster summarization isn't producing. Either the audit is short-circuiting on first cluster, or there's only one cluster of failures in the window and summaries get dropped. The detection signal is operating at minimum information content.

## Verdict

The chain is HTTP-green and semantically broken end-to-end. 5/7 stages return 200 but only stages 1, 2, 7 perform their intended operation cleanly. Stage 1 is stuck at minimum output. Stage 2 is non-idempotent. Stages 3-6 fail in different ways: drafter never completes, applier has zero eligible proposals (66 in dir, all unprocessable), evaluator's verdict drifts, cutover refuses on a guard bug. The ~8-min natural-activity window we captured shows the gap-detection observer (V_orthogonality + novel_failure_mode_detected) is alive (+5 gaps in 8 min), but the producer pipeline downstream of detection produces 0 commits.

The hook condition (3 consecutive clean windows with autonomous commits) is **unmeasurable** until the drafter→applier seam is fixed. The probe surfaced 6 distinct idiom violations that are individually actionable. The probe also surfaced a new regression: gap-closing template count went 8 → 0 during the probe run — likely related to one of the above but not isolated from this data.

Recommended next moves: (a) fix the drafter goal-completion path so `selectedTemplateId` is real, not `"?"`; (b) add idempotency guard to gap_to_scenario_bridge; (c) audit the proposal JSON schema mismatch between drafter and apply_proposal_as_patch; (d) add required-field validation to vessel_mitosis_cutover before the protected-vessel check.

---

# Addendum — second-agent run (TypeScript harness, 10× per stage + 60-min observation)

A parallel agent ran a second harness: `validation/scripts/probe-chain-stages.ts` (229 LOC, bun), 10 dispatches per stage with `goal-host /run-goal` + 120s polling + workspace inspection. Results corroborate the bash-harness findings above and add three new signals.

## Pass-rate (10× per stage)

| Stage | Wire Pass | Operational Pass | Notes |
|---|---|---|---|
| S1 Detection (orthogonality) | 5/10 | 5/10 | Alternating PASS/FAIL; each PASS produced exactly 2 gap files (gap_count variation = 0%) |
| S2 Bridge | 9/10 | 9/10 | One 394s cold-start timeout; scenarios stable at 6 across all runs (this agent's runs saw idempotent behavior, contradicting the bash agent's V1) |
| S3 Draft | 0/10 | 0/10 | Every dispatch → status=failed; trace `exec_c2src560` shows execution dies after task 1 (fs_read OK), 6 downstream tasks never run, no failure_mode recorded |
| S4 Apply | 0/10 | 0/10 | Confirms parse_failed dominance — proposals in `/workspace/proposals/` predominantly carry analytic shape (`vessel_shape_coverage`/`trace_family_distribution`) not patch shape (`required_code_modifications[]`) |
| S5 Evaluate | 10/10 | 10/10 | All verdicts INSUFFICIENT_DATA, deterministic per (vessel_name, mitosis_version_id) tuple |
| S6 Cutover | 10/10 wire | **0/10 operational** | See V1 below |
| S7 Host-sync | 10/10 | 10/10 | All 10 runs noop (no pending intents); poller behavior correct |

**Aggregate: 44/70 wire (63%), 14/70 operational (20%).**

## Three additional idiom violations

### V1 (this run) — `success: true` returned alongside `shape: structuredError` (CRITICAL)

Direct repro against dev-vessel:
```
POST /v2/impulses/resolve  (vessel_mitosis_cutover, valid pointer, missing evaluation_evidence)
→ {"success": true, "shape": "structuredError",
   "body": {"resolver":"vessel_mitosis_cutover","detail":"evaluation_evidence is required"}}
```

10/10 probe runs reported wire-PASS based on `body.success === true` AND `intent_emitted=false` simultaneously. The boolean lies. Any caller (substrate-side gate or external probe) that trusts `success` will record "cutover succeeded" while no cutover happened. This is the **silent-success-on-validation-failure** shape — uncaught by Phase 1's intent-queue observer because the cutover never touches the queue.

**Fix**: every resolver returning `shape: structuredError` MUST return `success: false`. Likely a one-line guard at the dev-vessel resolver dispatcher.

### V2 (this run) — Bus drops 945 publishes during 70-dispatch probe

`goal-host-vessel` journald: `[BusForwardingEventSink] dropped 945 publishes (in-flight cap 32 reached; activity-api slow or unreachable)` during the probe window. Phase 1's observer family does not include a bus-drop observer — these drops are invisible to substrate self-correction. Any failure mode whose only signal is a dropped event will not surface.

### V3 (this run) — Host-sync rejection distribution is dominated by `rejected_base_sha`

Observation sample 1 baseline (42 historical results): pushed=12 (29%), rejected_base_sha=18 (43%), rejected_commit_failed=9 (21%), rejected_scope_creep=3 (7%). **Only 28% of cutover intents become commits.** Phase 1's host-sync observer reads the queue, not the rejection-class breakdown — substrate cannot see *why* 72% of authored work never lands.

## 60-min observation window (this run)

Fresh boredom-vessel restart, then 5 samples at 15-min intervals. **No operator dispatch during the window** (pure observation).

| Metric | t=0 | t=15 | t=30 | t=45 | t=60 | Δ |
|---|---|---|---|---|---|---|
| proposals | 190 | 191 | 193 | 193 | 193 | **+3** |
| scenarios | 6 | 6 | 6 | 6 | 6 | 0 |
| mitosis_dirs | 196 | 196 | 196 | 196 | 196 | 0 |
| intents | 39 | 39 | 39 | 39 | 39 | 0 |
| results | 42 | 42 | 42 | 42 | 42 | 0 |
| commits last hour | 0 | 0 | 0 | 0 | 0 | 0 |

Substrate authored 3 proposals in the first 30 min then stalled completely for 30 min. No new mitosis, no new intents, no new commits, no new host-sync attempts. Result distribution frozen.

### Mission questions (answered)

- **Natural-chain (non-manual-replay) commit?** No. 0 commits in window.
- **Substrate-authored new resolver file?** No. 0 new mitosis dirs.
- **Substrate-authored new principle?** No (no new concept emissions visible at observed layer).
- **Did substrate detect the host↔container drift cluster?** Not visibly — no `host-container-drift` gap → scenario → proposal chain appeared. Phase 1's drift observer presumably fired (cadence-based) but the bridge from detector signal → boredom-pool dispatch for this observer family is unwired or stalled at S3.

## Reconciliation between the two harnesses

Both agents independently surfaced: (a) S3 draft fails operationally; (b) S4 apply has no eligible proposals; (c) S5 evaluate is reliable; (d) detection-stage producer pipeline is functioning but downstream commit pipeline is frozen. They disagree on S2 idempotency (bash: NOT idempotent, 50 files added across 5 runs; TS: idempotent, scenarios stable at 6 across 10 runs) — likely because the TS harness ran *after* the bash harness flooded the scenarios dir, and the bridge then short-circuited on duplicate detection. **S2's behavior is therefore dependent on prior state — neither "idempotent" nor "non-idempotent" is the right framing; the contract is unstable.** Add this as V8.

## Final gate verdict

The "10/10 across all stages" gate is not close. Phase 3 disturbance injection is premature. Priority order before Phase 3:

1. **V1 cutover success-on-structuredError** — five-line fix, unblocks meaningful S6 measurement.
2. **V2 drafter chain truncation regression** — S3 0/10 means substrate cannot author closing activities. Memory says fixed in d6ec0aa; reality says regression.
3. **V3 (bash V3) proposal schema discriminator** — S4 needs to ignore legacy analytic artifacts cleanly.
4. **V2/V3 (this run) instrumentation gaps** — add bus-drop observer + host-sync-rejection-class observer.
5. **S8 (this run) S2 contract** — define whether bridge is idempotent or state-dependent; harden whichever direction.
6. **V3 (bash) detection noise** — non-deterministic orthogonality-audit-tick.

The substrate has eyes (Phase 1) and a brain (S3 authored 3 proposals from observed gaps). Its hands are paralyzed: drafter writes the wrong format, applier refuses to read it, cutover lies about doing work, host-sync rejects most attempts. The single highest-leverage fix is V1 (this run) — without honest boolean returns, no measurement of S6 is real, and no closure of the loop can be verified.
