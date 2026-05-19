# Tasks: Test-Audit Loop

Phased rollout. Each phase ships a working surface on canary before the next
phase begins. Checkbox style matches
`2026-04-26-impulse-activity-loop/tasks.md`.

---

## Phase A — Registration Contract

### A.1 Define impulse shapes

- [ ] A.1.1 Add `test_registration`, `test_report`, `test_audit_report`,
  `sensitivity_evidence` to the activity-api shape catalogue
  (`repos/metabob-activity-api/src/config.ts` shapes block). **Acceptance:**
  `GET /v2/vessels/shapes` includes all four; shape-dispatch lint
  (`2026-05-17-shape-dispatch-agreement`) passes.
- [ ] A.1.2 Schema files under `repos/metabob-activity-api/src/models/schemas.ts`
  for the four shapes, matching the field lists in `design.md` §E.2 and §B.3.
  **Acceptance:** unit tests for each shape's discriminated context (Zod or
  TypeScript schema validator).

### A.2 Write resolver

- [ ] A.2.1 Add `testAuditReport_write` to `src/routes/impulses.ts` following the
  pattern of the 14 existing `*_write` resolvers documented at
  `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`. **Acceptance:**
  `POST /v2/impulses/resolve { shape: "testAuditReport_write", body: ... }`
  persists and is fetchable via `GET /v2/activities/execution-traces/:id`.
- [ ] A.2.2 Same for `testRegistration_write`, `testReport_write`,
  `sensitivityEvidence_write`. **Acceptance:** each shape round-trips.

### A.3 Grandfathering

- [ ] A.3.1 Build `validation/scripts/registration-backlog.json` listing every
  `.ts` file in `validation/scripts/` that does not yet emit a
  `test_registration`. **Acceptance:** backlog has one row per file with a
  `status: "unregistered"` field.
- [ ] A.3.2 Implement the auto-tag rule: any `test_report` whose
  `test_registration_id` is unset SHALL be persisted with
  `caveats: ["unregistered"]`. **Acceptance:** integration test runs an
  unregistered script and the resulting `test_report` carries the caveat.

---

## Phase B — `audit-test-report` Activity

### B.1 Activity scaffolding

- [ ] B.1.1 Embedded template under
  `repos/minibob/src/embedded-templates/audit-test-report.json` declaring
  `inputShapes: ["test_report", "test_registration"]` and
  `outputShapes: ["test_audit_report"]`. Four tasks per `design.md` §B.2.
  **Acceptance:** template loads at startup; dispatches via
  `lifecycle:execution:succeeded` with shape filter.
- [ ] B.1.2 Lifecycle subscription filter implemented in
  `repos/minibob/src/embedded-templates/index.ts`. **Acceptance:** dispatch
  occurs only when the lifecycle event carries `output_shapes ∋ "test_report"`.

### B.2 Deterministic checks (tasks 1–3)

- [ ] B.2.1 `check_decision_record_complete` — re-uses the
  `decision_record_completeness` schema from
  `multi-witness-verification/spec.md:43-49`. **Acceptance:** correctly flags a
  report missing `candidates[].rrf_score`.
- [ ] B.2.2 `check_witness_presence` — verifies the report carries ≥ 1 witness
  type from `test_registration.witness_types`. **Acceptance:** single-witness
  report tagged `passed_with_caveat: "single_witness"`.
- [ ] B.2.3 `check_sensitivity_evidence` — queries `sensitivity_evidence`
  impulses ≥ 7 days back and ≥ 3 runs per perturbation; computes per-perturbation
  observed delta vs expected. **Acceptance:** test fixture with synthetic 7-day
  evidence correctly classifies sensitive/insensitive/noisy.

### B.3 LLM alignment-claim resolver (task 4)

- [ ] B.3.1 `review_alignment_claim` task using the standard `llm` resolver with
  Haiku tier and a `≤ $0.05` budget. Prompt: see `design.md` §A.2 — verdict is
  one boolean + rationale. **Acceptance:** prompt fixtures produce stable
  verdicts across two consecutive runs.
- [ ] B.3.2 LLM verdict surfaces as a `validation_result` impulse with
  `failure_mode.context.audit_subtype = "audit_misaligned"` on `passed: false`.

---

## Phase C — `run-sensitivity-probe` Activity

### C.1 Probe runner

- [ ] C.1.1 Embedded template
  `repos/minibob/src/embedded-templates/run-sensitivity-probe.json` per
  `design.md` §C. **Acceptance:** dispatched manually against the
  `forge-goal-completion-test` registration, emits one `sensitivity_evidence`
  per scheduled perturbation.
- [ ] C.1.2 Perturbation-application helper resolver that applies a
  `Perturbation.transform` to a test's declared inputs. **Acceptance:** unit
  tests for `set_to_existing`, `unset`, `set:<value>` transforms.

### C.2 Cadence wiring

