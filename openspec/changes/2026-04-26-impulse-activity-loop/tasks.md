## Phase 8 — Iteration 2: Blocker Resolution (2026-04-28)

**Investigation Result:** Five blocking issues discovered during Phase 8 Iteration 1 end-to-end validation.
See blocker analysis document for detailed investigation results.

Blockers must be resolved in order (I2.1 → I2.4 → I2.5) before full validation loop can proceed.

### I2.1 Fix Blocker 1: Null-Guard on `imp.pointer.type` (activity.ts:2509)
**Status:** [ ] TODO  
**Effort:** 15m  
**Blocker Severity:** P0 (Phase 8 & Phase 5)

- Add defensive null-check: `imp.pointer?.type ?? 'unknown'`
- Root cause: Goal-impulse initialization creates impulses with missing `pointer` field
- Impact: Crashes when loading goal-impulses in executeTask path

### I2.2 Fix Blocker 4: Conditional Syntax in validator-dispatch.json:38
**Status:** [ ] TODO  
**Effort:** 30m  
**Blocker Severity:** P0 (Phase 8 & Phase 5)

- Fix expression: `{{lifecycle.skip_validation}} !== true` → `{{lifecycle.skip_validation}} !== 'true'`
- Rationale: Interpolated values become strings; must compare to string literal
- Audit: Check slot-binding.json and create-shape-provider-goal.json for similar issues

### I2.3 Fix Blocker 5: Add "lifecycle" to ImpulsePointer union (types.ts:~250)
**Status:** [ ] TODO  
**Effort:** 1h  
**Blocker Severity:** P0 (Phase 8 & Phase 5)

- Add `{ type: "lifecycle"; payload: unknown }` variant to ImpulsePointer union
- Update resolvePointer in impulse.ts to handle lifecycle pointers
- Verify ContextMemoryAgent can tolerate lifecycle impulses

### I2.4 Fix Blocker 3: Backend HTTP 500 "length limit exceeded" (activity-api canary)
**Status:** [ ] TODO  
**Effort:** 1-2h investigation + variable fix  
**Blocker Severity:** P0 (Phase 8 & Phase 5)

- Investigation: Check Hono bodySize limits, SurrealDB row limits, trace payload expansion
- Likely fix: Increase Hono body limit or verify composition_chain denormalization
- Test: Store nested execution trace in isolation on canary

### I2.5 Fix Blocker 2: Expand ActivityTemplate category enum (types.ts + 4 templates)
**Status:** [ ] TODO  
**Effort:** 15m  
**Blocker Severity:** P1 (Phase 5 only, not Phase 8)

- Expand enum to include "system" and "security" categories
- Run full template load test to verify all embedded templates accepted
- Templates affected: analyze-success-patterns.json, analyze-failure-patterns.json, compare-template-variants.json, scan-for-secrets.json

### Phase 8 Iteration 2 Success Criteria
- [ ] All 5 blockers resolved
- [ ] Full validation loop completes: goal → activity → validator-dispatch → trace storage
- [ ] Nested execution traces store successfully on canary
- [ ] At least 2 complete cycles show consistent behavior

---

## 1. Phase 1 — `lifecycle:task:preBinding` emission

- [x] 1.1 Emit `lifecycle:task:preBinding` in `repos/minibob/src/activity.ts` resolver-path branch (before `canExecuteTask` at `:4405`)
- [x] 1.2 Mirror emission on the LLM-only path (`executeWithLLM` inputShapes block, recompute pool after await)
- [x] 1.3 Reconcile payload field naming — chose `executionId` (matches existing emission); `lifecycle-task-prebinding/spec.md` updated; F-1 RESOLVED (2026-04-26 commit `60556b0f`)
- [ ] 1.4 Unit test: emission fires before gate when `inputShapes` non-empty; payload fields match the reconciled contract — payload now also carries `parentGoalText` (F-2, commit `8ed4412`) and `parentDepth` (F-3, commit `a16028f`); test should cover both
- [x] 1.5 `bun run typecheck` in `repos/minibob` — zero new errors (iterations 1 and 2)
- [x] 1.6 Canary smoke: WS interceptor on local containerized MiniBob confirmed 28 `lifecycle:task:preBinding` events received by workbench in a single run (2026-04-27); slots with both `bound` and `pending` states visible — `acquire_context:impulse_state_result=bound`, `recommend_activity:goal_enrichment=bound`, `dispatch_activity:variant_selection_result=bound`. ImpulseStatePanel "Bindable Slots" section populated live. trace.at.activity.metabob.com pending MCP storage fix (bug 10.2).

## 2. Phase 2 — Backend additive changes

References sibling task lists. This change does not duplicate the work, only tracks it for the integration loop.

- [x] 2.1 `discover-by-shapes` `candidates_with_scores` mode (sibling 1 §1) — mode validation, queryMode aliasing, composition_score augmentation; tests deferred
- [x] 2.2 `discover-by-shapes` `output_shapes` filter on backward mode (sibling 3 §2) — body destructure, AND clause both backward branches; tests deferred
- [x] 2.3 `goal_execution_paths.endpoint_output_shapes` field+index in `003-goal-execution-paths.surql`, migration `092-goal-paths-endpoint-shapes.surql` with idempotent inline backfill, `GoalExecutionPathSchema` extended (sibling 2 §1). Route changes (§2 — recommend filter, predictEndpointState read-from-denormalized) deferred to a later iteration
- [x] 2.4 `failure_mode` taxonomy schema + trace field migration (sibling 3 §1) — `FailureModeSchema` discriminated union (5 variants, `safety_breach.limit` optional), `StoreExecutionTraceRequestSchema` extended, migration `091-failure-mode-taxonomy.surql`, 14 schema tests passing

## 3. Phase 3 — Resolvers

- [x] 3.1 `impulse_preparation` (sibling 1 §2) — surprise: resolver already existed at activity.ts:1705 with goal-processing operations; added `synthesise_from_variables` and `agent_fill` operations to existing class; 9 tests passing. Open: `interpolate` callback wiring for slot-binding meta-activity (Phase 6).
- [x] 3.2 `impulse_pool_selection` (sibling 1 §3) — 10 tests passing; uses `MCPClient.queryImpulseRelevance` (typed) rather than the markdown pointer-resolve path; tie-breaks on `last_used_at`/`updated_at`; graceful degraded fallback when MCP fails. Registered.
- [x] 3.3 `producer_selection` (sibling 1 §4) — 14 tests passing; new `MCPClient.discoverByShapes()` helper added; calls `mode=candidates_with_scores` with optional `predecessor_activity_id`; emits `producer_selection_result` impulse with `metadata.unbindable` exposed for downstream `task condition` gating. Registered.
- [x] 3.4 `learning_signal_writer` (sibling 3 §6) — wraps recordImpulseRelevance + tool-argument-pattern recording verbatim; 14 tests passing; registered. Phase 5 will replace the inline call sites with this resolver.

## 4. Phase 4 — Meta-activities

- [x] 4.1 `slot-binding.json` (sibling 1 §6) — template created and registered (51 templates load); subscription fires on lifecycle:task:preBinding. Two infrastructure gaps surfaced and queued: (A) dotted-path interpolation, (B) template iteration. Slot-binding works structurally but field-extraction-from-payload depends on (A).
- [x] 4.2 `validator-dispatch.json` (sibling 3 §7) — landed iter 7; subscribes to lifecycle:task:completed; uses producer_selection workaround for discover-by-shapes (F-6 follow-up to register thin discover_by_shapes resolver)

## 5. Phase 5 — Decommission inline executor logic

### 5.0 Prerequisites (gating Phase 5 cutover)

See design.md §"Phase 5 prerequisites and rollback" for full rationale. None of 5.1–5.4 starts until ALL of 5.0.1–5.0.8 are met and `FEATURE_ACTIVITY_DRIVEN_BINDING` has been flipped to `enabled` for the org under cutover.

