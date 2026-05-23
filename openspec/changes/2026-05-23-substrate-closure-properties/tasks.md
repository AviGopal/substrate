# Tasks: Substrate Closure Properties

Each phase closes one of the seven enumerated closure gaps. Phases are
independently deployable; the order below reflects dependency
relationships (memory must land first because subsequent closure work
references substrate memory).

## Phase 1 — Memory closure

- [ ] 1.1 Add `memoryNote` shape to activity-api's
  `config.discovery.shapes` with body schema
  `{ id, type: "finding" | "feedback" | "reference", title, body, provenance_trace_ids[], confidence_weight, last_validated_at }`.
- [ ] 1.2 Add `memoryNote_write` shape (admin-gated) for `propose-spec`-style activities that emit notes.
- [ ] 1.3 Implement the resolver in development-vessel:
  - `finding` notes: ribosome extraction over successful resolution traces.
  - `feedback` notes: declared operator-state-import (one-time migration).
  - `reference` notes: external resource pointers (URLs, file paths, doc anchors).
- [ ] 1.4 One-time operator-state-import script
  (`scripts/substrate/import-operator-memory.ts`): reads the operator's
  current memory file structure and emits a series of
  `memoryNote_write` impulses tagged
  `provenance:operator-import-2026-05-23`. Run once at substrate boot;
  records which notes were imported in `init_imports` table.
- [ ] 1.5 Smoke test: `POST /v2/impulses/resolve` with
  `{ type: "memoryNote", filter: { type: "finding" } }` returns at
  least the imported finding set; ribosome adds new findings as
  successful resolutions traces accumulate.
- [ ] 1.6 Cache-equivalence test: with operator memory directory
  wiped, query `memoryNote` impulses and confirm the returned set
  matches what would have been recalled from the file directory
  (modulo confidence-weight downgrade from 1.0 to 0.4/0.6/0.7 per
  type).

## Phase 2 — Skill closure

- [ ] 2.1 For each slash-command skill, draft an activity template:
  - `propose-spec` (mirrors `/openspec-propose`)
  - `apply-spec` (mirrors `/openspec-apply`)
  - `archive-spec` (mirrors `/openspec-archive`)
  - `cleanup-docs` (mirrors `/jiggle-and-prune`)
  - `review-pr` (mirrors `/review`)
  - `audit-security` (mirrors `/security-review`)
  - `deploy-substrate` (mirrors `/deploy`)
  - `cron-dispatch` (mirrors `/loop`, `/schedule`)
- [ ] 2.2 Each template is added to ias-executor-ts `SHARED_TEMPLATES`
  so `bootstrap-seeder.service` seeds it at substrate boot.
- [ ] 2.3 Each template's `input_shapes` and `output_shapes` are
  declared rigorously; ribosome can extract them later if successful
  resolutions improve on them.
- [ ] 2.4 Smoke test: dispatch each activity via
  `POST goal-host-vessel:8210/run-goal { template_id: "propose-spec", ... }`
  and observe the result through standard trace inspection.
- [ ] 2.5 Operator slash-commands updated (optional, UX-only): each
  slash-command becomes a thin client that POSTs to goal-host-vessel
  with the corresponding template_id. The skill body stays for
  backwards compatibility.

## Phase 3 — Subagent closure

- [ ] 3.1 Draft `subagent-plan` activity template composing
  `llm-resolver-vessel` planning + `concept-db` pattern recall +
  `activity-api` Thompson-ranked candidate retrieval. Output shape:
  `executionPlan`.
- [ ] 3.2 Draft `subagent-explore` activity template composing
  `local-tools-vessel` (file/grep/find resolvers) + `concept-db`
  semantic indexing + `llm-resolver-vessel` summarisation. Output
  shape: `codebaseExplorationReport`.
- [ ] 3.3 Draft `subagent-general` activity template composing
  `goal-host-vessel` with multi-step `ExecuteOptions`. Output shape:
  `goalCompletionReport`.
- [ ] 3.4 Thompson-ranking: each subagent template's
  `(template, problem-class)` posteriors accumulate as substrate
  invocations succeed/fail. After ~50 dispatches, the substrate
  recommends which subagent template to use based on data.
- [ ] 3.5 Equivalence test: operator dispatches a research task via
  Plan subagent and via `subagent-plan` activity; outputs are
  comparable in completeness on a curated benchmark of 10 prompts.

## Phase 4 — CI closure

- [ ] 4.1 New activity `verify-merge-candidate`: takes a PR diff,
  applies it to a substrate image (via a fresh `bootstrap-seeder`
  re-run + the diff), runs failure-mode-harness + Phase 19
  reuse-validation harness against the patched substrate, emits a
  `mergeVerdict` impulse with `{ verdict: "pass" | "fail", evidence_trace_ids[] }`.
- [ ] 4.2 The activity runs in an isolated substrate clone (test
  substrate) so the canary substrate is not polluted by failed
  verifications.
- [ ] 4.3 GitHub Actions integration: a new workflow step calls
  `verify-merge-candidate` via the activity-api impulse path and
  blocks the merge on `verdict: "pass"`. The GitHub workflow itself
  is the *observer*; the verdict is substrate-authored.
- [ ] 4.4 Substrate-only verification path: a substrate cron activity
  fetches open PRs from GitHub via a read-only GitHub resolver,
  runs `verify-merge-candidate`, and writes verdicts to a
  substrate-resident dashboard. Operator can rely on substrate
  verdicts even with GitHub Actions disabled.