- [ ] C.2.1 `validation/scripts/run-weekly-harness.sh` extended to dispatch
  `run-sensitivity-probe` for each registered test once per week.
  **Acceptance:** weekly cron logs show one dispatch per registered test.
- [ ] C.2.2 `lifecycle:test_registration:updated` event handler triggers an
  immediate probe. **Acceptance:** updating a registration via
  `testRegistration_write` fires a probe within the next dispatch tick.

---

## Phase D — `debug-failing-audit` Activity

### D.1 Failure classifier

- [ ] D.1.1 Embedded template
  `repos/minibob/src/embedded-templates/debug-failing-audit.json`
  per `design.md` §D. **Acceptance:** dispatched against a fixture
  `test_audit_report` with `audit_subtype: "audit_insensitive"`, emits a
  `code_modification_proposal` referencing the originating report.

### D.2 Modification-proposal paths

- [ ] D.2.1 Test-only proposal: changes confined to `validation/scripts/`.
  **Acceptance:** `code_modification_proposal.risk_tier == "test_only"` for
  modifications touching only those paths.
- [ ] D.2.2 System proposal: changes outside `validation/scripts/`.
  **Acceptance:** `system_modification_proposal` emitted instead.
- [ ] D.2.3 Human-review fallthrough: when
  `verification_confidence < threshold`, emit `human_review_request`.
  **Acceptance:** fixture with low-confidence classification routes through
  the standard `HumanResolver` tier, not a separate path.

### D.3 Dedupe

- [ ] D.3.1 Lifecycle dedupe key
  `(test_registration_id, audit_subtype)`. **Acceptance:** two concurrent
  audits with the same subtype produce one proposal, not two.

---

## Phase E — Loop Wiring + Recursion Cap

### E.1 Subscription registration

- [ ] E.1.1 `audit-test-report` subscribes to
  `lifecycle:execution:succeeded` with filter
  `output_shapes ∋ "test_report"`. **Acceptance:** dispatch occurs for
  `test_report` emissions and only those.
- [ ] E.1.2 `debug-failing-audit` subscribes to the same lifecycle event with
  filter `output_shapes ∋ "test_audit_report" AND passed == false`.
  **Acceptance:** dispatch occurs only on failed audits.

### E.2 Recursion cap

- [ ] E.2.1 `audit-test-report` reads `composition_chain` depth at dispatch;
  if depth ≥ 2, emit `failure_mode: safety_breach { breach_type: "depth",
  limit: 2 }` and skip execution. **Acceptance:** synthetic meta-meta-audit
  chain produces the expected `safety_breach`.

---

## Phase F — Grandfather Existing Tests

- [ ] F.1 For each script in `validation/scripts/`, add a top-level
  `testRegistration` block. Order by recency of last edit; prioritise the
  Phase 18/19/22 acceptance tests (`test-18-3-5`, `test-18-4-7`,
  `test-22-forge-and-paths`, `reuse-harness`). **Acceptance:** ≥ 80% of
  scripts registered within 30 days of spec landing.
- [ ] F.2 Each registration sets `perturbation_schedule` with ≥ 2 perturbations
  and `goal_alignment` with ≥ 1 criterion. **Acceptance:** registration backlog
  shrinks to ≤ 20% of starting count.

---

## Phase G — Harness Integration

### G.1 Audit-summary emission

- [ ] G.1.1 `validation/scripts/reuse-harness.ts` emits a `test_report`
  impulse at end-of-run with the report JSON as `body`. **Acceptance:**
  `validation/results/<date>-reuse-report.json` carries a top-level
  `test_report_id` field referencing the emitted impulse.
- [ ] G.1.2 Harness fetches the audit result via the lifecycle subscription's
  completion event (timeout 10 min per `spec.md` R2) and writes
  `audit_summary` into the JSON report. **Acceptance:** report contains
  `audit_summary: { passed, audit_subtype?, caveats, sensitivity_observed }`.

### G.2 Weekly cron extension

- [ ] G.2.1 `run-weekly-harness.sh` triggers `run-sensitivity-probe` for every
  registered test in a second job after the main harness. **Acceptance:**
  weekly run produces both `<date>-reuse-report.json` and
  `<date>-sensitivity-report.json`.

---

## Phase H — Acceptance

- [ ] H.1 Registration coverage ≥ 80% — measurable from the
  `test_registration` index. **Reported in:**
  `validation/results/<date>-audit-coverage.json`.
- [ ] H.2 At least one autonomous test-modification PR landed via
  `debug-failing-audit` within 30 days. **Reported in:** PR description links
  to the originating `test_audit_report` id.
- [ ] H.3 Insensitive-test detection rate observable — surfaced in
  `audit_summary` aggregates over the trailing 30 days.
- [ ] H.4 Recursion cap holds on canary — no `composition_chain` depth > 2
  for any audit-of-audit trace. **Reported in:** weekly audit summary.
- [ ] H.5 No parallel witness machinery exists — code search for
  `test_witness` / `audit_witness` outside the multi-witness-verification
  module returns zero hits.
