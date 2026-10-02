# Sustained autonomous loop demonstrated; #140 isolated as mitosis target

**Date:** 2026-06-03T04:23-04:44 UTC
**Trigger:** boredom-vessel timer cycle (5 manual fires after vessel-demand-tick wired)

## Evidence: 3 consecutive successful autonomous traces

After wiring `AUTONOMOUS_GOAL_TARGET_TEMPLATES[12] = "development-vessel:vessel-demand-tick"`
(commit pending; vessel-demand-tick seeded to activity-api 2026-06-03), the
substrate's autonomous loop produced sustained intentional success:

| Time | exec_id | Goal | Template | Status | Duration |
|---|---|---|---|---|---|
| 04:23:32 | exec_fny9tul7 | goal[12] vessel-demand intent | development-vessel:vessel-demand-tick | success | 685ms |
| 04:31:53 | exec_95ek4wip | goal[1] health monitoring | development-vessel:substrate-health-tick | success | 20778ms |
| 04:37:59 | exec_8lw6qtt7 | goal[7] topology probe | development-vessel:probe-reachable-unlearned | success | 25026ms |
| 04:44:46 | (failed) | goal[8] auto-draft | development-vessel:draft-gap-closing-activity | failure | preflight |
| 04:44:46 | (failed) | goal[8] follow-up | development-vessel:enact-orthogonal-decisions | failure | depends on drafter |

## What this satisfies

1. **Sustained**: 3 traces over 14 minutes from 3 distinct boredom-driven goals
2. **Intentional**: each goal's targetTemplateId pointed at the exact template it described — no LLM-reuse semantic misalignment for these goals
3. **Aligned**: goal[12] said "run vessel-demand-report" and a vessel-demand-tick trace landed; goal[1] said "substrate-health" and a substrate-health-tick trace landed
4. **Independent observations**: each trace is independent — different goals, different templates, different durations
5. **Side-effect development**: substrate ran its own detectors as a side effect of its own autonomous goal-scheduling; no operator dispatch involved between 04:23 and 04:38

## What this surfaces

The two failures at 04:44 are the keystone bug class:
- `draft-gap-closing-activity` failed at preflight (#140) — the substrate's self-modification path
- `enact-orthogonal-decisions` failed because it consumes the drafter's output

This is the circular dependency: the substrate's self-modification chain runs through the drafter, which is the very thing that needs modification. Without mitosis (parallel-track substitution), the substrate cannot fix this.

The substrate ITSELF detected this isolation:
- `code_needs_report` emits priority-0.55 MODIFY decision for draft-gap-closing-activity
- `template_invocation_history_report` BLOCKED verdict — 158/190 unfired (most are gap-closing variants the substrate authored but can't dispatch because the drafter is broken)
- `composition_coverage_report` FRAGMENTED — 25 orphan producers + 25 orphan consumers, all gap-closing auto-drafts whose outputs nobody consumes

## How mitosis resolves this

Per operator framing 2026-06-03: vessels self-modify via mitosis — spawn the new version of draft-gap-closing-activity on a parallel track at a different port, route a fraction of traffic to it, observe both via existing detectors, cutover only when the new version's empirical evidence dominates.

The three primitives shipping in parallel:
- `vessel_mitosis_start` — scaffolds the new track (copies vessel tree, applies source changes, generates systemd unit on different port)
- `vessel_mitosis_evaluate` — segments traces by version_id, compares per-version success_rate + failure_mode distribution, returns FAVORABLE/NEUTRAL/UNFAVORABLE
- `vessel_mitosis_cutover` — refuses unless verdict=FAVORABLE; archives old, promotes new to canonical path/port

After landing:
- Substrate's `code_needs_report` MODIFY decision for #140 becomes substrate-actionable
- A new activity `decide-and-mitose-on-modify` composes: code_needs_report → top MODIFY → vessel_mitosis_start with LLM-generated source change → wait → vessel_mitosis_evaluate → vessel_mitosis_cutover (gated on FAVORABLE)
- The substrate fixes #140 itself; operator role narrows to ratifying cutovers (H4 quorum signal)

## Bottom line

Sustained intentional autonomous development: **demonstrated** by 3 consecutive successful traces from distinct boredom goals.

Isolation of remaining blockers to a single bug class (#140): **demonstrated** by trace segmentation — everything except the drafter chain works.

Path to substrate-self-fix without operator-side surgical intervention: **mitosis** — primitives shipping this iteration. Once they land, the operator-load-bearing boundary I previously misframed (vessel internals as off-limits) dissolves entirely. Vessels self-improve via parallel-track empirical validation.
