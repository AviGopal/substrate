# Tasks — display-perception-vessel

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Shape contract definition (independent, ship first)

- [ ] **A.1** — Register the four display shapes in `concept-db`'s
  shape catalog (`repos/concept-db/src/shapes/display.ts` — new
  file). Each entry includes Zod schema, bridge-eligibility flag,
  cardinality hint.
  - `displayCapture` — bridge-deny
  - `displayObjectDetection` — bridge-deny
  - `displayTextTokens` — bridge-deny
  - `displayContextAggregate` — bridge-allow
  - `displayContextSummary` — bridge-allow
  - Acceptance: `bun test` covers schema round-trip per shape;
    bridge-eligibility per shape asserted against the Phase C
    denylist.
- [ ] **A.2** — Register the same four shapes in
  `repos/metabob-activity-api/src/config.ts` `discovery.shapes` as
  pass-through advertise (activity-api does not own them; the
  peer-vessel does). Adds a `bridged_owner: "display-vessel"`
  annotation so discovery resolution forwards to the peer vessel
  when reached.
  - Acceptance: `bun run typecheck` clean; discovery probe at
    runtime returns the four shapes mapped to `display-vessel`.

## Phase B — Signature projection (depends on display-signature-partitioning Phase B)

- [ ] **B.1** — Implement the `coarsenForDisplay(shape) → string`
  helper referenced by `display-signature-partitioning` task B.1, in
  `repos/metabob-activity-api/src/utils/display-coarsen.ts` — new
  file.
  - Input: a `displayObjectDetection` body.
  - Output: `sorted(unique(icon_label_classes ∪ functional_caption_classes))`
    joined as a stable string, fed into the
    `computeStateSpaceSignature` hash.
  - Acceptance: unit test covering identity (same input → same
    hash), invariance (1px bbox shift → same hash), discrimination
    (different caption-class set → different hash).
- [ ] **B.2** — Register a `functional_caption_classifier` impulse
  shape (also in `concept-db` shape catalog). Maps caption strings
  to caption-classes ("Submit", "Send", "Confirm" → `submit_action`;
  "Cancel", "Back", "Close" → `cancel_action`; etc.). The classifier
  itself is a resolver implemented by the peer vessel; this task
  only registers the contract.
  - Acceptance: shape registered; sample classifier output validates.
- [ ] **B.3** — End-to-end signature test: synthesize a sequence of
  three `displayObjectDetection` impulses representing the same UI
  with shifted bboxes; assert they hash to the same `display`-tier
  signature. Synthesize a fourth with a different caption-class
  set; assert it hashes differently.

## Phase C — Concept-bridge denylist refinement (depends on A)

- [ ] **C.1** — Extend `concept-bridge-observer.extractConceptRefs`
  in `repos/concept-db/src/observer/concept-bridge-observer.ts`
  with a two-tier denylist:
  - Deny: `displayCapture`, `displayObjectDetection`,
    `displayTextTokens`.
  - Allow (pass through to normal extraction): `displayContextAggregate`,
    `displayContextSummary`.
  - Read the bridge-eligibility flag from the shape catalog (A.1)
    rather than hardcoding the denylist.
  - Acceptance: unit test with one impulse per shape asserts the
    correct extract/skip decision.
- [ ] **C.2** — Document the denylist + rationale in
  `repos/concept-db/docs/bridge-eligibility.md` — new file. Tie to
  the privacy posture in the parent proposal.

## Phase D — Substrate-side seed activities (depends on B, C, and host-peer Phase B)

All activities gated on a substrate-level `SUBSTRATE_HAS_DISPLAY_PEER`
boolean (analogous to existing `SUBSTRATE_HAS_*` capability flags).
Without the peer vessel registered in discovery, the activities are
inert.

- [ ] **D.1** — Seed activity `probe-display` in
  `repos/development-vessel/src/seed/probe-display.ts`.
  - One task: dispatch `displayCapture` resolver against the peer
    vessel; verify response carries non-null `capture_ref` + valid
    `scope_context`.
  - `inputShapes: []`, `outputShapes: [displayCapture]`.
  - Acceptance: integration test against a stubbed peer-vessel
    returns 200 + valid capture.
- [ ] **D.2** — Seed activity `localize-element-by-text` in
  `repos/development-vessel/src/seed/localize-element-by-text.ts`.
  - Composes: `probe-display` → `displayObjectDetection` resolver
    (peer vessel) → filter `detected_elements` by
    `functional_caption_class` matching input goal text → emit
    `displayElementLocation` impulse (the located bbox + element).
  - Acceptance: against a stubbed detector output, the filter
    correctly extracts the matching element.
- [ ] **D.3** — Seed activity `describe-current-screen` in
  `repos/development-vessel/src/seed/describe-current-screen.ts`.
  - Composes: `probe-display` → `displayObjectDetection` →
    `llm-resolver` summarization → emit `displayContextSummary`.
  - LLM summarization redacts captions that match a per-shape PII
    pattern list (drawn from `repos/development-vessel/src/lib/
    pii-patterns.ts` — new file with sensible defaults).
  - Acceptance: stubbed end-to-end run produces a
    `displayContextSummary` with no raw caption text.
- [ ] **D.4** — Wire the three activities to `bun run cli
  seed-templates` for substrate-side registration.

## Phase E — Perception-only soak window (gates display-control)

This phase has no implementation tasks. It defines the gate that
`2026-05-31-display-control-extension` Phase A awaits.

- [ ] **E.1** — Operational criterion. After Phase D ships and the
  peer vessel is reachable from the substrate, perception-only
  traces must accumulate for **≥ 14 consecutive days** before any
  task in the control extension may merge. Evidence is recorded
  into `validation/state/display-soak-status.json`:
  - `soak_started_at`
  - `total_capture_traces`
  - `total_detection_traces`
  - `failure_mode_breakdown` (counts per failure-mode type)
  - `false_positive_rate` (operator-flagged misclassifications /
    total detections)
- [ ] **E.2** — Soak-window verifier activity
  `verify-display-perception-soak` in development-vessel:
  - Reads `display-soak-status.json` + recent traces.
  - Emits `displaySoakReport { ready: boolean, blocking_reasons }`.
  - `ready: true` when soak window ≥ 14 days AND
    false_positive_rate < 0.05 AND no `verifier_negative` events
    with `confidence_tier ∈ {1, 4}` in the last 48h.
  - Acceptance: report semantics covered by unit test; live report
    against a 0-trace soak returns `ready: false`.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — shapes are additive | Can ship before the peer-vessel exists; activities will be inert. |
| B | `2026-05-31-display-signature-partitioning` Phase B | Coarsening helper composes with the tier infrastructure. |
| C | Phase A | Denylist reads from the shape catalog populated in A. |
| D | Phase B + Phase C + `2026-05-31-display-vessel-host-peer` Phase B (Linux X11 capture) | Activities are inert without a reachable peer. |
| E | Phase D shipped | Soak window opens when D is live; control extension awaits E.2 returning `ready: true`. |

## Cross-references

- `2026-05-31-display-signature-partitioning/` — signature-tier
  machinery; this spec uses `display` and `display+source_app`
  tiers from there.
- `2026-05-31-display-failure-mode-extensions/` — failure modes
  consumed by this spec's verifiers and dispatch gates.
- `2026-05-31-display-vessel-host-peer/` — the peer-vessel
  implementation that hosts the resolvers this spec dispatches to.
- `2026-05-31-display-control-extension/` — the dual action spec,
  gated on Phase E.
- `2026-04-26-security-hardening-findings/` — H3 scope-attestation
  consumer.