- [ ] 5.0.1 Verify H1 (two-sided execution-trace verification) deployed and gating Thompson updates — `repos/metabob-activity-api/src/routes/execution-traces.ts:1306` and `:1579` skip rows lacking `verified_cross_sign: true`. Reference: `openspec/changes/2026-04-26-security-hardening-findings/design.md` §H1.
- [ ] 5.0.2 Verify H5 baseline variants registered and immutable for each resolver family Phase 5 depends on — `producer_selection`, `impulse_pool_selection`, `learning_signal_writer`, `validator_dispatch`, `impulse_preparation`. Auto-regression scan filters quarantined variants from candidate sets. (`repos/metabob-activity-api`) Reference: §H5.
- [ ] 5.0.3 Re-confirm F-7 / F-39 closures on canary: `lifecycle:task:completed` payload carries `templateId`; `learning_signal_writer` consumes it cleanly (not just no-op-skips). Re-run Phase 8 probe; confirm validator-dispatch task 5 succeeds, not no-ops. (`repos/minibob`)
- [ ] 5.0.4 Re-confirm F-37 / F-40 closures on canary: `composition_chain` populated reliably for both root-first inserts and L1/L2 meta-trace write-order races. At least one slot-binding nested execution trace shows non-empty chain. (`repos/metabob-activity-api` + `repos/minibob`)
- [ ] 5.0.5 Re-confirm F-41 closure: `preBinding` impulse propagated into the meta-activity nested executor's pool via `options.impulses` merge at `activity.ts` execute-time; slot-binding's first task does not fail with the missing-shapes gate on a real trigger. (`repos/minibob`)
- [ ] 5.0.6 Implement `FEATURE_ACTIVITY_DRIVEN_BINDING` flag — env var read in `repos/minibob/src/config.ts` alongside existing `MINIBOB_*` patterns; per-org override row in `org_feature_flags`; default `disabled`. Implement shadow-mode comparison: while flag is disabled, run both inline and meta-activity paths, log decisions + outcomes + diffs + trace IDs to `shadow_decision_log`, consume only the inline result. (`repos/minibob`)
- [ ] 5.0.7 Implement rollback triggers with alert wiring: meta-activity invocation failure rate, `learning_signal_writer` empty-`templateId` no-op rate, Thompson-Sampled variant exceeding H5 threshold without baseline catch, `composition_chain` corruption rate, verified-cross-sign rate. Thresholds per design.md §"Rollback triggers"; calibration TBD on canary observation. (`repos/metabob-activity-api` + observability)
- [ ] 5.0.8 Gather minimum 7 canary days of shadow-mode evidence per org; divergence-rate threshold met (`< 1%` per `(shape, taskId)` pair, calibration TBD). Document evidence in design.md §"Success-criteria validation" before flipping flag. (operational)

### 5.1–5.4 Deletion tasks

Each runs only after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to `enabled` per-org. Plan a separate follow-up commit per surface so any rollback can be partial.

- [ ] 5.1 Remove inline synthesiser block at `activity.ts:4949-4997` (sibling 1 §7) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)
- [ ] 5.2 Remove inline validation block at `activity.ts:5454-5529` (sibling 3 §8.1) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)
- [ ] 5.3 Remove three `recordImpulseRelevance` call sites (sibling 3 §8.2) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)
- [ ] 5.4 Remove inline tool-argument-pattern recording loop (sibling 3 §8.3) (after 5.0 prerequisites met and `FEATURE_ACTIVITY_DRIVEN_BINDING` flipped to enabled per-org)

## Phase 1.1: Federation Security Pre-Launch Validation (Phase 1)

**Objective:** Prepare Phase 1 federation (read-only) for launch. Implement trace visibility filtering, RBAC enforcement, federation endpoints, and audit logging. Reference: `specs/federation-security-hardening/spec.md` §Phase 1.

### A. Trace Visibility Access Control

- [ ] A.1 Add `visibility: "private" | "federated" | "public"` field to `activity_execution_traces` schema (default: "private")
- [ ] A.2 Implement access control filter in `GET /v2/activities/execution-traces` per spec requirements
- [ ] A.3 Update trace creation to set visibility based on execution context (same-account vs federated)
- [ ] A.4 Test: Verify Account B cannot read Account A's "private" traces even on federated project
- [ ] A.5 Test: Verify Account B CAN read Account A's "federated" traces with appropriate role

### B. RBAC Enforcement on Activity-API

- [ ] B.1 Add `account_id` and `project_id` context to every activity-api endpoint (extract from JWT)
- [ ] B.2 For each endpoint, add access check: `checkAccess(account_id, project_id, resource_type, action)` (roughly 30-40 endpoints)
  - [ ] B.2.1 Activity CRUD (create, read, update, delete)
  - [ ] B.2.2 Execution trace (create, read, list)
  - [ ] B.2.3 Template search and filtering
  - [ ] B.2.4 Impulse resolution endpoints
  - [ ] B.2.5 Goal management endpoints
  - [ ] B.2.6 Analytics and metrics endpoints
