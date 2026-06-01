# Tasks — display-control-extension

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Soak gate (no implementation; gate-only)

- [ ] **A.1** — Verify
  `2026-05-31-display-perception-vessel` Phase E.2 has shipped AND
  `validation/state/display-soak-status.json` shows
  `displaySoakReport.ready = true` for ≥ 14 consecutive days.
  - Acceptance: cannot start Phase B until both conditions met.
    Document the verification in this spec's design.md (created
    on phase start) or in a `findings/` note.
  - **No code changes in Phase A.**

## Phase B — Action wire format + reversibility contract (depends on A)

- [ ] **B.1** — Define `displayAction_write` shape in concept-db's
  shape catalog. Body schema embeds the Anthropic
  `computer_20251124` input (re-exported from
  `repos/vessels/ai/packages/anthropic/src/tool/computer_20251124.ts`),
  plus `reversibility_class`, `attested_region`,
  `attested_window_id`, `scope_context`.
  - bridge-eligibility: deny (action shapes carry coordinates +
    text input that may include PII).
  - Acceptance: zod schema round-trip per action enum value;
    `reversibility_class` round-trip per three values.
- [ ] **B.2** — Register the shape via the three-place rule across
  `display-vessel` (advertise), `activity-api`
  `discovery.shapes` (pass-through), and seed templates that
  consume it. The peer-vessel-side implementation lives in
  `2026-05-31-display-vessel-host-peer` Phase B.
- [ ] **B.3** — Selector dispatch policy. Extend
  `repos/metabob-activity-api/src/services/thompson-sampling.ts`
  (or the equivalent dispatch path) to read `reversibility_class`
  off the action input and apply the policy table from the
  proposal:
  - `reversible` — pass through normal selection.
  - `soft_irreversible` — require attestation; refuse if none.
  - `hard_irreversible` — refuse unless attestation enumerates
    the specific class; never autonomous.
  - Acceptance: unit tests covering all three classes against the
    selection path.
- [ ] **B.4** — Hard n=0 gate at the dispatch boundary. When the
  `(template, signature)` pair has `n_observations = 0` on the
  paired `displayObjectDetection` posterior, refuse
  `displayAction_write` dispatch with
  `failure_mode.context.intervention_refused = true` and emit a
  `displayActionFirstEncounter` impulse.
  - Acceptance: integration test with a fresh signature returns
    refusal + emits the impulse; after an operator confirmation
    impulse (the dual to `displayActionFirstEncounter`) lifts the
    block, dispatch proceeds.

## Phase C — Verifier activity (depends on B)

- [ ] **C.1** — Implement `verify-display-state-after-action`
  activity in `repos/development-vessel/src/seed/
  verify-display-state-after-action.ts`. Composes:
  - tier 1: pixel-region hash comparison via a
    `pixel_region_hash` resolver on the peer vessel (cheapest);
  - tier 2: dispatch `displayObjectDetection` resolver + diff
    pre/post `detected_elements` against expected change;
  - tier 3: `wait` N seconds + check for `actionAborted` impulse
    in the activity-api trace stream;
  - tier 4: emit `operatorConfirmationRequest` impulse and await
    response (only used when activity input asks for it).
  - Output: `displayActionVerificationResult { tier_passed, evidence }`.
  - On failure: emit `verifier_negative` with `confidence_tier`
    per `display-failure-mode-extensions` Phase C.3.
  - Acceptance: unit test per tier asserting the correct
    verdict + the correct failure-mode emission on negative.
- [ ] **C.2** — Wire `verify-display-state-after-action` as a
  composition leaf for every action template via lifecycle
  observer (`lifecycle:execution:succeeded` on a template whose
  `output_shapes` includes `displayAction_write` triggers the
  verifier post-action). Add to development-vessel observer
  registrations.
  - Acceptance: integration test against a stubbed action
    dispatch shows the verifier runs unprompted.

## Phase D — `detect-display-action-no-op` seed template (depends on C)

- [ ] **D.1** — Implement `detect-display-action-no-op` activity in
  `repos/development-vessel/src/seed/
  detect-display-action-no-op.ts`. Composes:
  - `pixel_region_hash` resolver on the pre-action capture;
  - `pixel_region_hash` resolver on the post-action capture;
  - `displayObjectDetection` hash diff on pre/post;
  - If both hashes identical AND the trace status is success:
    emit `failure_mode { type: "verifier_negative",
    confidence_tier: 1, failed_evidence: [{check_id:
    "post_action_state_unchanged"}] }`.
  - Acceptance: integration test with a stubbed identical-pre/post
    capture pair produces the failure-mode emission.
- [ ] **D.2** — Subscribe the no-op detector to
  `lifecycle:execution:succeeded` events where the template's
  output_shapes includes `displayAction_write`. Wire in
  development-vessel observer registration.
- [ ] **D.3** — Document the detector in
  `repos/development-vessel/docs/no-op-detectors.md` (new file).
  Cross-reference `detect-phantom-success-trace` (already in
  the substrate per `concept_HKlz4FAc2cpf`).

## Phase E — Operator interrupt hotkey + `actionAborted` (depends on B)

