# Tasks — substrate-self-audit-meta

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Meta-template + fan-out resolver (independent, ship first)

- [ ] **A.1** — Implement seed template `substrate-self-audit-meta` in
  `repos/development-vessel/src/seed/substrate-self-audit-meta.ts`
  following the immunity pattern.
  - `inputShapes: []`, `variables: []`, single task `audit_fan_out`.
  - `outputShapes: ["selfAuditReport", "substrateGap"]`.
  - Header comment cites `concept_9ldsmRgqSTd5` and the immunity
    siblings the same way `detect-precondition-rejection.ts:16-25`
    and `detect-service-oom-cascade.ts:30-33` do.
  - Acceptance: file follows the format of the four canonical
    family members; lint clean (`bun run lint` includes
    `scripts/check-shape-dispatch.ts`).
- [ ] **A.2** — Implement resolver `self_audit_fan_out` in
  `repos/development-vessel/src/resolvers/self-audit-fan-out.ts`.
  - Input: `{ since?: ISO8601, max_traces?: number }`.
  - Reads recent traces via the activity-api
    `executionTraceList` surface using the same `fetch` pattern
    the existing family resolvers use.
  - Dispatches the four canonical family members in parallel via
    `resolveDispatch` (`src/routes/impulses.ts`) — same pattern as
    `runTopologyChain` at
    `repos/development-vessel/src/observers/registry-change-observer.ts:70-114`.
  - Aggregates per-detector
    `{executed, succeeded, gap_count, duration_ms}` into the
    `selfAuditReport` body.
  - Re-emits underlying `substrateGap` impulses at the meta level
    so the meta-execution's `output_impulse_ids` carries them.
  - On empty fan-out (no detectors dispatched): return a
    `failure_mode.type: "verifier_negative"` with
    `failed_evidence: [{ check_id: "fan_out_empty" }]` so a meta
    that does no real work cannot accrue α.
  - Acceptance: unit test with four scripted fake detectors
    asserting all are dispatched in parallel, summary aggregation
    is correct, and the empty-fan-out failure_mode fires when no
    members are configured.
- [ ] **A.3** — Three-place rule. Add `self_audit_fan_out` to
  `discovery.shapes` in `src/config.ts` AND add the matching
  `case` in `src/routes/impulses.ts`. Add `selfAuditReport` as a
  separate shape with the same two-place wiring. Confirms with
  `scripts/check-shape-dispatch.ts`.
- [ ] **A.4** — Wire the template into `src/seed/index.ts`. Append
  `SUBSTRATE_SELF_AUDIT_META_TEMPLATE` to the `SEED_TEMPLATES`
  array with a header comment mirroring the four family members'
  style (cite `concept_9ldsmRgqSTd5`).
- [ ] **A.5** — Per-resolver test (spec R8.1):
  `test/resolvers/self-audit-fan-out.test.ts` with fake fetch +
  scripted detector responses; assert idempotency under re-run.

## Phase B — Lifecycle wiring (depends on A)

- [ ] **B.1** — Extend `registry-change-observer.ts` with a new
  predicate `shouldAudit(event: LifecycleEvent): boolean`:
  - Returns `false` if `event.type !== "lifecycle:execution:succeeded"`.
  - Returns `false` if `event.activity_template_id` matches the
    meta-template's id (self-exclusion / loop guard).
  - Returns `false` if `event.composition_chain.length > 0` (only
    top-level executions audit).
  - Returns `true` otherwise.
  - Acceptance: unit test enumerating each predicate branch.
- [ ] **B.2** — Add a per-`template_id` debounce table to the
  observer using the same pattern as `recentDispatches` at
  `registry-change-observer.ts:138-152`. Default window
  `AUDIT_DEBOUNCE_MS = 60_000`; configurable via
  `SUBSTRATE_AUDIT_META_DEBOUNCE_MS`.
- [ ] **B.3** — In the `ws.addEventListener("message", …)` handler
  (`registry-change-observer.ts:320-379`), after the existing
  `shouldRescore` / topology-chain block, add an `if
  (shouldAudit(event) && passesDebounce(event.activity_template_id))`
  branch that fires `resolveDispatch({ type:
  "self_audit_fan_out", since: <window> })` with an error catch.
  - Acceptance: integration test driving a fake
    `lifecycle:execution:succeeded` event through the observer
    and asserting `self_audit_fan_out` dispatched exactly once
    across a burst of identical-template events within the
    debounce window.
