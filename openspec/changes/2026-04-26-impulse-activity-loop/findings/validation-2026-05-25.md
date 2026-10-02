# Validation 2026-05-25 — Thompson Fix + Full Closure

## Session summary

### Fixed

**F-thompson-normalize (CLOSED)**
`applyOutcomeToPosteriors` in `posterior-update.ts` was not normalizing the
`activity_id` before the WHERE lookup on `variant_performance_metrics`. Traces
from goal-host-vessel carry `activity:⟨development-vessel:harness-run-matrix⟩`
but the stored rows use bare `development-vessel:harness-run-matrix`. The WHERE
never matched; alpha/beta stayed at initial values regardless of outcome.

Fix: `normalizeActivityId(rawActivityId)` applied at the top of the function
(the import was already there but unused for this purpose). Verified:
- success trace: alpha 1→2 ✓
- failure trace: beta 2→3 ✓

Commits: `b972fd2` (metabob-activity-api)

**F-proxy-resolver (CLOSED)**
GoalHost only registers its own built-in resolvers. Templates from
development-vessel use IDs like `development-vessel:coverage_tick` which were
not registered, causing all executions to fail with `task_count=0` and the
engine throwing "Resolver '...' is not registered".

Fix: `registerDevVesselProxies()` in goal-host-vessel fetches `/shapes` from
development-vessel at startup and registers HTTP proxy resolvers for each shape
under both bare name and `development-vessel:<name>` qualified form.

First successful goal execution after fix: `exec_9h3w86zw` (duration_ms=42322).

Commits: `e53bae09` (goal-host-vessel)

**F-created-at-none (CLOSED)**
`execution_trace_content.created_at` was typed as `TYPE datetime` with a VALUE
default, but the default doesn't fire on INSERT INTO in this SurrealDB version.
Caused non-fatal "Found NONE for field `created_at`" on every trace store.

Fix: migration 138 — `DEFINE FIELD OVERWRITE created_at ... TYPE option<datetime>`.
Applied to running container.

**F-boredom-timeout (CLOSED)**
`boredom-vessel.service` had no `TimeoutStartSec`, using the systemd default
of 90s. Topology discovery goals take ~4min. Service was being killed mid-run.

Fix: `TimeoutStartSec=300` added to the unit file.

**F-closure-audit-key (CLOSED)**
`closure-audit.ts` read the API key from `~/.metabob/config.json` (canary key),
which is invalid in the local substrate. Discovery queries got 401.

Fix: priority chain — `SUBSTRATE_API_KEY` env > `METABOB_API_KEY` env >
`/workspace/.substrate-secrets` > `~/.metabob/config.json`.

Also added `docker exec substrate-live curl http://localhost:8210/health` as
a fallback for the subagents probe when port 18210 isn't host-mapped.

### Verified state

- All 6/6 IAL §27.3.j closure properties CLOSED (closure-audit 6/6 green)
- All 7 vessels active (activity-api, development-vessel, goal-host-vessel,
  llm-resolver-vessel, local-tools-vessel, ribosome-vessel, discovery-vessel)
- 296 execution traces, 15 variant_performance_metrics rows
- Thompson posteriors updating correctly post-fix
- Boredom loop executing topology goals (4min completions observed)
- Composition_chain propagating through child executions

### Open (not blocking)

- `create-shape-provider-goal`: 30 executions, 0 successful (alpha=1, beta=2).
  This pattern is a known gap — the template references shapes that don't yet
  have producers in the substrate. Not blocking closure.
- WebSocket reconnect cycle in ribosome-vessel: transient during activity-api
  restarts; reconnects successfully within 1s. Not a gap.
- Port 18210 not host-mapped on current container (pre-dates Makefile fix).
  Closure audit uses docker exec fallback. Will resolve on next container start.
