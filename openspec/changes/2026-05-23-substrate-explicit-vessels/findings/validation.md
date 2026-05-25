# Validation Findings — substrate-explicit-vessels

agent: validation
spec: 2026-05-23-substrate-explicit-vessels
date: 2026-05-23
status: open

## Finding 1: Q1 answered — concept-db must be a substrate unit (gap-001)

**Claim in spec**: Q1 in design.md asks "Does concept-db get a place in this
layout?" and leaves it open, noting it "already runs as a vessel" and
llm-resolver-vessel calls it indirectly.

**Observed reality**: The `substrate-live` container (Phase 26 deployment,
15h+ uptime at time of observation) has NO concept-db systemd unit. Running
vessels: activity-api, development-vessel, discovery-vessel, identity-vessel,
minibob, surrealdb, valkey. Concept-db absent.

**Consequence**: The substrate cannot describe the semantic intent of its own
18 registered templates. Template IDs and output_shapes are strings with no
concept-layer interpretation. `propose-spec` — once substrate-authored — will
be able to deduplicate or extend templates only via string-matching, not
semantic comparison. The 24 concepts seeded on 2026-05-17 (Phase 22.S2,
12 vessel-construction-pattern + 12 impulse-activity-pattern) never reached
this substrate.

**Gap type**: missing_concept
**Severity**: substantive
**Gap record**: `validation/gaps/gap-001-no-concept-db-in-local-substrate.md`

**Proposed action**: Resolve Q1 in design.md as "yes — concept-db is a
substrate unit." Add a task to `tasks.md`:
- Add `scripts/substrate/units/concept-db.service` unit
- Point it at the existing concept-db repo image
- Include in `gen-env.sh` and `Dockerfile` substrate-build
- Seed the 24 Phase-22.S2 concepts after identity-seeding
Estimated: 1 unit file + Dockerfile line + env block + seed step.

## Finding 2: Narrator WS observability blocked by identity-vessel 401 (gap-002)

**Claim in spec**: Not directly addressed in this spec; this is an
operator-observability concern rather than a vessel-layout concern.

