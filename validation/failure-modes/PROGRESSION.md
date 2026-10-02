# PROGRESSION — Bootstrapping the Autonomous Gap-Closing Loop

Today (2026-05-22), the boredom-operation make-activity loop does not run
autonomously against the failure-mode matrix. This document tracks what we
must do per cycle to bootstrap it, and the explicit signal that tells us we
can stop.

## Stopping Criterion (a.k.a. "we have lift")

We stop manually driving when **all three** hold for **three consecutive
weekly cycles**:

1. `manual_intervention_debt == 0` — no subagent dispatches, no human
   template authoring, no operator-blocked registrations carried forward.
2. `baseline_gap_count` strictly decreases week-over-week.
3. `proposals_by_author.make_activity_autonomous > 0` — at least one
   proposal in that cycle was authored by the system's own make-activity
   meta-activity, not by us.

When `lift_kpi.consecutive_zero_debt_cycles >= 3` and the gap count is still
falling, the progression-driver stamps `LIFT CANDIDATE` in the cycle notes.

## Per-Cycle Workflow (until lift)

Run weekly. Each cycle:

```
1. Run the harness against canary
   bun run validation/scripts/failure-mode-harness.ts \
     --label "cycle-N" \
     --out validation/results/<date>-failure-mode-cycle-N.json

2. Identify gaps. For each remaining_gap in cycle-(N-1):
   - Dispatch an Explore subagent to investigate (if not done)
   - Dispatch a general-purpose subagent to draft an activity template
     into validation/failure-modes/proposals/
   - Each draft increments manual_intervention_debt by 1

3. Operator-action items: walk the proposals/ directory and
   register any "draft" proposals via activityTemplate_update
   (requires admin scope — currently operator-blocked on canary).
   Each operator-blocked proposal contributes 1 to debt.

4. Run the progression-driver
   bun run validation/scripts/progression-driver.ts \
     --report validation/results/<date>-failure-mode-cycle-N.json \
     --cycle N

5. Read cycle-N.json:
   - manual_intervention_debt
   - remaining_gaps
   - lift_kpi.consecutive_zero_debt_cycles
```

## Migration Direction: development-vessel + ias-executor-ts

The autonomous mechanism does NOT belong in minibob. We are migrating
execution away from minibob's embedded templates and toward
**development-vessel** running on **ias-executor-ts** (see
`openspec/changes/2026-05-19-ias-executor-as-canonical-host`).

The development-vessel discipline (from its CLAUDE.md):
1. TypeScript = deterministic resolvers + dispatch only. No business
   decisions in TS. No inline LLM calls.
2. Activities live in activity-api after `bun run cli seed-templates`
   uploads them. Source seed files exist only to be uploaded.
3. LLM is a resolver dispatched from an activity, discovered via
   discovery-vessel.
4. Write-scope only. Variant-first repair via `activity_create_variant`;
   `activityTemplate_update`/`_deprecate` are operator-gated.
5. Shape-dispatch agreement enforced by `bun run lint`.

Concretely, the gap-closing loop will be a NEW seed template added under
`repos/development-vessel/src/seed/draft-gap-closing-activity.ts`. It
chains existing dev-vessel resolvers:

```
activity_fetch  (load scenario fixtures from activity-api)
   ↓
fs_read         (load failure-mode-report.json from disk)
   ↓
fs_read[]       (read each gap's scenario + investigation block)
   ↓
[discovered]    (LLM-tier resolver via discovery, drafts template JSON)
   ↓
fs_write        (write proposal to validation/failure-modes/proposals/)
   ↓
activity_create_variant   (register the drafted template as a candidate
                           variant in activity-api — write-scope OK)
```

When that seed template lands and runs against the harness, its proposals
will carry `authored_by: "make_activity_autonomous"` and the cycle KPI
flips. See `openspec/changes/2026-05-22-failure-mode-autonomous-loop/`
for the formal proposal + tasks.

## Reducing Manual Debt (the real work)

Each item below converts a manual step into an autonomous one. Working in
this order reduces debt fastest:

**(a) Make subagent dispatches autonomous — via development-vessel.**
- Add seed template `draft-gap-closing-activity` under
  `repos/development-vessel/src/seed/` per the chain above.
- Add an LLM-tier resolver advertised by some discoverable vessel
  (likely the existing conversation-vessel, repos/conversation-vessel)
  so step 4 of the chain has something to dispatch to.
