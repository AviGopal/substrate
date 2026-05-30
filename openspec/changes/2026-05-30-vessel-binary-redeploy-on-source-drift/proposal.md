# Vessel-binary redeploy on source drift

## Why

The substrate's Functional → Vessel (instructional) loop is closed for **activity
templates** (ribosome-vessel promotes successful executions) and for **concepts**
(concept-bridge-observer accumulates from analysis-vessel resolutions). But it is
**open for vessel binary code**. When operator commits update a vessel's source
inside the substrate container, the running binary keeps serving the previous
build until something restarts the systemd unit. There is no activity in the
substrate's registry that detects "running binary is stale vs source on disk"
and triggers a rebuild + restart.

This proposal closes that gap. Without it, the substrate cannot meet the S2 → S3
criterion ("active push-away with cited evidence") for vessel-code drift —
operator restarts remain load-bearing.

## Empirical motivation (2026-05-30 13:30 PDT)

- F26 (concept-db comma-separated `source_type`) committed to repo (concept-db
  `a262475`, super-repo `a9abc101`) and operator-edited into the container's
  source tree at `/vessels/concept-db/src/routes/concepts.ts`.
- Container's running concept-db binary is still v0.3.0 with the pre-F26 route
  handler. Probe: `GET http://localhost:18260/concepts/search?source_type=memo,impulse_signature`
  returns Zod enum validation error.
- Substrate memory (concept `concept_HKlz4FAc2cpf`, `substrate_self_fix_pattern`)
  records "Awaiting substrate-restart for activation." The instructional layer
  knows. No transient/functional layer acts.
- Dispatching `run_goal` "rebuild and restart concept-db so F26 goes live"
  selected `gap-closing:test-valid-1780148026306` via Thompson — a generic
  gap-closing template, no actual restart. 1.2s, completed.

This is the operational evidence that **the substrate cannot fix vessel-binary
drift on its own today**.

## What changes

Add to `development-vessel`:

1. **Resolver `detect_binary_source_drift`** — given a vessel id, compares the
   mtime / git rev of `/vessels/<vessel>/src/` to a hash of the loaded binary
   (or the systemd unit's `ExecMainStartTimestamp`). Emits
   `binarySourceDriftReport { vessel_id, drifted: boolean, source_mtime,
   binary_started_at, reason }`.

2. **Activity `redeploy-vessel-on-drift`** — composes:
   - `detect_binary_source_drift` against a target vessel
   - if `drifted: true`: `systemd_restart` (already exists) against the unit
   - verifies post-restart health via `http_fetch` GET on the vessel's `/health`
   - on success: emits `vesselRedeployResult { vessel_id, restarted_at, health_ok }`
   - on failure: emits `failure_mode { type: "verifier_negative", ... }` so the
     selection layer learns

3. **Lifecycle observer** — subscribes to a yet-unmodeled
   `vesselSourceChange` event (emitted when ribosome/operator/dev-loop modifies
   a `/vessels/*/src/` tree). Triggers `redeploy-vessel-on-drift` for the
   affected vessel id. Until the source-change event ships, the activity is
   dispatchable via boredom-vessel rotation or operator goal.

## Out of scope

- The `vesselSourceChange` event itself. Stub it as a TODO; today the activity
  runs by manual / boredom dispatch.
- Build-step changes inside the container. Concept-db is a Bun project that
  loads `src/*.ts` directly via `bun run start`; restart is sufficient. For
  vessels needing a build step, a separate `build_vessel` resolver gets a
  follow-up change.
- Source-of-truth resolution between container `/vessels/*/src/` and host
  super-repo `repos/*`. Today operators copy via `docker exec` or volume
  mount; the activity's responsibility starts at "the source on disk is the
  source of truth," not "the host repo is the source of truth."

## How this validates

After the activity ships:

1. Operator commits + edits container source (the F26 pattern repeats).
2. Next boredom tick or substrate-health observation triggers
   `redeploy-vessel-on-drift` for concept-db.
3. F26 query returns 200 with non-empty concepts on the *next* drafter run,
   without operator intervention.
4. The `substrate_self_fix_pattern` concept gets a sibling concept
   `substrate_self_fix_observed { vessel_id, completed_at, evidence_trace_id }`
   linked via `derived_from`. That sibling is the substrate citing its own
   self-fix — the citation S2 → S3 requires.

## Dependencies

- `systemd_restart` resolver — exists (`scripts/substrate/units/`,
  development-vessel resolvers per memory `percolation_2026_05_23_substrate_live`).
- `failure_mode` shape — exists (migration 091).
- Lifecycle event bus — partial; observer subscription mechanism exists
  (`ribosome-vessel`, `concept-bridge-observer`).

## Risk

- Auto-restart can mask bugs that should surface as failed traces. Mitigation:
  the activity only fires when `binarySourceDriftReport.drifted: true` AND the
  binary started before the source mtime — never on a fresh container.
- Cascading restarts if multiple vessels drift simultaneously. Mitigation:
  process one vessel per tick; emit `vesselRedeployResult` and let the next
  tick pick up the next drifted vessel.
- Restart loop if the rebuilt binary is itself broken. Mitigation: the post-
  restart health check is a verifier; failure emits `failure_mode` and
  Thompson β-updates the activity, slowing dispatch.