**Observed reality**: External narrator scripts (running from host, connecting
to ws://localhost:18080/ws) fail auth with "Identity vessel returned 401"
when using METABOB_API_KEY from `/etc/substrate/env`. Identity-vessel at
port 8101 returns 401 for this key. HTTP REST auth succeeds (templates
endpoint returns 200). Narrator running in snapshot-only mode (no live events).

**Gap type**: irreducibly_operator (operator access issue, not substrate
self-knowledge gap)
**Severity**: minor — substrate functions correctly; only external observability
degraded. Snapshot mode is sufficient for gap narration.

**Proposed action**: No spec change required. Workaround: the substrate-public-feed
spec (or operator-and-public-contracts) should handle this as the long-term
operator observation channel. Short-term: consider issuing a dedicated
observer-tier key via `docker exec substrate-live bun /vessels/issue-key.ts`
with read-only scope. Not blocking on any current tasks.

## Finding 3: Boredom-as-lifecycle-observer (design contribution, Phase 7)

**Claim in spec**: `proposal.md:66` describes `boredom-vessel` as a
"timer-driven autonomous-loop driver", replacing `repos/minibob/src/boredom.ts`.
`tasks.md` Phase 7.1 specifies a "systemd timer (`OnUnitActiveSec=5min`)
triggering a one-shot script that POSTs an autonomous goal to
`goal-host-vessel:8210/run-goal`" with goal source from the
stratified-goal-generator (Phase 25), gated by a no-recent-external-activity
check.

**Observed reality**: `scripts/substrate/units/minibob-boredom.timer` +
`minibob-boredom.service` already implement the spec's intent in a more
refined form than the spec text suggests. The current service does NOT post
goal text; it enqueues four templateIds to the Redis medium-priority queue
via `POST /v2/activities/boredom/enqueue`:

- `development-vessel:coverage-tick`
- `development-vessel:substrate-health-tick`
- `development-vessel:probe-reachable-unlearned`
- `development-vessel:learned-topology-snapshot`

Pile-up guard (`MEDIUM >= 4` → skip) prevents unbounded accumulation when
minibob is slow. The history note in the service file records that
`F-024` already moved off goal-format because "goal-format caused infinite
failing loops" — i.e., the substrate already learned (operator-driven) that
goal-text dispatch through goal-processor was the wrong handle.

What remains hardcoded:
- The **set** of four templateIds is fixed in the bash heredoc.
- The **trigger** is a wall-clock timer (10 min), not a state predicate.
- There is no learning loop closing back on which templates pay off **for
  the current substrate state** — Thompson posteriors update on execution
  outcomes, but the templates that get enqueued never change without
  operator edits to the unit file.

**Proposed recontextualization**: Move boredom from "hardcoded enqueue
list" to "lifecycle-observer-driven activity selection" — structurally
identical to how slot-binding, validator-dispatch, ribosome-extract, and
harness-run-matrix already attach to the substrate. The substrate gains
one new lifecycle event class and N new subscription clauses; it loses
the hardcoded enqueue list.

Concrete pieces (no new system primitives):

1. **New lifecycle event class**: `lifecycle:substrate:idle`. Emitted by
   a small idle-detector inside `boredom-vessel` (~50 LOC: poll
   `boredom/queue` stats + activity-api recent-execution count; emit when
   both are below threshold for the configured idle window).

2. **Event payload schema**:
   ```
   {
     idle_since: ISO-8601,
     last_activity_id: string | null,
     current_iss: { shape: string, count: number }[],   // impulse state space digest
     current_pss: { template_id: string, recent_α: number, recent_β: number }[],
                                                          // pool/posterior state digest
     recent_failure_modes: { type: string, count: number }[],
     recent_goal_count: number                            // external-caller goals in last 10 min
   }
   ```

3. **Boredom-eligible templates declare subscriptions**. Each adds a
   `subscription` block — exactly the form already used by slot-binding,
   validator-dispatch, ribosome-extract, harness-run-matrix:
   ```json
   {
     "subscription": {
       "event": "lifecycle:substrate:idle",
       "priority": 50,
       "applicability_filter": {
         "required_iss_shapes": ["coverage_tick_cells"],
         "iss_staleness_min_age_seconds": 600
       }
     }
   }
   ```
   The five candidates today: `coverage-tick`, `substrate-health-tick`,
   `probe-reachable-unlearned`, `learned-topology-snapshot`, plus
   `ribosome-extract` and `harness-run-matrix` once they want autonomous
   firing (today they subscribe to `execution:succeeded`).

4. **Dispatch path is the standard recommend pipeline**. The
   development-vessel lifecycle observer (`R3` in
   `openspec/changes/2026-05-23-topology-discovery-loop/specs/topology-discovery/spec.md:62-84`)
   already extends the harness-as-lifecycle-participant observer with a
   dispatch table. `lifecycle:substrate:idle` becomes one more entry in
   that table:
   - filter subscribers whose `applicability_filter` matches the event
     payload;
   - call `POST /v2/activities/recommend` with `expected_output_shapes`
     drawn from the filtered set;
   - Thompson Sampling selects among them based on current posteriors;
   - winner runs through slot-binding → execute via the same path every
     other meta-activity uses.

5. **`boredom-vessel` shrinks to ~50 LOC**: idle-detector + event emitter.
   The Redis enqueue path, the four-template hardcoded list, and the
   pile-up guard all disappear — replaced by Thompson posteriors and the
   `applicability_filter` predicates.

**Idiomatic precedent (this is not a new mechanism)**:

- `docs/CORE_IDIOMS.md:152-168` — Idiom 4 (Lifecycle hook subscription)
  is the canonical pattern. Foundation §61 declares lifecycle events are
  impulses of shape `lifecycle:*`. slot-binding, validator-dispatch,
  ribosome-extract, and harness-run-matrix all use this form.
- `openspec/changes/2026-05-23-topology-discovery-loop/specs/topology-discovery/spec.md:62-84` —
  R3 already constrains the observer to extend, not duplicate. Adding
  `lifecycle:substrate:idle` to its dispatch table is exactly that
  extension.
- Existing minibob lifecycle subscriptions live in
  `repos/minibob/src/lifecycle-subscriptions.ts`; the development-vessel
  observer is the substrate-resident equivalent.

**What this simplifies**:

- No separate boredom registry — boredom-eligible activities are normal
  activities with a `subscription` clause. Discovery and Thompson
  treat them identically to any other template.
- No hardcoded enqueue list — the set of fireable templates is the
  set of templates with `lifecycle:substrate:idle` subscriptions
  matching the current ISS/PSS.
- Single learning loop — boredom-fired executions feed the same
  Thompson posteriors as goal-fired ones, with no special-case credit
  path. Over time the substrate learns "when verifier_negative count is
  rising → fire harness-run-matrix; when chains accumulating → fire
  ribosome-extract; when coverage_tick_cells stale → fire coverage-tick".
- One fewer special-cased control surface — the Redis
  `boredom/enqueue` queue and the `MEDIUM >= 4` guard collapse into
  the standard recommend → slot-binding → execute pipeline, which
  already has its own backpressure.

**Interaction with the dispatch-path linchpin (gap-007 / F-037 / F-038)**:

- The **current** boredom path enqueues to Redis, which minibob's daemon
  drains via its (broken-for-composition_chain) goal-processor dispatch.
  The chain credit-cliff applies to all four boredom templates.
- The **recontextualized** path goes through the recommend → slot-binding
  → execute pipeline. After `GOAL_RUNTIME=ias-executor` is enabled per
  `validation/findings/dev-guidance-2026-05-24.md`, GoalHost
  (`repos/ias-executor-ts/src/examples/goal-host.ts:307-493`) threads
  `composition_chain` through `TranslatingTraceSink` — verified at
  goal-host.ts:348-353 per design.md §D3.
- Net: this recontextualization moves the boredom failure surface out
  of the broken dispatch path. Boredom-fired chain credit becomes
  correct as soon as GoalHost is the executor, with no boredom-specific
  fix needed.

**What this opens**:

- Substrate develops **learned maintenance routines** without operator
  edits to the unit file. Thompson posteriors converge on which
  boredom-eligible activity is most valuable for each ISS/PSS state.
- New boredom-eligible activities ship by declaring a `subscription`
  block — no unit-file change, no Dockerfile change.
- The `applicability_filter` predicates (`required_iss_shapes`,
  `iss_staleness_min_age_seconds`, recent-failure-mode predicates) become
  a small DSL the substrate itself can extend via `propose-spec` once
  the concept layer (Finding 1 / gap-001) is in place.
- Lift criterion in IAL Phase 27.1.2 ("substrate produces three
  non-human-triggered `convergenceReport` snapshots") is satisfied by
  the same mechanism that satisfies all other lifecycle-driven
  autonomy — no boredom-specific lift path.

**Sequencing relative to Phase 0–8 cutover**: compatible with, but
independent of, the full vessel-isolation work. Two viable orderings:

- **Land as Phase 7 boredom-vessel scope refinement** (preferred). The
  Phase 7 tasks already create the vessel; this finding replaces the
  "systemd timer + autonomous goal POST" implementation with
  "idle-detector emitter + standard recommend pipeline + subscription
  clauses on N templates". Total LOC drops; semantic alignment increases.
- **Land alongside the `GOAL_RUNTIME=ias-executor` flip** per
  `validation/findings/dev-guidance-2026-05-24.md`. Doing both at once
  removes the linchpin bug AND the hardcoded boredom list in a single
  cutover.

**Gap type and severity**:
- Type: **design contribution** (not a gap; the existing implementation
  works — this is a structural simplification that aligns boredom with
  the idiom every other meta-activity already uses).
- Severity: **substantive** — changes the architecture of one of the
  six explicit vessels named in this change. Reduces `boredom-vessel`
  scope from "timer + dispatcher" to "idle-detector + emitter".

**Proposed action**:
1. Amend `design.md` with a new §D7 ("Boredom-as-lifecycle-observer")
   capturing the event class + subscription clauses + dispatch path.
   Cross-reference Idiom 4 and topology-discovery R3.
2. Amend `tasks.md` Phase 7:
   - **7.1** becomes "Define `lifecycle:substrate:idle` event class and
     payload schema; add to discovery-vessel's known lifecycle events
     list".
   - **7.2** becomes "New `repos/boredom-vessel/` with idle-detector
     emitting `lifecycle:substrate:idle` (~50 LOC); substrate plumbing
     per Phase 1".
   - **7.3** becomes "Add `subscription` blocks to coverage-tick,
     substrate-health-tick, probe-reachable-unlearned,
     learned-topology-snapshot in development-vessel's
     `seed-templates/`; extend development-vessel lifecycle observer
     dispatch table (per topology-discovery R3.2) to handle
     `lifecycle:substrate:idle`".
   - **7.4** unchanged ("Delete `repos/minibob/src/boredom.ts`"), plus
     a new **7.5**: "Remove `scripts/substrate/units/minibob-boredom.timer`
     and the boredom-enqueue REST surface from activity-api once
     subscriber-driven path is verified".
3. No change to Phase 0–6 or Phase 8–9. Phase 7 becomes smaller in
   scope and more idiomatic.

**Cross-references** (open specs that came up while writing this):
- `openspec/changes/2026-05-23-topology-discovery-loop/` — R3 observer
  is the dispatch home for `lifecycle:substrate:idle`.
- `openspec/changes/2026-05-23-harness-as-lifecycle-participant/` — the
  observer being extended (per topology-discovery R3.1, must not be
  duplicated).
- `openspec/changes/2026-05-23-development-vessel/` (existing dev-vessel
  seed templates) — the natural home for the `subscription` clauses on
  coverage-tick et al.
- `validation/findings/dev-guidance-2026-05-24.md` — the
  `GOAL_RUNTIME=ias-executor` flip that closes the dispatch-path
  linchpin (gap-007 / F-037 / F-038) referenced above.
- `docs/CORE_IDIOMS.md:152-168` — Idiom 4 canonical reference.
