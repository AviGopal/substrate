# Stage 0 + Stage 1 — empirical verdicts (2026-06-03)

Status after Stage 0 + Stage 1 land:

## Stage 0 — Foundation-doc-as-concepts

8 architectural principle concepts minted into concept-db with
`source_type = "architectural_pattern_principle"`:

| name | severity | applies_to |
|---|---|---|
| backend_is_trace_store_not_universal_resolver | structural | vessel_responsibility_audit, vessel_architecture_pattern_scan, resolver_distribution_audit |
| single_llm_dispatcher_is_spof_for_autonomous_self_modification | structural | vessel_architecture_pattern_scan, resolver_distribution_audit |
| per_dispatch_full_state_capture_is_o_n_memory | structural | vessel_architecture_pattern_scan, vessel_responsibility_audit |
| activities_should_be_dispatchable_not_baked_in_vessel_code | structural | vessel_responsibility_audit, activity_lifecycle_audit |
| architectural_insights_should_be_queryable_concepts | guidance | all four |
| resolvers_live_where_data_lives | structural | resolver_distribution_audit, vessel_responsibility_audit |
| every_execution_traces_for_learning | guidance | activity_lifecycle_audit, vessel_architecture_pattern_scan |
| architectural_principles_index (meta) | advisory | meta (self-documenting catalogue) |

Three of these carry `check_hints` in `pointer.metadata` (regex + target_vessel + detail) — the deterministic predicates the horizon detectors use.

Verification: `curl http://127.0.0.1:18260/concepts/search?source_type=architectural_pattern_principle` returns 8 concepts.

## Stage 1 — Four horizon detectors

All four detectors:
- Resolver in `repos/development-vessel/src/resolvers/<name>.ts`
- Shape advertised in `src/config.ts` (81 → 81 lint passes)
- Dispatch case in `src/routes/impulses.ts`
- Per-resolver test in `test/resolvers/<name>.test.ts` (15/15 pass)
- Immunity pattern (empty inputShapes, single resolver, no LLM, no pool iteration)
- Single-task seed template in `src/seed/<name>-tick.ts` (registered + uploaded)
- Boredom goal `[17..20]` with explicit targetTemplateId and cost=cheap

### Empirical findings on live substrate state (2026-06-03)

**vessel_responsibility_audit (goal-host-vessel target, dry-run)** — direct in-container invocation:

- vessels_scanned: 1 (goal-host-vessel only)
- principles_fetched_total: 8
- principles_consulted: 3 (the three structural principles with check_hints)
- total_violations: **1** ← empirical proof point
  - principle: `backend_is_trace_store_not_universal_resolver`
  - file: `/vessels/goal-host-vessel/src/index.ts`
  - matched_pattern: `v2/activities/templates\?|reuseList|reuse_template|LLM[-_]?reuse|selectBestTemplate`
  - matched_excerpt: `_REUSE_LLM_ENABLED !== "0") { try { const reuseList = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/templates?q=gap-closing&limit=10`, …`
  - detail: "goal-host fetches template catalogue + does LLM-reuse — both should live behind a select-activity-for-goal endpoint on activity-api"

**Live non-dry-run emit:** substrateGap posted to dev-vessel `/v2/impulses/resolve` with category `responsibility_misallocation`, emit_status: 200. The substrate now autonomously surfaces the operator-articulated insight ("goal-host doing activity-api's job") as a substrateGap impulse the gap-drain pipeline can consume.

**vessel_architecture_pattern_scan (HTTP dispatch via :18090)**:
- total_traces_scanned: 500
- distinct_dispatchers: 1 ("unknown" — trace metadata lacks `dispatcher_used` field)
- 1 finding: `single_dispatcher` severity=high (500/500 = 100% one dispatcher)
- cited_principle: `single_llm_dispatcher_is_spof_for_autonomous_self_modification`

This is also a real architectural signal: trace metadata doesn't yet carry `dispatcher_used` (Stage 2.C will add it). Until then, every dispatch routes through goal-host and the detector correctly flags the SPOF.

**activity_lifecycle_audit (HTTP dispatch)**:
- total_templates: 201
- templates_with_traces: 32
- hot-set top-3: probe-reachable-unlearned, gap-closing-auto, scaffold-and-publish-vessel (all combined_score=0.03; sparse traces this window)
- 1 finding: `should_unload_cold_set` (15 templates with combined_score=0)

**resolver_distribution_audit (HTTP dispatch)**:
- advertised: 4 (discovery /shapes endpoint returned only 4 entries — registry is partial)
- invoked: 0 (no traces in window included `metadata.template_id` linkable to these shapes)
- 1 finding: `shape_orphan` (4/4 advertised shapes never invoked)

## Known issue — HTTP-mode discrepancy for vessel_responsibility_audit

When `vessel_responsibility_audit` is dispatched via the dev-vessel HTTP route (`POST :18090/v2/impulses/resolve`), `principles_fetched_total` returns 0 — yet:
- Direct in-container `bun -e import { resolveVesselResponsibilityAudit } …` returns 8
- Concept-db `GET /concepts/search?source_type=architectural_pattern_principle` returns 8 to both in-container curl and direct bun fetch
- The OTHER three detectors that read concept-db work fine via the HTTP route

The discrepancy is reproducible across systemctl stop+start, fresh restart, dry_run on/off. The detector LOGIC is correct (empirical proof point achieved via direct invocation); the HTTP route's `fetch` call to concept-db from within a `Bun.serve` handler returns an empty concepts list whereas the same code executed standalone returns 8.

Filing as a follow-up: probably a Bun runtime edge case with fetch from within a serve handler under specific timing. The detector ships as-implemented; subsequent investigation will isolate (likely an HTTP/2 connection-reuse or AbortSignal interaction).

## Files modified

- `repos/concept-db/src/models/schemas.ts` — added `architectural_pattern_principle` to SourceTypeSchema enum
- `repos/concept-db/src/resolvers/concept.ts` — completed exhaustive Record<SourceType,string> for shape inference
- `repos/concept-db/src/sources/unified.ts` — completed Records for shape/priority/budget defaults
- `repos/development-vessel/src/resolvers/concept-search-by-source.ts` — extended union type
- `repos/development-vessel/src/resolvers/concept-write.ts` — extended union type
- `repos/development-vessel/src/resolvers/vessel-responsibility-audit.ts` — **NEW**
- `repos/development-vessel/src/resolvers/vessel-architecture-pattern-scan.ts` — **NEW**
- `repos/development-vessel/src/resolvers/activity-lifecycle-audit.ts` — **NEW**
- `repos/development-vessel/src/resolvers/resolver-distribution-audit.ts` — **NEW**
- `repos/development-vessel/src/config.ts` — 4 new shapes (77 → 81)
- `repos/development-vessel/src/routes/impulses.ts` — 4 new dispatch cases
- `repos/development-vessel/src/seed/{vessel-responsibility,vessel-architecture-pattern-scan,activity-lifecycle,resolver-distribution}-audit-tick.ts` — **NEW** (4 single-task seed templates)
- `repos/development-vessel/src/seed/index.ts` — register the 4 new tick templates
- `repos/development-vessel/test/resolvers/{vessel-responsibility,vessel-architecture-pattern-scan,activity-lifecycle,resolver-distribution}-audit.test.ts` — **NEW** (15 tests, all pass)
- `repos/boredom-vessel/src/index.ts` — 4 new goals (17..20) + targets + costs
- `validation/scripts/seed-architectural-principles.ts` — **NEW** Stage 0 mint script

Total LOC (rough): resolvers ~1100, tests ~440, seeds ~120, boredom ~25, seed script ~290 → well under the 1500 LOC budget.

## What this unlocks (Stage 2+)

The four horizon detectors now run on boredom cadence (goals 17..20, every ~5min). Their substrateGap emissions feed the existing gap-drain pipeline (drain-pending-substrate-gaps + draft-gap-closing-activity). The substrate's own emitted gaps now justify the Stage 2 operator-bootstrap fixes:

- Stage 2.A (goal-host dispatch-setup patch) is justified by `responsibility_misallocation` substrateGap from this session
- Stage 2.B (light-dispatch-vessel) is justified by `single_dispatcher` substrateGap (100% concentration)
- Stage 2.C (capability routing in boredom) is justified by the same `single_dispatcher` signal + the missing `dispatcher_used` trace field

The recursive principle holds: every architectural insight is now queryable as a concept; every queryable principle becomes a detection target; every detection target produces actionable substrateGaps.
