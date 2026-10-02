## Why

The MCP→analysis-vessel→activity-api `/ws` pipeline now reaches concept-db's `ExecutionObserver` end-to-end (after the 2026-05-28 `VesselDaemon.emitResolveTrace` change in ias-executor-ts that broadcasts every `POST /resolve` as `task.completed` with `source: "vessel_daemon_resolve"`). But concept-db's `extractConceptRefs` filter (`repos/concept-db/src/services/execution-observer.ts:100-127`) accepts only three forms of concept reference:

1. `r.concept_id` field set explicitly
2. `r.shape === "concept"` (with `concept:` prefix on impulse_id)
3. `r.impulse_id` starts with `concept:` or `concept_`

Analysis-vessel emissions hit none of these. The resolver produces shapes like `problem_detection`, `code_annotation`, `cpg_query_result`; `VesselDaemon` synthesizes `impulse_id: "impulse:<pointerType>:<ts>"` and pulls `shape` from the resolver result. Verified empirically 2026-05-28 via 25-second WS capture: 145 events received, 0 with `vesselId`, 0 with `shape: problem_detection`, 0 `recordUsage` hits in concept-db.

Without this bridge, every cross-vessel observation trace (MCP-driven and otherwise) bypasses the substrate's concept-learning loop. The substrate cannot accumulate concept usage from anything except activities that already emit `concept:`-prefixed impulse ids.

This is the kind of cross-vessel wiring gap that — per the lift-evaluation finding `finding_2026_05_28_substrate_gap_consumer_unwired` — the substrate currently cannot author autonomously. The autonomous `draft-gap-closing-activity` template's 9-resolver palette excludes `concept_create_write` and `conceptLink_write`, and `substrateGap_write` has no consumer wired. Filing this change formalizes the deferral.

## What Changes

This change has two parts:

**Part A — S1 baseline (already landed, 2026-05-28, behind a known concept-db block):** the `concept-bridge-observer` in dev-vessel subscribes to activity-api `/ws`, filters `task.completed` events with `data.source === "vessel_daemon_resolve"`, and for each `impulse_resolutions[]` entry whose shape is in `{problem_detection, code_annotation, cpg_query_result, source_code, code_quality, error_log}`, calls `POST /concepts/upsert-by-signature` and `POST /concepts/:id/usage` on concept-db. Wiring is verified end-to-end except for the concept-db SurrealDB write failure documented in `finding_2026_05_28_concept_db_root_signin_blocked` (separate bug, not introduced by this change).

**Part B — S2 deferral (this change formalizes):** the substrate authors a sibling adapter activity from a `substrateGap_write` impulse, eventually replacing the hand-coded observer. Requires (i) `2026-05-27-neutral-emitter-lifecycle-bus` shipping so `lifecycle.gap.classified` reaches the WS bus, (ii) `substrateGap_write` getting a consumer that dispatches `draft-gap-closing-activity` against a synthetic scenario, and (iii) the autonomous draft palette expanding to include `concept_create_write` and `conceptLink_write`. None of these are done.

## Capabilities

### New Capabilities

- **concept-bridge-observer (dev-vessel):** TS-layer WS subscriber that routes analysis-vessel resolutions into concept-db usage records. Per dev-vessel's three-layer discipline this stays as routing-only TS; per-symbol concept extraction (the richer fan-out) is left for the substrate-authored activity in Part B.

### Modified Capabilities

- **`extractConceptRefs` in concept-db:** unchanged. The bridge mints proper signature-style concepts upstream rather than broadening the filter, because broadening the filter would conflate "is a concept" with "is concept-derivable" — concept-db cannot tell which symbols inside a `problem_detection` payload are concept-worthy vs ephemeral mentions.

### Deferred

- Per-symbol concept extraction (each function/class in a `problem_detection` result becoming its own concept linked back to the rule concept) is deferred to the substrate-authored activity in Part B.
- Autonomous palette expansion (`concept_create_write`, `conceptLink_write`) is deferred to a sibling change `2026-05-XX-autonomous-palette-expansion` not yet drafted.
- `substrateGap` consumer wiring (closer activity that observes `substrateGap_write` and dispatches `draft-gap-closing-activity`) is deferred — see `finding_2026_05_28_substrate_gap_consumer_unwired`.

## Dependencies

- `2026-05-27-neutral-emitter-lifecycle-bus` — must ship before Part B is achievable. Currently 0/n tasks complete.
- `finding_2026_05_28_concept_db_root_signin_blocked` — Part A cannot be functionally verified until this is resolved (the bridge issues correct calls; concept-db rejects with IAM error). Bridge code is correct.

## S1→S2 evidence value

Part A's existence documents a concrete instance of an S1 deferral that the operator authored because the substrate could not. Part B is the lift test: when the dependencies in `## Dependencies` ship, the substrate should be able to draft a sibling adapter (e.g. for a future vessel that emits non-concept-shape resolutions) without operator code. The S2 win is *not* re-deriving Part A — that's already done — but *deriving the next one*.