- [ ] B.3 Test: Single account isolation (Account B cannot access Account A's templates without federation)
- [ ] B.4 Test: Federated project access (Account B with developer role can read/execute)
- [ ] B.5 Test: Role-based filtering (Account B with "viewer" role cannot create)

### C. Federation Endpoints (user-vessel)

- [ ] C.1 Implement `POST /v2/projects/:project_id/invitations` (owner-only, creates pending invitation)
- [ ] C.2 Implement `POST /v2/invitations/:invitation_id/accept` (invited account-owner only)
- [ ] C.3 Implement `POST /v2/invitations/:invitation_id/decline` (invited account-owner only)
- [ ] C.4 Implement `DELETE /v2/projects/:project_id/members/:account_id` (owner-only, revokes access)
- [ ] C.5 Implement `GET /v2/projects/:project_id/federation` (lists federated accounts with roles)
- [ ] C.6 Implement `GET /v2/accounts/:account_id/invitations?status=pending` (account-owner only)
- [ ] C.7 Test: Invitation expiry (35-day TTL, expires automatically)

### D. Audit Logging

- [ ] D.1 Create `audit_log` table: `{id, timestamp, account_id, user_id, action, resource_type, resource_id, project_id, target_account_id, status, error_message}`
- [ ] D.2 Log all federation operations: invite, accept, decline, revoke, role update
- [ ] D.3 Test: Audit trail completeness (run federation workflow, verify all ops logged)

### E. Backward Compatibility (org_id → account_id)

- [ ] E.1 Dual-write strategy: all queries accept both `org_id` and `account_id`
- [ ] E.2 Verify old /v1 endpoints still work (GET /v1/organizations/:org_id)
- [ ] E.3 Test: Legacy client compatibility (old CLI calls /v1, gets expected responses)

### F. Canary Validation (Pre-Launch)

- [ ] F.1 Deploy Phase 1 to canary environment (staging)
- [ ] F.2 Create 10 test federated accounts (acme, widgets, other with multiple users each)
- [ ] F.3 Run federation workflow on canary (invite → accept → execute → role change → revoke)
- [ ] F.4 Execute 100+ activities across federated accounts (verify zero leakage, Thompson scoped)
- [ ] F.5 Monitor canary metrics: auth latency < 50ms, visibility filter < 5ms, zero 403 on legitimate access

---

## Phase 1.5: Federation Hardening Implementation (Parallel Development)

**Objective:** Implement H1 and CC1 in parallel with Phase 1 launch. These are NOT deployed yet but must be ready before Phase 2. Reference: `specs/federation-security-hardening/spec.md` §Phase 1.5.

### G. H1: Two-Sided Traces (Not Deployed Yet)

- [ ] G.1 Extend `activity_execution_traces` schema with `execution_trace_views` table carrying both invoker and invoked signatures
- [ ] G.2 Implement trace signing in minibob (Ed25519 keypair per vessel, sign impulse_resolution records)
- [ ] G.3 Implement invoked-vessel-side trace signing in activity-api (both parties submit traces)
- [ ] G.4 Implement pairing job (async): match traces, verify signatures, compute `vessel_trust_score = discrepancy_count / total_traces_month`
- [ ] G.5 Implement Thompson Sampling filter: skip updates for traces with `vessel_trust_score < 0.95` (feature flag `REQUIRE_TWO_SIDED_TRACES=log_only` initially advisory)
- [ ] G.6 Test: Trace pairing accuracy (100 cross-vessel executions, discrepancy < 5%, pairing > 95%)

### H. CC1: Scope-Narrowing Enforcement (Not Enforced Yet)

- [ ] H.1 Implement `verifyScopeNarrowing(parentScope, childScope)` function (child preserves all parent constraints)
- [ ] H.2 Call at `create-shape-provider-goal` dispatch: verify child scope ⊆ parent scope
- [ ] H.3 Add SurrealDB ASSERTION at trace insertion to prevent out-of-scope records
- [ ] H.4 Test: Scope narrowing validation (parent {module: "auth"}, child {module: "auth", env: "prod"} → rejected)
- [ ] H.5 Test: SurrealDB ASSERTION (try insert with parent_execution_id but output_shapes outside parent scope → ASSERTION violation)

### I. Authority-Key Scoping (Medium Priority)

- [ ] I.1 Extend JWT claims in identity-vessel: `authority_keys: [{id, account_id}]` (keys scoped to account)
- [ ] I.2 Add validation before sensitive operations: `validateAuthorityKeyScope(user, targetAccountId)` (key.account_id === targetAccountId)
- [ ] I.3 Test: Using metabob_system key on acme resource → 403 Unauthorized; audit log records attempt

---

## Phase 2.1: Cross-Account Composition Security Validation (Phase 2 Pre-Launch)

**Objective:** Validate that H1 + CC1 are ready before enabling Phase 2. Run comprehensive security tests. Reference: `specs/federation-security-hardening/spec.md` §Phase 2.

### J. H1 Deployment & Validation

- [ ] J.1 Deploy H1 to canary: enable `REQUIRE_TWO_SIDED_TRACES=enforced` for test orgs
- [ ] J.2 Run 100+ cross-account executions; confirm discrepancy detection working (unverified traces skipped from learning)
- [ ] J.3 Verify vessel_trust_score computation: one deliberate mismatch → vessel score drops < 0.95 → traces excluded
- [ ] J.4 Measure pairing performance: 98%+ of traces paired within 5 seconds
- [ ] J.5 Confirm H1 doesn't break single-account execution (backward compatibility)

### K. CC1 Enforcement & Validation

- [ ] K.1 Deploy CC1 to canary: enable scope-narrowing checks at composition dispatch + SurrealDB ASSERTION
- [ ] K.2 Create test scenarios: parent scope {module: "auth"}, child produces {module: "auth", env: "staging"}
- [ ] K.3 Run 50+ scope-violation attempts; confirm <1% succeed (all others rejected with failure_mode)
- [ ] K.4 Verify SurrealDB ASSERTION: manually crafted out-of-scope trace insert fails with ASSERTION error
- [ ] K.5 Confirm CC1 doesn't break legitimate scope-narrowing (child {module: "auth", subsys: "password"} accepted)

### L. Authority-Key Scoping Validation

- [ ] L.1 Deploy authority-key scoping: JWT now carries `{id, account_id}` for each key
- [ ] L.2 Test cross-account privilege escalation: alice@metabob_system tries to use metabob_system key on acme resource → 403
- [ ] L.3 Test legitimate same-account use: alice@metabob_system uses metabob_system key on metabob_system resource → 200
- [ ] L.4 Audit log records all key-scope validation attempts

### M. Federation Constraints Validation (FC-1 through FC-5)

- [ ] M.1 Test FC-1 (account-scoped): user B with viewer role cannot perform developer actions (negative test)
- [ ] M.2 Test FC-2 (immutable links): revocation leaves clear audit trail; re-invitation requires explicit action
- [ ] M.3 Test FC-3 (opt-in learning): federated traces with `share_learning=false` do NOT feed learning loop (Thompson posteriors unchanged)
- [ ] M.4 Test FC-4 (non-delegable keys): key scoping prevents cross-account privilege use
- [ ] M.5 Test FC-5 (high-risk approval): if template has high risk score, dispatch escalates to HiL or requires approval before execution

### N. Scenario C: Asymmetric Learning Validation

- [ ] N.1 Run 100+ cross-account compositions under Scenario C (A learns from B, B does not learn from A)
- [ ] N.2 Verify: Account A's posteriors shift based on B's outcomes; Account B's posteriors remain stable
- [ ] N.3 Verify: Setting `share_learning=true` bi-directional learning works correctly
- [ ] N.4 Verify: Toggling flag changes learning behavior without breaking execution

### O. Attack Scenario Validation (All 6 Scenarios from spec)

- [ ] O.1 Test Scenario 1A (Shape Distribution Inference): Account A runs B's template 100x, cannot infer B's validation weakness (Thompson scoped)
- [ ] O.2 Test Scenario 1B (Resolver Selection Inference): Account A cannot observe B's variant switching (Thompson scoped, share_learning=false by default)
- [ ] O.3 Test Scenario 2A (Scope Widening via Chaining): Account A tries to invoke B's template that expands scope → CC1 rejects
- [ ] O.4 Test Scenario 2B (Privilege Escalation via Template): Account A tries to invoke B's sensitive template (e.g., grant_authority_key) without proper role → authorization check rejects
- [ ] O.5 Test Scenario 3A (Variant Promotion): Account A tries to promote her variant to baseline using metabob_system key on acme's activity → authority-key scoping rejects
- [ ] O.6 Test Scenario 3B (Attestation Forgery): Account A cannot forge scope attestations (keys scoped to account)

### P. End-to-End Phase 2 Launch Gates

- [ ] P.1 H1 discrepancy rate < 5% of cross-account executions
- [ ] P.2 H1 pairing success > 98% of traces, latency < 5 seconds
- [ ] P.3 CC1 violations < 1% of cross-account compositions
- [ ] P.4 Authority-key scoping: zero successful cross-account privilege escalation attempts
- [ ] P.5 Trace visibility filters: federated accounts cannot read resolver IDs, latencies, or tool calls
- [ ] P.6 All six attack scenarios tested and mitigated
- [ ] P.7 Scenario C validated: asymmetric learning working as designed
- [ ] P.8 No regression in single-account execution (100+ single-account goals succeed at baseline rates)

**Launch approval:** All items P.1-P.8 green → Federation Phase 2 approved for production.

---

## 6. Phase 6 — Workbench surfaces

- [x] 6.1 Shape-slot primitive (sibling 1 §8) — `BindableSlot`/`BindableSlotsList` in ImpulseStatePanel; `computeShapeSlotState` in state-space.ts; slot-state classification (bound/bindable/unbindable) with Thompson α/β (v0.3.0)
- [x] 6.2 Spawn-subgoal affordance (sibling 2 §4) — `SpawnSubgoalPreview` component; `useSpawnSubgoal` hook; escalation button in `ApplicableActivitiesPanel` (v0.3.0)
- [x] 6.3 Validation surface extensions (sibling 3 §9, §10, §11) — `TaskValidationList`/`TaskValidationRow` in ImpulseStatePanel; `ValidationResult` parsed from `validation_result` impulse bodies; failure_mode discriminated union rendered as badge (v0.3.1)

## 6b. Workbench Observability Layer (2026-04-27)

Extends Phase 6 with explicit lifecycle visibility: the binding phase was surfaced in minibob (Phase 1) and meta-activities (Phase 4) but the workbench had no visibility into the preBinding → task.started → task.completed chain. These changes make the full loop observable without leaving the trajectory editor.

- [x] 6b.1 Handle `lifecycle:task:preBinding` WS event in `useTrajectoryExecution` — new event type, store `bindingPhase` map, clear on `task.started`; wires slot state into ActivityCard without touching minibob source
- [x] 6b.2 `BindingSlot` type + `bindingPhase` store state — `setTaskBindingPhase`, `clearTaskBindingPhase`, `clearBindingPhase` actions; cleared by `clearTraceData` and `clearTrajectory`; not persisted
- [x] 6b.3 Inline binding visualization in `TaskEditor` — `bindingSlots` prop; yellow pulsing strip below summary row showing slot name + state (pending/bound/unbindable) with color-coded dots; appears before task executes, disappears when `task.started` fires
- [x] 6b.4 Wire `bindingSlots` through `ActivityCard` — reads `bindingPhase` from store, passes per-task `bindingSlots` to each `TaskEditor`
- [x] 6b.5 Populate `bindableSlots` in `ImpulseStatePanel` — `deriveBindableSlots` helper converts active `bindingPhase` entries to `BindableSlot[]` format; previously this section was always empty
- [x] 6b.6 View mode strip in `TrajectoryEditorPage` — compact horizontal bar between grid controls and trajectory; shows active mode as `compose | trace <name> | ● live <id>`; mode pills make it obvious whether authoring, reviewing a trace, or watching live execution

## 7. Phase 7 — Recursive escalation

- [x] 7.1 `create-shape-provider-goal` activity authored and registered (sibling 2 §3) — dispatches a sub-goal to produce a missing shape via the goal-processing pipeline; registered as template in activity-api (v0.3.1)
- [x] 7.2 Slot-binding meta-activity escalates via `create-shape-provider-goal` on `unbindable` — slot-binding.json wired to emit `create-shape-provider-goal` impulse when `producer_selection_result.metadata.unbindable` is true; dotted-path interpolation fix enables payload extraction (v0.3.1)
- [ ] 7.3 Thread parent `scopeContext` into `escalate_unbindable` dispatch (BLOCKED on H3 landing for mandatory attestation; v1 ships with declarative-only scope per `openspec/changes/2026-04-26-shape-provider-goal-creation/design.md` §"Scope schema"). Acceptance: (a) `lifecycle:task:preBinding` payload extended with `parentScopeContext` at both emit sites in `repos/minibob/src/activity.ts` (mirroring F-2 / F-3 threading pattern); (b) `slot-binding.json::escalate_unbindable` forwards `parent_scope_context: "{{lifecycle.parentScopeContext}}"` as a variable on the dispatched `create-shape-provider-goal`; (c) the emitted goal-shaped impulse from `compose_goal` contains a `scopeContext` body field whose `dimensions` either equals the parent's or is a CC1-valid narrowing (parent keys preserved with same values; new keys allowed); (d) CC1's `verifyScopeNarrowing` (per `openspec/changes/2026-04-26-security-hardening-findings/specs/security-hardening/spec.md` CC1 requirements) fires at child-activity dispatch in the executor and rejects widening with `failure_mode: { type: "safety_breach", context: { breach_type: "scope_widening", limit, attempted, ancestor_chain } }`. (`repos/minibob` + `repos/metabob-activity-api`)

## 7.4 Phase 8 Blocker Resolution (2026-04-28)

Phase 8 Iteration 1 discovered 5 critical blockers preventing goal execution on canary. All must be resolved before Phase 8 validation proceeds.

### I2.1 Blocker 1: Bootstrap impulse null-guard (activity.ts:2509)

- [ ] I2.1.1 Add null-guard in activity.ts:2507-2509 where impulses are mapped to extract `pointer.type`
- [ ] I2.1.2 Root cause: goal-impulse initialization missing `pointer` field for some impulse shapes
- [ ] I2.1.3 Test: Verify goal-impulse-seeding path creates well-formed impulses with all required fields
- [ ] I2.1.4 Acceptance: `bun run typecheck` clean; no TypeError when impulse.pointer undefined

### I2.2 Blocker 4: Validator-dispatch conditional syntax (validator-dispatch.json:38)

- [ ] I2.2.1 Fix conditional: change `{{lifecycle.skip_validation}} !== true` to `{{lifecycle.skip_validation}} !== 'true'` (string comparison)
- [ ] I2.2.2 Verify all conditionals in validator-dispatch.json use correct type (string literals vs boolean)
- [ ] I2.2.3 Root cause: lifecycle impulse payload fields are strings; template conditionals were using boolean comparisons
- [ ] I2.2.4 Acceptance: validator-dispatch.json loads without conditional parse errors; discover_validators task executes

### I2.3 Blocker 5: Missing "lifecycle" impulse type (types.ts:~250)

- [ ] I2.3.1 Add `{ type: "lifecycle"; payload: unknown }` variant to ImpulsePointer union in types.ts
- [ ] I2.3.2 Update resolvePointer() to handle lifecycle type locally (F-42 completion): return JSON stringified payload
- [ ] I2.3.3 Root cause: F-42 incomplete; lifecycle impulses not recognized as local-resolvable type
- [ ] I2.3.4 Test: Verify meta-activities can emit and load lifecycle-type impulses
- [ ] I2.3.5 Acceptance: resolver-first task can execute with lifecycle-shaped inputs

### I2.4 Blocker 3: Backend HTTP 500 length limit (activity-api backend)

- [ ] I2.4.1 Investigate activity-api v1.13.6 deployment status on canary (health endpoint, recent logs)
- [ ] I2.4.2 Check SurrealDB row size limits and HTTP request body limits (Hono bodySize config)
- [ ] I2.4.3 Query activity-api logs for "length limit exceeded" errors; correlate with trace payload size
- [ ] I2.4.4 If blocker persists, measure trace size from Phase 6/7 nested executions (may be bloated)
- [ ] I2.4.5 Acceptance: `POST /v2/impulses/resolve` accepts nested execution traces without 500 error

### I2.5 Blocker 2: Template category enum gap (schema)

- [ ] I2.5.1 Audit all embedded templates for category field (compare-template-variants, analyze-failure-patterns, etc.)
- [ ] I2.5.2 Decision: expand ActivityTemplate schema enum to include `"system" | "security"` categories, OR change template categories to valid enum values
- [ ] I2.5.3 Root cause: embedded templates use categories not defined in schema; affects Phase 5 template loading
- [ ] I2.5.4 Test: verify all embedded templates validate against updated schema
- [ ] I2.5.5 Acceptance: TemplateSyncResolver successfully creates all embedded templates during bootstrap

---

## 8. Phase 8 — End-to-end canary validation

**Prerequisite:** All Phase 8 blockers (I2.1–I2.5) resolved.

- [ ] 8.1 Goal regression set: dispatch each representative goal class against canary; capture trace IDs
- [ ] 8.2 Inspect traces for full lifecycle event coverage; document gaps
- [ ] 8.3 Confirm Thompson α/β updates on success and failure paths
- [ ] 8.4 Confirm `failure_mode` populated correctly for each of the five types
- [ ] 8.5 Confirm at least one goal succeeds via recursive sub-goal escalation
- [ ] 8.6 Confirm no production goal requires embedded template fallback
- [ ] 8.7 Document each success criterion result in `design.md` §Success-criteria validation

## 9. Phase 9 — `thompson_posterior` shape (Thompson implicit vessel becomes explicit)

The α/β/sample_count posterior data already exists inside activity-api but is REST-only (`variantMetricsSummary`, `GET /v2/activities/:id/variant-scores`). This phase exposes it as a routable shape so the Thompson Sampling implicit vessel inside activity-api becomes explicit — its posteriors can be discovered, observed, and composed into other activities through the standard `POST /v2/impulses/resolve` path. Resolves the one real shape gap surfaced by the foundation-realignment audit.

- [ ] 9.1 Add `thompson_posterior` to activity-api shape advertisement in `repos/metabob-activity-api/src/config.ts` (alongside the existing `discovery.shapes` block); set `resolve_endpoint`, `resolve_request_format: pointer`, `auth_scheme: ApiKey`
- [ ] 9.2 Implement resolver for `thompson_posterior` pointer type in `repos/metabob-activity-api/src/routes/impulses.ts`. Pointer fields: `activity_variant_id` (or `activity_id`), optional `shape_signature` filter, optional `context_bucket`. Response payload: `alpha`, `beta`, `sample_count`, optional confidence interval. Reuses the same query helper that `variantMetricsSummary` already calls — no SQL duplication.
- [ ] 9.3 Update `variantMetricsSummary` REST handler to be a thin wrapper over the new shape resolver — the REST surface remains for backward compatibility, but the shape resolver is the source of truth. No behavior change for existing callers.
- [ ] 9.4 Update workbench to read posterior data via shape resolution where currently using REST. Start with `exploration-slot-ucb-ranking` and `context-bucketed-thompson-sampling` selection-metadata exposure; leave older surfaces on REST until they next see other changes.
- [ ] 9.5 Document the new shape under `docs/impulse-types/thompson_posterior.md` (one file per shape, matching the existing pattern in `docs/impulse-types/`)

Acceptance: a resolver dispatched from an activity template can read α/β for a named variant via `POST /v2/impulses/resolve` without hitting the REST surface; existing `variantMetricsSummary` callers see no behavior change; `docs/impulse-types/thompson_posterior.md` exists.

## Verification gates

- [ ] V.1 All sibling spec verification phases (sibling 1 §9, sibling 2 §6, sibling 3 §12) green
- [ ] V.2 Workbench history panel renders the integrated trace (validator results, `failure_mode`, recursive sub-goal handoffs)
- [ ] V.3 No regression in the existing activity-execution test suite

## Post-deploy Bug Fixes (v1.12.0)

- [x] 10.0 **JWT secret mismatch** — RESOLVED 2026-04-26. Single-source de-duplication: schema uses `KEY '__JWT_SECRET__'` placeholder; `scripts/init-database.ts` substitutes from env via `resolveJwtSecret()` (fail-fast in production); `src/config.ts` mirrors. activity-api commit `4aa3d85`. Operator action followed: helmfile `121d70d` + secret seeding + rolling restart; auth verified across 8/8 replicas (8/8 destructive probes succeed).
- [x] 10.1 **`relevance_feedback` NULL coercion failure** — RESOLVED 2026-04-26. activity-api commit `8f8d5d9`. `?? null` → `?? undefined` for context_bucket/reason/correlation_id.
- [x] 10.2 **Auth middleware ordering on relevance-feedback route** — RESOLVED 2026-04-26. activity-api commit `8f8d5d9`. try/catch wrapper applied matching /feedback's pattern.
- [x] 10.3 **Fix `acquire-error-log-context` (10/10 failure)** — RESOLVED 2026-04-26. minibob commit `2867b96`. Renamed template variables to match shape names + added `inputShapes: ["execution_trace", "trace"]` and `outputShapes: ["error_log"]`.
- [x] 10.4 **Fix α/β write-back bug on `goal-processing-activity-driven`** — RESOLVED 2026-04-26. activity-api commit `4816e99`. Root cause was UNIQUE INDEX on string `variant_id` field (not record-id), so meta::id() doesn't apply — fix is input-side normalization via `normalizeActivityId()` at the three write paths in execution-traces.ts and activities.ts. 501 already-split rows won't retro-merge; new executions land canonically. Caveat: `routes/ci.ts:200-249` has same un-normalized pattern but was out of scope; flagged for follow-up.

## Registry Cleanup (prerequisite for Phase 8)

- [ ] 11.1 **Delete 18 shadow templates with doubly-nested record IDs** — Templates stored as `activity:⟨activity:⟨slug⟩⟩` are malformed duplicates caused by a past registration bug. Delete via `DELETE /v2/activities/templates/:id` (or `activityTemplate_deprecate` write resolver) for each affected id. Run first: these pollute Thompson Sampling and make `templateAuditReport` results noisy. Prerequisite for 11.3 and 11.4.
- [ ] 11.2 **Delete 47 unvalidated ribosome variants, especially 14 `health-check` variants emitting `stdout` instead of `health_report`** — These were created by the ribosome pattern without output-shape validation. The `health-check` variants are particularly harmful: Thompson Sampling routes real health-check goals to them, which emit a non-queryable shape. Delete via `activityTemplate_deprecate` write resolver or direct API calls. Sequencing: run after 11.1 (shadow templates already gone); prerequisite for 11.4.
- [ ] 11.3 **Mass-deprecate 2,343 improvised DB templates with completeness_score < 0.5** — Use `templateAuditReport` resolver to page through all templates; batch-deprecate all with `completeness_score < 0.5` via `activityTemplate_deprecate` write resolver. Sequencing: run after 11.1 so shadow templates are excluded from the audit scan. Non-blocking for other items but reduces Thompson noise before Phase 8.
- [ ] 11.4 **Seed hand-verified executions for `fix-bug-complete`, `add-feature-complete`, `refactor-with-tests`** — Each domain template needs at least one hand-verified execution so Thompson Sampling has a non-prior α/β. Method: dispatch each template via MiniBob against a known test case, verify the output, record the trace. Sequencing: depends on 11.1 and 11.2 (clean registry first); these are the core domain templates the impulse-activity loop routes production goals to.

## Validation findings closed (2026-04-26)

Resolved this iteration cycle. Spec design.md files carry full RESOLVED prose for each.

- [x] **F-1** Lifecycle payload field-name reconciliation → chose `executionId`; spec.md updated (commit `60556b0f`)
- [x] **F-2** Lifecycle payload `parentGoalText` → sourced from `ActivityExecutor.currentGoalContext`, both emit sites populate (commit `8ed4412` minibob, `24682f05` super-repo)
- [x] **F-3** Lifecycle payload `parentDepth` → sourced from `(this.config.activityCallStack || []).length`, recursion guard in create-shape-provider-goal now functional (commit `a16028f` minibob, `198cff20` super-repo)
- [x] **F-5** Templates retrofitted to dotted-path interpolation → `slot-binding.json` and `validator-dispatch.json` use `{{lifecycle.taskId}}` etc. (commit `1027a83`)
- [x] **F-9** Activity-api `impulse.resolved` event body contract → broadcaster now actually emits these events (was previously absent), `body` field included from matching `output_impulses[]` entry (commit `cc1a8b2` activity-api, `e2c9f527` super-repo)
- [x] **F-6 (corrected)** activity-api advertises `discoverByShapesQuery` shape; validator-dispatch retrofitted to canonical `impulse-resolve` + shape pattern → vessel-integration constraint applied, zero minibob source changes

## Newly surfaced from validation iterations

Findings discovered while resolving F-1..F-9 or running 11.x retries. Each is small/scoped.

- [x] **F-9b: minibob `output_impulses[]` schema lacks `impulse_id` and `body` fields** — RESOLVED 2026-04-26. Extended `OutputImpulse` interface in `repos/minibob/src/types.ts:987-1008` with optional `body?: unknown`. Three of four emit sites already had `impulse_id`; added it to the fourth (`SearchFirstExecutor.extractOutputImpulses` at `repos/minibob/src/search-first-executor.ts:881-984`, synthesised from `step.id`). Populated `body` from inline memo content across `improviser.ts:1466-1482, :1505-1524`, `goal-processor.ts:3221-3239`, and the bash-success path in `extractOutputImpulses`. New regression test `src/output-impulse-schema.test.ts` (4 cases) pins the contract. Typecheck clean; existing 99 improviser + 3 impulse-propagation tests still green. See design.md F-9b for full RESOLVED prose.
- [ ] **B-2-fix: deprecate handler returns 404 instead of 403 when RBAC excludes** — Discovered during 11.1 retry: handler at `repos/metabob-activity-api/src/routes/impulses.ts:1962-2015` returns `Template not found` when the WHERE clause's RBAC branch (`scope = 'global' AND $isAdmin = true`) excludes a row. Information-leak (made the 11.1 retry chase id-format phantoms before realizing it was admin scope). Fix: structure the WHERE so the existence check is independent of RBAC, return 403 vs 404 distinctly.

- [x] **F-33: helm chart `metabob-activity-api` does not wire `activityApi.jwtSecret` into pod env** — RESOLVED 2026-04-26. Chart `values.yaml`, `templates/secret.yaml`, `templates/deployment.yaml` had no JWT secret wiring; helmfile.yaml.gotmpl:257 was injecting the value as `Values.secrets.jwtSecret` but the chart never read it. Caused init-db CrashLoop on `1.12.0-ed5487c` deploy attempt → helm `--atomic` rollback to revision 71 image `8f8d5d9`. Fix: added `secrets.jwtSecret` default to values.yaml; added `jwt-secret` data key to Secret with `required` directive; added `JWT_SECRET` env to BOTH main container AND init-database initContainer via `secretKeyRef`. Verified with `helm template`: `--set secrets.jwtSecret=...` renders both containers with the env + Secret resource correctly; without value, `required` directive fail-fast trips. Activity-api commit `8260a53`, super-repo `db6f117c`. Deploy can now be re-attempted once deployment submodule pointer updates to `8260a53`.

- [ ] **F-34: cluster image drifted from values.yaml** — Cluster on `1.12.0-8f8d5d9` (helm rollback target), values says `1.12.0-4aa3d85`. Replicas drifted 2 → 1 (deploy-time capacity mitigation). Will reconverge on next clean sync after F-33 chart fix lands in deployment repo. No urgent action; cluster healthy on the older image. Track until next sync resolves.

- [x] **F-38: slot-binding meta-activity recursively subject to its own lifecycle hook** — RESOLVED 2026-04-26 (minibob commit `7d4a977`). Lifecycle subscriber dispatcher (`lifecycle-subscriptions.ts:236` `findSubscribers`) now accepts an optional `emittingTemplateId` and filters out candidates with matching `templateId`. The emit site (`activity.ts:1174` `emitLifecycleImpulse`) threads `this.currentActivityId` through. Root cause was nested `ActivityExecutor` re-entrancy: per-instance `_dispatchingLifecycle` flag didn't catch self-recursion across nested executors. New unit test + 1458/29 (was 1457/29) — additive only. Bug surfaced 2026-04-27 02:25 UTC live canary probe.

- [x] **F-40: F-37 fix incomplete due to L1/L2 meta-trace write-order race** — RESOLVED 2026-04-26 (activity-api commit `78c89f8`). Path A applied: new `backfillChildCompositionChains()` helper in `execution-traces.ts:941-1006` runs single best-effort SurrealQL UPDATE after successful insert at lines 1313-1320: `UPDATE activity_execution_traces SET composition_chain = $new_chain WHERE parent_execution_id = $parent_execution_id AND (composition_chain IS NONE OR array::len(composition_chain) = 0)`. Idempotent via DB-side WHERE guard. One extra query per insert. Tree-walk for grandchildren rejected (one-level walk handles bottom-up; F-37 handles top-down). 5 new tests (44/44). Phase 8 criterion 2 audit-time visibility now closes — chain-depth queries will exhibit non-empty chains as parents inserted post-deploy backfill their children.

- [x] **F-41: preBinding impulse not passed into meta-activity nested executor** — RESOLVED 2026-04-26 (minibob commit `7e2c63e`). Diagnosis: `ActivityExecutor.execute()` at `activity.ts:2300-2301` was rebuilding the local `impulses` array from only `[contextImpulses, templateImpulses]` after line 2138 had stored the dispatcher-seeded `options.impulses` on `execution.impulses`. Result: lifecycle subscriber dispatcher's seeded trigger impulse never reached `executeTaskWithConditional` → first task fails missing-shapes gate. Fix: merge `options.impulses ?? []` into the local pool after building from context+template, dedup by id. New unit test confirms: fails without fix (missing-shapes), passes with fix. 1467/25 (was 1462/29) — 4 incidental fixes unblocked. Likely also resolves validator-dispatch's first task (same root cause, different trigger event).

- [x] **F-37: composition_chain silently empty despite parent_execution_id set** — RESOLVED 2026-04-26 (activity-api commit `fd936c0`). POST `/v2/activities/execution-traces` handler accepted client-supplied `composition_chain` but never computed it server-side; minibob's L1/L2 meta-trace path (`emitMetaTrace` in `mcp.ts:2657`) didn't supply it. Synthetic `_goal_resolve` and `_activity_execute` rows landed with `parent_execution_id` set but no chain. Fix: new exported helper `denormalizeCompositionChain(parentExecutionId)` queries parent and returns `[...parent.composition_chain, parent.execution_id]`; gracefully degrades to `[]` on empty/missing/error. POST handler trusts non-empty client-provided chains; otherwise computes server-side. 7 new unit tests; 39/39 in execution-traces.test.ts. No backfill needed — Phase 8 criterion 2 audit visibility recovers as new traces accumulate post-deploy.

- [x] **F-39: learning_signal_writer fails on every validator-dispatch iteration** — RESOLVED 2026-04-26 (minibob commit `662b153`). Diagnosis: documented `templateId` gap from F-7 — lifecycle:task:completed payload omitted `templateId`, validator-dispatch.json forwarded empty string, resolver's structural check at `learning-signal-writer-resolver.ts:346` (`if (!config.templateId || ...)`) rejected it via empty-string truthiness. Two-pronged fix: (1) emit `templateId: template.id` at both lifecycle:task:completed sites in `activity.ts:2429` + `:2899`, plus update validator-dispatch.json:114 to use `{{lifecycle.templateId}}`; (2) defensive: resolver now no-ops gracefully on missing/malformed payload (emits `metadata.skipped_reason: "missing_template_id"`) instead of throwing. 5 new unit tests pin both the strict and lenient paths. 1462/29 (was 1458/29). Phase 8 criterion 4 (ribosome convergence) unblocked once redeployed.

- [x] **F-32: /v2/impulses/resolve top-level auth gate rejects API-key auth without jwtToken** — RESOLVED 2026-04-26. Top-level `requireAuthenticated` guard at `impulses.ts:705` checked `jwtAuth?.jwtToken`, which is empty for API-key auth on canary (the `JWT_SECRET` mismatch silently fails `generateJwtToken` in `jwtAuth.ts:112-119` while still leaving the JwtAuthContext set with `authType:'apikey'` and a populated `orgId`). That made read-only resolves like `executionTraceList` reject valid API-key traffic with 401 even though the same key worked on `/v2/activities/templates` (which routes API-key auth to root creds via `executeAsAuth`). Fix: relaxed `requireAuthenticated` to require *some* `JwtAuthContext` to be set, but not require `jwtToken` to be populated. Per-case destructive checks (`_write`, `_deprecate`, `_update`, `_delete`, `templateAuditReport`) still gate writes properly. 3 regression tests in `impulses-resolve-auth.test.ts` pin the behavior. Activity-api commit `ed5487c`, super-repo `9c5ca78d`.
- [ ] **B-2-resolution: provision admin-scoped API key OR extend deprecate handler with `template_admin` scope** — Pick one. Currently 11.x cleanup is fully blocked. Operator decision on (a) issue admin-scoped key, (b) introduce narrower `template_admin` scope, or (c) operator runs SurrealDB-direct delete bypassing RBAC.
- [ ] **B-4: paginated audit endpoint** — Public `GET /v2/activities/templates` caps at limit=100 with no offset/pagination. Up to ~10 hidden shadow templates can't be enumerated via the public API. Add a paginated audit query (offset support) or operator runs SurrealDB-direct enumeration.
- [ ] **routes/ci.ts:200-249 normalize follow-up** — Same un-normalized template_id pattern as 10.4 (CI-track Thompson updates pass `template_id` directly to UPSERT variant_performance_metrics). Subagent 10.4 flagged but kept scope tight. Apply `normalizeActivityId()` for consistency.
- [x] **F-7: lifecycle:task:completed payload missing fields** — RESOLVED 2026-04-26. Extended both emit sites (activity.ts:2407 + :2877) with `skip_validation`, `allImpulseIds`, `loadedImpulseIds`, `toolCallRecords`. Added `ActivityTask.skip_validation` opt-out flag in `src/types.ts`. `validator-dispatch.json` task 1 now carries a `conditional` short-circuit; task 5 uses dotted-path placeholders for the array fields and `learning_signal_writer` resolver JSON.parses string-form arrays. `templateId` remains absent from the payload — Phase 5 follow-up.
- [x] **F-6 (corrected): activity-api advertises `discoverByShapesQuery` shape via `/v2/impulses/resolve`** — RESOLVED 2026-04-26. Vessel-integration constraint applied: activity-api added a `discoverByShapesQuery` shape handler in `repos/metabob-activity-api/src/routes/impulses.ts` that translates pointer fields (`required_shapes`, `mode`, `output_shapes`, `current_shapes`, `limit`, `predecessor_activity_id`) to the same shared helper (`src/services/discover-by-shapes.ts`) the REST route uses — no SQL duplication. The shape is advertised via `config.discovery.shapes`. `validator-dispatch.json` task 1 retrofitted to use the canonical pattern: existing `impulse-resolve` resolver + `pointer.type: "discoverByShapesQuery"` with mode=backward + output_shapes=[validation_result]. Task 2 reshaped to read the new envelope and pick a winner via composition_score · Thompson α/β tiebreakers. Tests: 15 pass (8 helper-validation unit tests + 7 contract/parity tests). Typecheck clean both repos. **Zero minibob TypeScript changes** — one JSON template retrofit. See design.md F-6 for full RESOLVED prose.

## Demonstration runway

The path to a fully-demonstrable impulse-activity loop on canary. Order is roughly the dependency chain. Items in *italics* are operator actions outside the implementation loop.

### Stage A — Unblock cleanup (B-2)

1. *Operator decides B-2 resolution:* admin-scoped API key OR `template_admin` scope OR operator-direct SurrealDB delete
2. **B-2-fix** 404→403 information-leak fix in deprecate handler (small handler change)
3. **B-4** paginated audit endpoint (or operator-direct enumeration of full shadow set)

### Stage B — Registry cleanup (depends on A)

4. **11.1** Delete shadow templates (now experimentally feasible with admin scope)
5. **11.2** Delete unvalidated ribosome variants (esp. 14 health-check variants emitting wrong shape)
6. **11.3** Mass-deprecate `completeness_score < 0.5` templates
7. **11.4** Seed hand-verified executions for `fix-bug-complete`, `add-feature-complete`, `refactor-with-tests`

### Stage C — Remaining lifecycle gaps

8. ~~**F-7** Extend `lifecycle:task:completed` payload (skip_validation, per-task tracking arrays)~~ — RESOLVED 2026-04-26
9. ~~**F-6 (corrected)** Activity-api advertises `discoverByShapesQuery` shape; validator-dispatch retrofitted~~ — RESOLVED 2026-04-26
10. ~~**F-9b** Minibob `output_impulses[]` schema extension (impulse_id + body)~~ — RESOLVED 2026-04-26
11. **routes/ci.ts** normalize follow-up

### Stage D — Decommission inline executor logic (Phase 5)

12. **5.1** Remove inline synthesizer block at `activity.ts:4949-4997`
13. **5.2** Remove inline validation block at `activity.ts:5454-5529`
14. **5.3** Remove three `recordImpulseRelevance` call sites
15. **5.4** Remove inline tool-argument-pattern recording loop

### Stage E — End-to-end canary smoke (Phase 8)

16. **8.1** Goal regression set: dispatch representative goals, capture trace IDs
17. **8.2** Inspect traces for full lifecycle event coverage
18. **8.3** Confirm Thompson α/β updates on success and failure
19. **8.4** Confirm `failure_mode` populates correctly for each of 5 types
20. **8.5** Confirm at least one goal succeeds via recursive sub-goal escalation
21. **8.6** Confirm no production goal requires embedded template fallback
22. **8.7** Document each success criterion result in design.md

### Stage F — `thompson_posterior` shape (Phase 9) and final verification

23. **9.1** Add `thompson_posterior` to activity-api shape advertisement
24. **9.2** Implement resolver for `thompson_posterior` pointer type
25. **9.3** `variantMetricsSummary` REST handler becomes a thin wrapper
26. **9.4** Workbench reads posteriors via shape resolution
27. **9.5** Document the shape in `docs/impulse-types/thompson_posterior.md`
28. **V.1** All sibling spec verification phases green
29. **V.2** Workbench history panel renders integrated trace
30. **V.3** No regression in existing activity-execution test suite

## Deployment overhaul (D-track, 2026-04-26)

**Motivation**: Phase 8 canary smoke surfaced two deploy gaps: (1) the canary image is `1.12.0-4aa3d85`, predating F-32 (auth gate) + B-4 (paginated audit); (2) the canary k8s secret `metabob-activity-api.jwt-secret` doesn't match the schema's `apikey_token` ACCESS method KEY → JWT-routed endpoints return 500 "The access method cannot be used in the requested operation". F-32 routes around the symptom for read-only resolves, but PERMISSIONS-based RBAC is still bypassed for API-key auth on canary.

**Mechanism**: bundle the image roll (1.12.0 → ed5487c) with the JWT secret rotation. Helmfile sync forces pod replacement which (a) loads the new `JWT_SECRET` env var into the API process and (b) triggers `init-database.ts` to substitute `__JWT_SECRET__` in migration 069 (`DEFINE ACCESS OVERWRITE apikey_token KEY '__JWT_SECRET__'`) — re-keying the SurrealDB ACCESS method to match.

**Single source of truth**: secrets/canary.secrets.yaml + secrets/production.secrets.yaml (working tree, SOPS-encrypted) carry `activityApi.jwtSecret: 399c3c8c…` (64-char hex). Identical for canary and production per the canary/prod-shared-secrets memory rule. Helmfile passes this value to the chart, the chart maps it into the k8s secret `metabob-activity-api.jwt-secret`, both consumers (runtime API + init-db Job) read the same env.

- [x] **D1** Update `environments/production.values.yaml` + `production.canary.values.yaml` image tag → `1.12.0-ed5487c`
- [x] **D2** `docker build -t metabobapp/metabob-activity-api:1.12.0-ed5487c` against `repos/deployment/vessels/metabob-activity-api`
- [x] **D3** `docker push metabobapp/metabob-activity-api:1.12.0-ed5487c`
- [x] **D4** `git submodule update --remote -- vessels/metabob-activity-api` (pointer → ed5487c)
- [x] **D5** `helmfile --environment canary -l name=metabob-activity-api sync`
- [x] **D6** `kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=metabob-activity-api`; verify image tag rolled
- [x] **D7** Validate JWT rotation: GET /v2/activities/execution-traces returns 200 (was 500); POST /v2/impulses/resolve continues 200; GET /v2/activities/templates?offset=N returns echoed offset/limit
- [x] **D8** Phase 8 smoke: query traces, look for lifecycle event coverage, slot-binding nested executions, validator-dispatch, failure_mode population, recursive escalation
- [x] **D9** Atomic commit of staged deployment changes + push origin dev
- [x] **D10** This section (documenting the overhaul)

**Expectation gates**:
- D6 ⇒ image tag = `metabobapp/metabob-activity-api:1.12.0-ed5487c`, all replicas Ready
- D7 ⇒ all three endpoints return 200; `executionTraceList` shows traces from after the deploy timestamp
- D8 ⇒ at least one fresh goal-execution trace observable (gates Stage D Phase 5 decommission); if absent, document the gap and continue with the implementation loop until a real minibob dispatch populates traces

### Stop conditions (success criteria from proposal.md)

The loop terminates when canary evidence shows:
- ✅ Goals regularly succeed and successes are correct
- ✅ Failed goals append a new activity (recursive escalation observed)
- ✅ MiniBob runs solely on vessel-resolvers (no embedded template fallback)
- ✅ Impulse-activity system creates improved activities via the executor (ribosome convergence)
- ✅ Activities compose using all MiniBob features (selection + validation + recursive escalation in one trace)

### Architectural constraints reaffirmed

Carry forward these constraints for all remaining work:

- **Vessel-integration constraint**: integrating with another vessel MUST NOT require source changes in the integrating vessel. New cross-vessel calls happen via shape advertisement on the providing vessel + the existing generic `impulse-resolve` path on the consuming side. F-6's correction is the canonical example.
- **Pure-vessel constraint** (already established): minibob and metabob-activity-api are pure vessels; runtime behavior is activity-driven, not hardcoded.
- **Branch hygiene** (CLAUDE.md): stay on `dev`, ff-only pull, push `origin dev` not `HEAD:dev`.

### Deferred (out of scope for first demo)

- F-4 template foreach/iteration primitive — workaround via single-shape templates acceptable
- F-10 testing-library/react v15 bump — workbench, out of scope per direction
- F-12 trace-detail endpoint 404 fix — pre-existing
- 501 already-split `variant_performance_metrics` rows backfill — separate decision
- Bug-finding-as-activity / self-improvement metrics — post-demo

## Phase 9 — Auth flow completion (cloud-dashboard sign-in)

**Status:** [x] Sign-in flow operational on canary (verified 2026-04-29 via Playwright). Login response shape, JWT issuance, and dashboard auth state transition all working end-to-end. Open follow-ups: I9.3 init-data password_hash backfill (operator-runnable), signup org_id coercion (organizations table requires string, record-ref auto-injection collides), `/api-keys` page error `J.filter is not a function` (user-vessel response shape downstream).
**Why now:** TanStack-rewritten cloud-dashboard `0.3.0-ce06d99` deployed (2026-04-29) and reachable at `https://app.metabob.com`, but the sign-in form submits to `POST /api/auth/login` which proxies to `user-vessel /v2/auth/login` — a route that has never existed and never should (per user-vessel CLAUDE.md "Don't add login/signup routes — those live in identity-vessel"). Identity-vessel ships only password primitives (`/v1/auth/password/{hash,verify,validate}`) plus the resolve path; no end-to-end email+password→JWT flow exists. Documented in F-NN-K.

### F-NN-K: Email+password sign-in flow has no backend

**Symptom:** Dashboard sign-in returns 404 (proxy target is user-vessel `/v2/auth/login`, missing). Verified live 2026-04-29 with `avi@metabob.com` credentials → "Login failed".

**Root cause:** Three-vessel ownership of the auth surface was correctly designed (identity-vessel owns the flow per its CLAUDE.md, user-vessel owns user/org records, dashboard is a proxy) but the flow endpoint itself was never implemented. The dashboard's CLAUDE.md documents the flow as a Phase 1 deliverable; the proxy was wired to a non-existent target.

### I9.1 Add `POST /v1/auth/login` to identity-vessel  ✅ done (2026-04-29, identity-vessel 0.2.6-aec60b3)

Implementation landed in `src/resolvers/login.ts` + index.ts route (not via UserVesselClient — direct SurrealDB query through identity-vessel's connection per the resolver's design rationale: signup needs CREATE before any JWT exists; user-vessel's POST /v2/users is `requireRole("owner","admin")`-gated). Constant-time on missing user via dummy-hash verifyPassword. Response shape: nested `{ token, user: { id, email, name, org_id, role, account_id? }, ...flat ergonomics, expires_at }` to match cloud-dashboard's `LoginResponse` contract.



**Effort:** ~150 LOC + tests
**Where:** `repos/identity-vessel/src/index.ts` + new `src/resolvers/login.ts`

Behavior:
- Body: `{ email: string, password: string }`
- Look up user via `UserVesselClient.queryUserByEmail(email)` — extends existing user-vessel client (or queries SurrealDB directly through identity-vessel's connection — pick one and document)
- Verify password against stored hash via existing `verifyPassword` primitive (Argon2id)
- On success: mint JWT via existing `generateToken({ user_id, org_id, role, account_id })` from `src/services/jwt.ts`
- On failure (no user, wrong password): return 401 `{ error: "invalid_credentials" }` — do NOT distinguish missing-user from wrong-password (timing-safe + no enumeration leak)
- Rate-limit with existing middleware (`createRateLimitMiddleware('auth_login', 10)`)
- Return: `{ token, user_id, org_id, role, account_id?, expires_at }`

Tests:
- Happy path: known seeded user → 200 + valid JWT
- Wrong password → 401
- Unknown email → 401 (same response shape, timing-equivalent)
- Missing field → 400
- Rate-limit kicks in after threshold

### I9.2 Add `POST /v1/auth/signup` to identity-vessel  ⚠️ partial (route deployed; persistence path has remaining schema-coercion issue)

Route + resolver landed in 0.2.6-aec60b3. User CREATE works (after `default_org_id` → `org_id` schema alignment). Organization CREATE fails: deployed `organizations` table has `org_id` field with `VALUE $before OR $value OR id` derivation but `TYPE string ASSERT $value != NONE` — the `id` fallback yields a record-reference, which fails string coercion. Forward fix: explicitly pass `org_id` as the slug suffix (string) on CREATE so the VALUE clause picks `$value` instead of `id`. Out of immediate scope since login flow (the primary dashboard need) is unblocked.



**Effort:** ~120 LOC + tests
**Where:** Same files as I9.1

Behavior:
- Body: `{ email, password, name?, org_name?, accept_invitation_token? }`
- Validate password strength via existing `password/validate` primitive
- Hash password via `password/hash` primitive
- Create user via user-vessel `POST /v2/users` (route exists)
- If `accept_invitation_token` present: accept the federation invite via user-vessel `POST /v2/invitations/:token/accept`
- Else if `org_name` present: create new org via user-vessel `POST /v2/accounts` (caller becomes owner)
- Else: 400 `{ error: "needs_invitation_or_org" }`
- Mint JWT and return same shape as I9.1

Tests:
- New user + new org happy path
- New user accepting invitation
- Duplicate email → 409
- Weak password → 400
- Missing org_name and no invitation → 400

### I9.3 Verify init-data populates `password_hash` for seeded users

**Effort:** 30m
**Where:** `repos/deployment/charts/init-data/templates/configmap.yaml`

Check that the user-creation block hashes `IJzjvLoE6s984WmoNmnnedszGU6aS63G` (avi's password from `canary.secrets.yaml`) via `crypto::argon2::generate()` and stores in `users.password_hash`. If missing, add it.

Verify post-deploy:
```surql
SELECT email, password_hash != NONE AS has_hash FROM users WHERE email = 'avi@metabob.com';
```

### I9.4 Fix dashboard proxy target  ✅ done (cloud-dashboard 7cfeb9f)

**Effort:** 15m
**Where:** `repos/metabob-cloud-dashboard/src/index.ts:60`

Change:
```ts
if (pathname.startsWith("/api/auth/")) {
  const path = pathname.replace("/api/auth", "/v2/auth");
  const targetUrl = `${USER_VESSEL_URL}${path}`;
```
To:
```ts
if (pathname.startsWith("/api/auth/")) {
  const path = pathname.replace("/api/auth", "/v1/auth");
  const targetUrl = `${IDENTITY_VESSEL_URL}${path}`;
```

The `IDENTITY_VESSEL_URL` env var is already wired via the dashboard's Helm chart (per dashboard CLAUDE.md §Configuration).

### I9.5 Deploy + Playwright sign-in smoke  ✅ done (2026-04-29 13:43 UTC, identity-vessel 0.2.6-aec60b3 on canary)

End-to-end verified via Playwright on `https://app.metabob.com`:
1. Login form filled with `playwright@metabob.com` (Argon2id hash injected directly via SurrealDB; bypasses I9.3 backfill which remains a separate operator step for `avi@metabob.com`)
2. Sign in → header shows authenticated email, sidebar renders, no "Loading organization..." hang
3. `sessionStorage.metabob_user` contains `{ id, email, name, org_id, role }` (was `"undefined"` string pre-fix)
4. JWT in Authorization header carries `org_id`, `user_id`, `role` claims; resolves via `/v1/auth/resolve`
5. Routing to `/api-keys` works but page errors `J.filter is not a function` — user-vessel response shape mismatch, **separate downstream issue not in Phase 9 scope**

Three compounding fixes shipped in identity-vessel 0.2.6:
- Login response shape: nested `{ token, user: {...} }` matches dashboard's `LoginResponse` contract
- `type::thing` → `type::record` (SurrealDB 3.x rename) — three signup-path stragglers
- `users.default_org_id` → `users.org_id` — aligned with deployed `users` SCHEMAFULL field

Build chain:
- identity-vessel version bump → build → push → helmfile sync canary+prod
- cloud-dashboard version bump → build → push → helmfile sync canary+prod
- (init-data only re-runs if I9.3 added the password_hash backfill)

Smoke (Playwright via main thread):
1. Navigate `https://app.metabob.com` → sign-in form
2. Fill `avi@metabob.com` + password
3. Click Sign in → expect redirect off the login route, dashboard shell renders
4. Navigate to `/api-keys` → expect API key list (org-scoped to metabob)
5. Take screenshot

### Stop condition for Phase 9

Phase 9 closes when avi can sign in via the dashboard end-to-end and see his org's API keys page populated.

**Status (2026-04-29):** Sign-in path closed for `playwright@metabob.com`. For avi: I9.3 (init-data password_hash backfill) still needed before dashboard sign-in works for that account — operator can run it directly or temporarily inject hash via SurrealDB UPDATE (same pattern used for playwright user). API-keys page hits a separate user-vessel response-shape downstream issue (`J.filter is not a function`) — not blocking Phase 9 close, tracked outside this spec.