- [ ] **B.4** — Subscribe `substrate-self-audit-meta` to
  `activityRegistryChange` as well. The existing topology-chain
  predicate `shouldRescore` at `registry-change-observer.ts:266`
  already detects the `activityRegistryChange` output shape;
  factor the audit dispatch into the same handler so a
  registry-change runs both the topology chain AND the audit.

## Phase C — Rate-limit (depends on B)

- [ ] **C.1** — Add a global audit rate-limit (separate from the
  per-template debounce). Default `MIN_INTERVAL_MS = 120_000`,
  configurable via `SUBSTRATE_AUDIT_META_MIN_INTERVAL_MS`.
  - Implementation: a single `lastAuditFiredAt` timestamp at
    module scope, mirrored on the
    `AGGREGATOR_DEBOUNCE_MS` pattern at
    `registry-change-observer.ts:46-67`.
  - Acceptance: unit test asserting the second of two
    same-second triggers is dropped; after `MIN_INTERVAL_MS` the
    next trigger fires.
- [ ] **C.2** — Surface the rate-limit decision in observer logs:
  when a trigger is dropped, log `[audit-meta] rate-limited; next
  available at <ts>`. This is the operator's read-side for whether
  the cap is working as intended.
- [ ] **C.3** — Cite the load-attribution concern explicitly in
  the resolver header comment. The same concept_RYl73llSCGfc OOM
  cascade the family detects is the bug class the rate-limit
  guards against — make the rationale documentable.

## Phase D — selfAuditReport shape + concept-bridge denylist (independent of C)

- [ ] **D.1** — Define `selfAuditReport` type in
  `repos/development-vessel/src/resolvers/types.ts` (or wherever
  the other report shapes live). Match the proposal's body
  structure exactly.
- [ ] **D.2** — Add `selfAuditReport` to the concept-bridge
  denylist tier (the two-tier denylist documented in
  `2026-05-31-display-perception-vessel`): the aggregate report
  is bridge-eligible (operator + concept-db should know that
  audits ran), but the underlying `substrateGap` payloads the
  report carries do **not** auto-promote — they already have
  their own bridge path via `substrateGap_write`.
- [ ] **D.3** — Documentation note in
  `repos/development-vessel/docs/CASES_AND_FLOWS.md` (or the
  current docs home) describing the audit-meta as the
  detection-family equivalent of `coverage-tick`.

## Phase E — Push-away credit hook (depends on C + D)

- [ ] **E.1** — When `selfAuditReport.gaps_emitted` count exceeds
  a per-template threshold (default 3 within the audit window),
  emit a `substrate_audit_pressure` impulse with
  `{ template_id, gap_count, audit_window_start,
  audit_window_end, recent_gap_summary }`. The load-aware gate
  from super-repo commit `04441ca9` reads this as additional
  refusal evidence — boredom dispatches against a template under
  audit pressure get refused with cited evidence.
  - Acceptance: integration test asserting that when a fixture
    detector emits 4 gaps in one audit window, the
    `substrate_audit_pressure` impulse fires; when 2 gaps emit,
    it does not.
- [ ] **E.2** — When a refusal cites `substrate_audit_pressure`,
  the refusal record links (via `concept_link`) to the
  underlying `substrateGap` impulses that drove the pressure
  signal. This makes the refusal-citation chain
  `(refusal → audit_pressure → gap → detector_finding)`
  walkable for operator audit. Acceptance: walk the chain in an
  integration test starting from a refusal record.
- [ ] **E.3** — Record evidence into
  `validation/state/lift-status.json` as a sub-criterion of S2
  ("substrate self-detection is event-driven, not
  rotation-stochastic"). Cite this proposal's commit and the
  three consecutive observation windows showing fan-out
  cadence matches lifecycle cadence.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — ship as standalone | Closes the catalogue-vs-loop gap; family members already exist |
| B | Phase A deployed | Subscription requires the resolver + template ids to exist |
| C | Phase B deployed | Rate-limit is meaningful only once events drive dispatch |
| D | None — independent of C | Shape definition can land anytime after A |
| E | Phase C + Phase D | Push-away credit reads both rate-limit decisions and gap counts |

## Cross-references

- `concept_9ldsmRgqSTd5` — `substrate_self_detection_principle`
- `2026-05-30-trace-to-concept-mining/` — companion unknown-arm
- `2026-05-30-event-driven-novelty-surface/` — sibling event source
- `2026-05-31-detect-resource-budget-violation/` — companion
  detector that this meta-template will fan out once shipped
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` Phase E.2 —
  shared S3 push-away credit window
- IAL `tasks.md` Post-lift siblings table — this spec is
  registered there alongside the companion
