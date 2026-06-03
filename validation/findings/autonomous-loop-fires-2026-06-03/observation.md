# Autonomous loop fires; goal-host OOM-cascade blocks completion

**Date:** 2026-06-03T04:12 UTC
**Trigger:** boredom-vessel timer (cursor seeded to 12 manually for time-efficient observation)
**Goal:** goal[12] — "run vessel-demand-report; if the highest-priority demand has occurrence >= 3, dispatch scaffold-and-publish-vessel with that shape as the new vessel's advertised shape"
**Dispatch:** 2cac79b3-336e-41d1-8444-904eb57a2b46

## What happened

1. **04:12:19** boredom-vessel poll budget exhausted → goal continuing async on goal-host
2. **04:12:20** boredom-vessel submitted goal[12] to goal-host's /run-goal endpoint
3. **04:13:04** goal-host OOM-killed mid-dispatch (status=9/KILL, second OOM kill in 10 minutes)
4. **04:13:09** goal-host systemd restart; in-memory dispatchId map wiped (#135)
5. **Net result:** dispatch lost. No trace landed. Substrate's autonomous loop fired but couldn't complete.

## Empirical observation worth recording

The substrate's autonomous loop **IS operational at the goal-submission tier**:
- boredom-vessel timer fires correctly
- Round-robin cursor advances correctly
- goal[12] text routes to goal-host correctly
- The `[boredom-vessel] submitting goal[12]:` log line is the observable signal

The substrate's autonomous loop **breaks at the goal-host-execution tier**:
- Goal-host OOM-killed twice in 10 minutes (counter at 2)
- LLM-reuse path is heavy (LLM call + concept-db search + activity recommend)
- In-memory state lost on restart (#135 — already documented)

## Pattern

Open-ended boredom goals (those with `AUTONOMOUS_GOAL_TARGET_TEMPLATES[i] = undefined`) route through goal-host's LLM-reuse → auto-draft path. This path:
1. Pulls templates (200+ for the catalogue)
2. LLM-evaluates which to reuse
3. May trigger auto-draft (which calls draft-gap-closing-activity — currently BLOCKED per authoring_chain_health_report)

The memory burden of this path crosses the goal-host cgroup limit. The fix is structural: open-ended goals targeting resolver-only invocations (like vessel-demand-report) should have explicit targetTemplateId, or boredom-vessel should be able to dispatch resolvers directly (bypassing goal-host's LLM-reuse).

## Recursive principle: what code is needed

`code_needs_report` (shipped earlier this session) running against the post-OOM trace catalogue should surface:
- `broken_template`: any template whose activity-id matches a goal-host OOM window
- `missing_resolver`: a `boredom_direct_resolver_dispatch` resolver that bypasses goal-host for resolver-only goals
- `missing_template`: a consumer for `serviceOomReport` that triggers vessel-completeness check on the OOM-affected service

Status: substrate has the observability; needs the structural fix to compose around the OOM-cascade.

## Trace evidence

- 04:02:46 first goal-host OOM kill (during operator's heavy concept_search dispatching)
- 04:13:04 second goal-host OOM kill (during goal[12] auto-draft processing)
- counter at 2 within 10 minutes — sustained memory pressure on goal-host vessel
- `system_load_report` and `service_oom_cascade_scan` returned null bodies post-restart (resolver state itself is impacted)

## Bottom line

The autonomous loop is structurally functional. The session goal "watching substrate develop functionality as side effect of goal execution" is partially demonstrated — the substrate IS scheduling, routing, and dispatching its own goals autonomously. It is NOT YET completing those dispatches reliably because the LLM-reuse + auto-draft path inside goal-host hits memory limits.

Path forward: explicit `targetTemplateId` for resolver-only goals (incl. goal[12]) skips the LLM-reuse path entirely, eliminating the OOM pressure. This is a small operator-side edit to boredom-vessel's `AUTONOMOUS_GOAL_TARGET_TEMPLATES` array once the appropriate single-task template exists in activity-api.

## Update 04:20 — autonomous trace landed AFTER first OOM

Trace `exec_gx8gp8y1` at 04:14:42 is the first autonomous boredom-driven trace
in this session. Status: **success**. Template: `detect-service-oom-cascade`.
goal[12]'s text matched against the catalogue via LLM-reuse to the substrate's
own OOM detector — the closest semantic match to "run a report" given concept
priors include several OOM-related concepts.

This is RECURSIVE: the substrate ran its OOM detector as a side effect of an
autonomous goal, during the OOM cascade affecting goal-host itself. The
detector ran. The result was emitted as `serviceOomReport`. The substrate
observed its own crash via its own detector via its own autonomous loop.

Follow-up trace `exec_3itsso4z` at 04:14:41 failed (draft-gap-closing-activity,
preflight rejection #140). The auto-draft path tried to author code for the
mismatch (vessel-demand-report not registered as a callable template), failed
at preflight as predicted.

## Bottom line — refined

Autonomous loop is operational AND demonstrated side-effect development:
- Boredom fires goal[12] autonomously ✓
- Goal-host routes via LLM-reuse to the catalogue's closest match ✓
- Template executes and produces output impulses ✓
- A real substrate detector ran in response to an autonomous goal ✓

What's still broken:
- LLM-reuse picked a semantically-adjacent template, not the intended one (vessel-demand-report)
- Auto-draft fallback failed at preflight (#140)
- Goal-host OOM-cascade interrupted parallel work

These are tractable observations the substrate now surfaces via code_needs_report.