## Phase 5 — Self-healing closure

- [ ] 5.1 Draft activity `restart-vessel`: takes vessel identifier;
  dispatches `systemctl restart <vessel>.service` via
  local-tools-vessel; observes restart via
  `discovery-vessel:8100/registry/stats`; emits `recoveryReport`.
- [ ] 5.2 Draft activity `restore-from-backup`: takes backup
  identifier; performs SurrealDB restore via a privileged
  recovery-resolver; emits `recoveryReport`.
- [ ] 5.3 Draft activity `rerun-migration`: takes migration filename;
  invokes the migration runner with idempotency check; emits
  `recoveryReport`.
- [ ] 5.4 Draft activity `inspect-vessel-logs`: takes vessel
  identifier + time window; returns last N log lines as a
  `vesselLogExcerpt` impulse.
- [ ] 5.5 Draft activity `dispatch-debug-probe`: takes failure
  description; runs a stratified-goal-generator probe targeted at
  the failure surface; emits `debugProbeReport`.
- [ ] 5.6 Foreseeable-failure recovery test: kill an arbitrary
  substrate vessel (goal-host, llm-resolver, ribosome, boredom);
  substrate self-heals via `restart-vessel` activity within 60s
  with no operator intervention.
- [ ] 5.7 Unforeseeable-failure boundary test: simulate a SurrealDB
  data-volume corruption; substrate emits `requireHumanIntervention`
  impulse rather than attempting auto-recovery. Confirms §27.3.c
  boundary remains intact.

## Phase 6 — Spec-authoring closure

- [ ] 6.1 Draft `foundation-compliance` validator-as-activity. Inputs:
  a candidate spec impulse + the foundation doc + the existing
  IAL's accepted-pattern catalogue. Output: `validation_result`.
  Rules encoded: no new REST endpoints for single-use queries; no
  treating activity-api as universal resolver; no LLM processing
  raw data instead of metadata; activities must record traces;
  resolvers must live where data lives.
- [ ] 6.2 Draft `cross-spec-consistency` validator-as-activity.
  Inputs: candidate spec + all accepted specs in `openspec/changes/`.
  Output: `validation_result` flagging conflicts with prior
  decisions.
- [ ] 6.3 Draft `propose-spec` activity (composes ribosome
  extraction + spec-template instantiation + foundation-compliance
  + cross-spec-consistency). Input: a successful resolution trace
  pattern. Output: `specProposal` impulse with `proposal.md` +
  `tasks.md` + `spec.md` bodies.
- [ ] 6.4 Substrate dispatches `propose-spec` activities against the
  ribosome-extracted pattern library. At least three resulting
  proposals pass both validators and are merged through Phase 4's
  CI-closure path. Provenance recorded in proposal's frontmatter:
  `authored_by: substrate-propose-spec`, `extracted_from_trace_ids: [...]`.

## Phase 7 — Closure-audit

- [ ] 7.1 Draft `validation/scripts/closure-audit.ts`. Parametric in
  `--without=<external-tool>`: when invoked with
  `--without=operator-memory`, the script attempts each §27.1/§27.2
  lift property using substrate-only resolvers; failures
  enumerated in output.
- [ ] 7.2 Tools recognised by the audit:
  `--without=operator-memory`,
  `--without=slash-skills`,
  `--without=subagents`,
  `--without=github-actions`,
  `--without=operator-shell`,
  `--without=operator-spec-authoring`.
- [ ] 7.3 Output `validation/state/closure-status.json`:
  `{ properties: {<id>: { closed: bool, missing_deps: [...] } }, audit_run_at, audit_tool_versions }`.
- [ ] 7.4 Substrate cron activity `nightly-closure-audit` runs the
  script with each `--without=*` option in turn. Results aggregated
  into the status file. Failures emit a `lifeBlocker` impulse for
  operator review.
- [ ] 7.5 IAL §27.S.1 acceptance gate updated to require closure-audit
  green for three consecutive nightly runs.

## Phase 8 — IAL integration

- [ ] 8.1 Amend IAL `tasks.md` Phase 27.3 with §27.3.i (seven items
  matching Phases 1–7 above).
- [ ] 8.2 Amend IAL `tasks.md` Phase 27.S.1 to require §27.3.i green.
- [ ] 8.3 Amend IAL `proposal.md` New Capabilities list with this
  change.
- [ ] 8.4 Update CLAUDE.md "Pre-lift readiness" section (creating it
  if absent) to document the closure principle.

## Order rationale

Phase 1 (memory) lands first because subsequent phases reference
substrate-resident memory. Phase 2 (skills) lands second because
activity templates are the primary form for closure mechanics.
Phase 3 (subagents) builds on skill closure: subagent-flavoured
activities compose skill-flavoured ones. Phase 4 (CI) lands next:
once skills and subagents are substrate-resident, the verification
path can be substrate-resident. Phase 5 (self-healing) lands after
Phase 4: recovery activities depend on the merge-gate clarity Phase 4
brings. Phase 6 (spec-authoring) is the most ambitious, gated on
Phases 1–5 producing enough trace data for ribosome to extract
patterns. Phase 7 (closure-audit) lands continuously through 1–6
and reaches full coverage when all phases are green. Phase 8 (IAL
integration) is the documentation gate.