- [ ] **E.1** — Define `actionAborted` impulse shape in concept-db's
  catalog. Body: `{ aborted_at, attestation_ids_revoked,
  composition_chain, revocation_source }`. bridge-allow.
  - Acceptance: schema round-trip.
- [ ] **E.2** — Peer-vessel global hotkey binding (implementation
  in `2026-05-31-display-vessel-host-peer` — task cross-referenced
  here). The peer vessel emits `actionAborted` over its WebSocket
  to activity-api on trigger.
- [ ] **E.3** — Substrate-side handler. activity-api consumes the
  `actionAborted` impulse and:
  - dispatches the `consent_revoked` failure-mode write per
    `display-failure-mode-extensions` Phase B.2;
  - writes `consent_state_reset` veto row for each affected
    `(template, signature)`;
  - cascades posterior penalty via
    `propagateCreditAlongChain` with
    `failure_mode.context.root_cause_step` set when the trace
    identifies the offending step (per
    `display-failure-mode-extensions` Phase A).
  - Acceptance: end-to-end test injecting an `actionAborted`
    produces the expected posterior writes + veto rows.

## Phase F — Autonomy gradient (depends on B, C, E)

- [ ] **F.1** — Class-graduation tracker. Implement
  `validation/state/display-action-autonomy-status.json` schema
  with per-class entries: `class_id (e.g. reversible-small-region-
  focused-window)`, `supervised_success_count`,
  `intervention_refused_count`, `graduated_at`, `revoked_at`.
- [ ] **F.2** — Graduation activity
  `evaluate-display-action-class-graduation` in
  `repos/development-vessel/src/seed/
  evaluate-display-action-class-graduation.ts`. Reads recent
  traces + the status file; per class, asserts the criteria
  (≥30 supervised successes + ≥3 cited refusals); on pass,
  records graduation and emits
  `displayActionClassGraduated { class_id, evidence_trace_ids }`.
  - Acceptance: synthetic-trace test produces graduation on the
    right inputs; status file updates correctly.
- [ ] **F.3** — Selector consumes the status file. Autonomous
  boredom-vessel dispatch may pick `displayAction_write`
  templates whose `reversibility_class × region × window-focus`
  matches a graduated class entry. Non-graduated classes require
  operator goal dispatch.
  - Acceptance: integration test with one graduated class +
    one ungraduated class asserts boredom selects only the
    graduated one.
- [ ] **F.4** — Operator revocation surface. Operators can revoke
  a class graduation via `concept_link({edge_type:
  "contradicts"})` against the graduation record. The activity
  reads the contradiction edge and clears `graduated_at`, sets
  `revoked_at`. Acceptance: integration test simulates
  contradiction + asserts the state transition.

## Phase G — Hard-irreversible class enumeration (depends on F)

- [ ] **G.1** — Operator-side attestation grammar for
  hard-irreversible classes. Each `hard_irreversible`
  attestation must enumerate the specific action class via a
  fixed enum that the peer vessel ships:
  `wire_transfer_confirm`, `message_send`, `file_delete`,
  `system_shutdown`, `destructive_git`, `custom_<operator-defined>`.
  - Default: empty allowlist. Operator must explicitly add each
    class via a signed attestation.
- [ ] **G.2** — Per-class earning is operator opt-in only. The
  graduation activity (F.2) refuses to mark any
  `hard_irreversible` class as graduated; the autonomy status
  file's `graduated_at` for hard-irreversible classes is always
  null until operator manual intervention.
  - Acceptance: synthetic-trace test with 30 successful
    supervised hard-irreversible dispatches does NOT trigger
    graduation; only operator-signed manual graduation does.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | Hard: perception spec Phase E.2 + ≥14 days observed | Gate-only phase; no implementation. |
| B | `display-failure-mode-extensions` Phase B + `display-signature-partitioning` Phase D + `display-vessel-host-peer` Phase B (Linux X11 input) | Minimum-viable action path. |
| C | Phase B | Verifier composes off the action shape. |
| D | Phase C | No-op detector composes off the verifier outputs. |
| E | Phase B | `actionAborted` consumes the failure-mode taxonomy from `display-failure-mode-extensions` Phase B.2. |
| F | Phases B, C, E shipped | Graduation requires verifier + interrupt evidence. |
| G | Phase F | Operator-opt-in path; hard-irreversible enumeration is per-deployment. |

## Cross-references

- `2026-05-31-display-perception-vessel/` — soak gate source
  (Phase A) + perception primitives the verifier consumes.
- `2026-05-31-display-vessel-host-peer/` — peer-vessel
  implementation (Phase B input shellouts, Phase E hotkey binding).
- `2026-05-31-display-signature-partitioning/` —
  `reversibility_class` as a signature partition dimension
  (Phase D of that spec).
- `2026-05-31-display-failure-mode-extensions/` —
  `consent_revoked`, `action_reversal_failed`,
  `confidence_tier`, `root_cause_step`.
- `2026-04-26-security-hardening-findings/` — H3 scope
  attestation grammar.
- `2026-05-30-vessel-binary-redeploy-on-source-drift/` — Phase E
  push-away credit framework; F.2 graduation evidence contributes
  to the same `validation/state/lift-status.json` rubric.
