# Demand-driven orphan-capability detection

## Why

The substrate's self-repair runs on a `substrateGap` economy: detectors emit
`substrateGap` impulses → `drain-pending-substrate-gaps` / `draft-gap-closing-activity`
/ `gap-compose-tick` read them and author the fix. The architecture is sound and
general — but it has a **disconnected seam for the orphaned-capability class**, and
that seam is why the substrate cannot self-correct the dominant connectivity defect.

**Measured 2026-06-23 (live substrate `:18080` / discovery `:8100`):**
- Discovery advertises **262 live resolver shapes**.
- Across all **1540** activity templates, only **28 distinct resolvers are invoked**.
- **250 live resolvers are never invoked by any activity.** The orphaned set is the
  substrate's *entire outward capability surface*: the whole analysis family
  (`problem_detection`, `code_quality`, `code_annotation`, `cpg_query_result`,
  `source_code`, `error_log`), the whole concept family (`concept`,
  `concept_create_write`, `conceptGraph`, …), the whole git/gh family
  (`git_status/commit/diff/push`, `gh_pr_create`), the whole obsidian family
  (`obsidian:note/search/graph_query/execute_command`, …), `fs_edit/grep/list`,
  `llm_completion`, `light_dispatch_execution`, `embed`, `cluster`.
  (Full list: `orphan-resolvers-evidence.txt`.)
- Verified the orphaned resolvers WORK: analysis-vessel `problem_detection` returned a
  real finding (`createServer` 218 lines > 80 in discovery-vessel); concept-db stored a
  concept. They are alive, deterministic, and receive zero traffic — analysis-vessel
  logs show only gc-ticks.

**Why the loop can't see this itself:**
- `capability_gap_audit` (the detector wired into the fix-loop; emits `substrateGap`)
  mines **failure traces**. Ran live: 0 gaps. An orphaned capability never fails — it
  is never called — so silence produces no gap.
- `consumer_productivity_audit` *does* correctly identify orphans (verdict `uncovered`
  for `problem_detection`) but is **report-only**: it emits no `substrateGap` and no
  tick/timer invokes it. Its verdicts are a dead-end report.

The substrate's find-stage is **reactive** (repairs what breaks). An orphaned, working,
never-called capability is a stable silent equilibrium with zero failures, so the
reactive detector is permanently blind. This is the missing half of the find-stage:
**demand-driven** detection of capability that exists but is unexpressed.

This is the operator-boundary case (the substrate cannot author its own TypeScript
vessel code): we add the missing detector that lets the substrate's *existing* author
/compose loop find and fix every orphaned capability autonomously — raising
explore-breadth (currently 0.152) and λ₁ (genuine non-hub producer→consumer edges)
without us authoring any individual bridge activity.

## What changes

- **New resolver** `orphaned_capability_scan` (development-vessel): computes
  `live_resolver_shapes − invoked_resolvers`, filters to outward-capability shapes
  (excludes internal-machinery: `*_tick`, `*_observer`, `*_scan`, `*_audit`,
  `*_report`, dev-vessel meta, discovery/activity-api learning shapes — but KEEPS
  legitimate capability writes like `concept_create_write`), and emits one
  `orphaned_capability` `substrateGap` per orphan (stable id, deduped via upsert),
  citing the owning vessel + a proposed bridge ("author an activity that invokes
  resolver `<shape>` and routes its output onward"). Returns an
  `orphanedCapabilityReport`.
- **New seed tick template** `development-vessel:orphaned-capability-tick` wrapping the
  resolver, tagged `boredom_target_template` so the autonomous loop dispatches it on
  cadence (cheap tier — HTTP-only, no LLM).
- **Three-place wiring** (resolver file + `config.ts` shape + `impulses.ts` case) +
  per-resolver test (`test/resolvers/orphaned-capability-scan.test.ts`).

## Impact

- Affected: `repos/development-vessel` (one resolver, one seed template, config +
  routes + test). No change to activity-api, discovery, or other vessels.
- The emitted `orphaned_capability` gaps flow into the existing
  `drain-pending-substrate-gaps` → `draft-gap-closing-activity` → `gap-compose`
  loop with no changes to that loop.
- Risk: low. The detector is deterministic, read-only except for `substrateGap_write`
  (idempotent upsert by stable id). Worst case is over-emission of gaps, bounded by the
  capability-shape filter and stable-id dedup; the drain loop already rate-limits gap
  consumption.

## Success criteria

1. Running `orphaned_capability_scan` emits ≥1 `orphaned_capability` `substrateGap`
   for a known orphan (e.g. `problem_detection`) and zero for an invoked resolver
   (e.g. `fs_read`, `json_path_extract`).
2. The gap is visible to `drain-pending-substrate-gaps` (appears as an open gap).
3. Re-running the scan upserts (does not duplicate) gaps by stable id.
4. `bun run lint` (tsc + shape-dispatch check) and `bun test` green.
5. After deploy, observe the existing author/compose loop pick up ≥1 orphan gap and
   produce a draft activity that invokes a previously-orphaned capability resolver
   (the loop closes end-to-end, autonomously).
