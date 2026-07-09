# Spec: contiguous shape flow

## ADDED Requirements

### Requirement: Standing intents are pool-resident shapes

The substrate SHALL maintain a persistent standing pool owned by development-vessel,
exposed as `poolImpulse` (read) and `poolImpulse_write` (upsert-by-id) impulse shapes.
Open `substrateGap`s and coarse objectives SHALL be injectable as standing pool
impulses. Goal-host SHALL hydrate every walk pool from open standing impulses
(non-fatal on fetch failure), and state-conditioned selection SHALL include the open
standing-intent shapes in its conditioning key.

#### Scenario: gap becomes standing intent

- **WHEN** a detector writes an open `substrateGap`
- **THEN** a corresponding standing pool impulse exists with `status: "open"`, and a
  subsequently started walk's pool contains it, and `compute_state_signature` output
  reflects its shape.

### Requirement: Gaps carry their route class as data

`SubstrateGap` SHALL support optional `route` (`dispatchable | composable |
human_required`) and `remedy` fields declared by the emitting detector. A gap without
`route` SHALL drain exactly as today (composable). Dispatchable gaps with a pinned
remedy SHALL dispatch on the event path and SHALL NOT enter the compose-budget
landability ranking.

#### Scenario: pinned remedy bypasses compose

- **WHEN** `trace_store_health_observer` emits a gap with `route: "dispatchable"` and
  `remedy: development-vessel/trace_store_reconcile`
- **THEN** the drain consumer dispatches that remedy directly and the gap never
  consumes gap-to-feature compose budget.

### Requirement: Event-triggered drain over the existing WS channel

`substrateGap_write` SHALL publish a `devvessel.gap.written` event through activity-api
`/v2/events/publish` (fire-and-forget). A drain consumer in development-vessel SHALL
subscribe to the activity-api `/ws` channel (authenticate + catchup handshake,
exponential backoff, swallow-and-log) and SHALL service dispatchable gaps within
seconds-to-minutes (< 5 min), guarded by the maintenance-lease/change-window and
bounded to 2 concurrent drains. On `execution_completed` the consumer SHALL re-evaluate
open standing intents and continue flow (flow handoff).

#### Scenario: gap→remedy latency

- **WHEN** a dispatchable gap with a pinned remedy is written while the substrate is
  healthy
- **THEN** the remedy dispatch starts within 5 minutes without any timer firing.

### Requirement: Timers are degraded-mode watchdogs

Demoted timer units SHALL be re-pointed (not deleted) at a watchdog check: when open
relevant intents exist AND no corresponding pool/walk/drain activity occurred within N
minutes, the watchdog restarts flow (one trace, `information_yield:
"watchdog_restart"`); otherwise it exits silently writing no trace and issuing no
store reads beyond the local standing-pool file.

#### Scenario: quiet watchdog is writeless

- **WHEN** the event-driven drain is healthy and a demoted watchdog tick fires
- **THEN** no execution trace, gap write, or trace-store query results from the tick.

### Requirement: Landing-failure attribution splits fix from environment

Landing/cutover failures SHALL classify as fix-failures (draft defect → gap-scoped
penalty + lesson) or environment-failures (`env_change_window_held`,
`env_cutover_race`, `env_boot_race`, `env_stale_manifest` → no gap penalty, no lesson,
retry after the condition clears). Failed-attempt counters and category calibration
SHALL consume only fix-failures; `failure_kind` SHALL be recorded on the attempt.

#### Scenario: cutover race does not burn the gap

- **WHEN** a land attempt fails because the target vessel restarted mid-cutover
- **THEN** the gap's `failed_attempts` is unchanged and the attempt record carries
  `failure_kind: "environment"`.

### Requirement: Change-window defers competing actors

While a change-set holds the `change_window` lease (TTL-bounded), self-recovery SHALL
NOT restart/revert vessels named in the window, pull-sync SHALL defer, and competing
ticks/drains SHALL defer. Change-sets SHALL land atomically (one verify + one cutover,
dependency-ordered) and the driving gap SHALL close only after the running vessel
serves the new shape.

#### Scenario: self-recovery defers during cutover

- **WHEN** a vessel is mid-cutover under a held change-window and its unit is briefly
  inactive
- **THEN** self-recovery takes no restart/revert action until the window is released
  or expires.

### Requirement: Gap lifecycle is decisions, not decay

At age boundaries the gap's condition SHALL be re-verified; still-true conditions age
the gap *up* (`verified_age_boundaries` increment, priority raised), cleared conditions
close it as `condition_cleared`. After 3 fix-failures on a dispatchable/blocking gap,
the substrate SHALL escalate visibly (human_required via Obsidian, decompose, or
park-with-reason). Landability auto-close SHALL be forbidden for verified or
dispatchable gaps.

#### Scenario: verified gap cannot be buried

- **WHEN** a gap has `verified_age_boundaries >= 1` and its landability score falls
  below the auto-close threshold
- **THEN** the gap remains open (or is parked with explicit reason), never silently
  closed.

### Requirement: Trace generation correlates with goal activity

With the event path healthy and timers demoted, trace-insert rate (via
`trace_store_counters`) SHALL correlate with goal activity rather than wall-clock;
idle hours SHALL be near write-silent.

#### Scenario: idle hour

- **WHEN** no goals are dispatched and no standing intents are open for an hour
- **THEN** trace inserts during that hour are near zero (watchdog quiet paths and
  detector no-finding paths write nothing).