- Wire `bun run cli seed-templates` to upload the new template, then
  `activity_fetch` it from the failure-mode harness or a scheduled
  driver (cron or workbench-triggered).
- Per dev-vessel CLAUDE.md: this requires (i) openspec under
  `openspec/changes/<date>-<slug>/`, (ii) implementation + per-resolver
  tests if new resolvers added, (iii) shape-dispatch lint pass.
- The proposals already in `validation/failure-modes/proposals/` are
  scenario-level drafts — the dev-vessel seed template is the
  *meta-driver* that produces such proposals autonomously.

**(b) Unblock operator registrations.**
- Either provision admin-scope API keys for canary, or wire a Bearer JWT
  admin flow through dashboard login. Per CLAUDE.md, this has been
  operator-blocked since 2026-04-25; current canary keys are `read,write`.
- Once unblocked, the per-cycle "register draft proposals" step disappears.
- Until then, every drafted proposal contributes 1 to debt as
  `operator-blocked`.

**(c) Add infra blocking proposals to execute.**
- FM-43 needs `POST /v2/activities/execution-traces/correct` on
  activity-api (mutable failure_mode for post-hoc reclassification).
- FM-44 needs durable outbox in `ias-executor-ts/.../activity-api-trace-sink.ts`
  + `GET /v2/vessels/{vesselId}/execution-count` on activity-api.
- FP-11 needs an input-signature fingerprint field on the `execution`
  table + a replay resolver in minibob.
- These are conventional code changes. Once landed, the proposals stop
  being "documented work" and become "runnable work".

## Cycle Log Pointers

- `cycles/cycle-0.json` — pure baseline: 6 gaps, 0 proposals, 0 debt.
- `cycles/cycle-1.json` — first work cycle: 3 subagent-drafted proposals,
  2 operator-blocked, debt=5, gaps still 6 (nothing registered yet).
- `cycles/cycle-2.json` — **first autonomous cycle**: 3 proposals authored by
  `make_activity_autonomous` via `development-vessel:draft-gap-closing-activity`.
  Variants registered: fp-11, fp-12, fm-17. Debt=2 (operator-blocked admin
  promotions remain). `remaining_gaps=[]` for the first time. DEV-5 complete:
  conversation-vessel deployed, `llm_completion` shape live in discovery.
  Gap closed: `draft-gap-closing-activity exists` ✓.
- `cycles/cycle-3.json` — harness run: gap_count=6, debt=5, 9 total proposals
  (6 autonomous). Variants registered but not discoverable via /recommend
  (lacking Thompson history). Operator admin scope still blocked.
- `cycles/cycle-5.json` — **FIRST CLEAN CYCLE**: reuse=6, gap=0, debt=0.
  All 6 scenarios matched via `discover-by-shapes` fallback (new in this cycle).
  All 6 variants drafted autonomously by `draft-gap-closing-activity`, registered
  with write-scope only. `consecutive_zero_debt_cycles=1`. Gap trajectory: 6→0.
- `cycles/cycle-6.json` — Steady state: reuse=6, gap=0, debt=0.
  `consecutive_zero_debt_cycles=2`.
- `cycles/cycle-7.json` — **LIFT CANDIDATE**: `consecutive_zero_debt_cycles=3`.
  All three lift criteria met for three consecutive cycles (5, 6, 7):
  debt=0, gap_count_decreasing (6→0), autonomous_proposals_present.
  Harness transitions to watch mode. Re-engage only if consecutive_zero_debt_cycles resets.

## Why the First Few Cycles Look Bad

Manual intervention debt rises before it falls. Drafting proposals takes
subagent dispatches; we accumulate debt while the system is still
incapable of doing the work itself. The trajectory matters more than any
single cycle's number:

```
cycle 0:  debt=0, gaps=6   (measurement only)
cycle 1:  debt=5, gaps=6   (we drafted three; nothing landed yet)
cycle 2:  debt=N, gaps=?   (operator registers; or we draft more)
…
cycle K:  debt=1, gaps=2   (one autonomous proposal; one stuck)
cycle K+1:debt=0, gaps=1   (system handles new gaps on its own)
cycle K+2:debt=0, gaps=0   (LIFT CANDIDATE if also strictly decreasing)
cycle K+3:debt=0, gaps=0   (LIFT confirmed)
```

We stop driving at cycle K+3. From there, the harness becomes a quiet
watch: if `consecutive_zero_debt_cycles` ever resets to 0, we know
something regressed and we re-engage. Otherwise we're done.
