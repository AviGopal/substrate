# Spec — Substrate Self-Replacement Pipeline

Normative requirements. Each is testable. Terminology aligned with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`. Section refs
inline. This spec is the internal-resolver counterpart to
`2026-05-23-external-resolver-vesselization`; both operate at the
substrate-maintenance horizon.

## ADDED Requirements

### Requirement: R0 — Sequencing and horizon framing

This spec MUST be sequenced behind its prerequisites and MUST operate at the substrate-maintenance horizon. The horizon framing makes this spec a sibling to `2026-05-23-external-resolver-vesselization`: both produce vessels under `substrate-maintenance` intent, distinguished by sub-intent (`internal` here, `external` there).

- **R0.1** This spec is downstream of `2026-05-23-substrate-forge-vessel` and `2026-05-23-signal-confidence-weighting`. DEV MUST NOT begin until both prerequisite changes have their acceptance gates green on the active substrate.
- **R0.2** Every activity introduced by this spec MUST tag its traces with the horizon tag `intent:substrate_maintenance` plus the sub-intent `intent:internal_resolver_replacement` and an activity-specific sub-intent (e.g. `intent:vessel_purity_audit`, `intent:replacement_drafting`).
- **R0.3** Every trace produced by this spec MUST carry the horizon tag (R0.2). Consumers (ribosome, posterior aggregators, audit activities) MAY filter traces by tag to compute per-horizon analyses; this spec does NOT introduce horizon as a first-class parameter or storage partition — horizons are a tag-namespace convention over the existing trace-tag set.
- **R0.4** This spec does not modify the foundation document or the existing `forge-vessel-for-shape` template in place. The composition in design §G is expressed by new activity templates that invoke the forge template by id.

#### Scenario: Prerequisites green before DEV begins

- **WHEN** the operator runs the acceptance-gate query for `2026-05-23-substrate-forge-vessel` and `2026-05-23-signal-confidence-weighting`
- **THEN** both report green before any task in this change is dispatched

#### Scenario: Horizon tag present on every trace

- **WHEN** any of the five activities in this spec completes
- **THEN** the trace's `tags` includes `intent:substrate_maintenance`
- **AND** also includes `intent:internal_resolver_replacement`
- **AND** also includes an activity-specific sub-intent

#### Scenario: Cross-horizon and per-horizon aggregation share the mechanism

- **WHEN** a consumer aggregates traces filtered on `intent:substrate_maintenance` (covering both internal and external siblings)
- **THEN** the aggregation runs through the same query path as filtering on `intent:internal_resolver_replacement` alone
- **AND** the result is the cross-sibling analysis

### Requirement: R1 — `audit-vessel-purity` template exists in development-vessel

The development-vessel SHALL ship a seed template `audit-vessel-purity` that, given a `vesselReference` impulse, evaluates the target vessel against the seven-item purity checklist of design §B and emits a `vesselPurityReport` impulse listing each gap with severity and replacement scope.

- **R1.1** The template MUST exist at `repos/development-vessel/src/seed/audit-vessel-purity.ts` and be exported from `src/seed/index.ts`.
- **R1.2** The audit MUST evaluate every item in the seven-item checklist (design §B) for every invocation; partial audits are NOT permitted.
- **R1.3** The audit MUST be deterministic — two runs over the same source tree and registration record MUST produce byte-identical `vesselPurityReport` bodies.
- **R1.4** The audit MUST NOT modify the audited vessel's source, registration, or trace store.
- **R1.5** The `vesselPurityReport` body MUST conform to:
  ```typescript
  {
    vessel_id: string;
    generated_at: string;          // ISO 8601
    findings: Array<{
      check_id: "single_resolve_endpoint" | "discovery_resident"
              | "identity_auth" | "domain_local_shapes"
              | "llm_dispatch" | "intent_tagged_traces"
              | "standard_template_structure";
      passed: boolean;
      severity: "high" | "medium" | "low" | null;  // null when passed
      evidence: string;             // short citation: file:line or registry field
      replacement_scope: "add_shapes" | "remove_endpoints"
                       | "extract_to_vessels" | "rewrite_module"
                       | "rewrite_whole_vessel" | null;
    }>;
    overall_replaceable: boolean;   // true if any high-severity gap
  }
  ```

#### Scenario: Audit emits report for known target

- **WHEN** the operator runs `audit-vessel-purity` against `metabob-activity-api`
- **THEN** the emitted `vesselPurityReport` has at least one finding with `check_id="single_resolve_endpoint"` and `passed=false`
- **AND** the finding's `evidence` cites at least one legacy REST endpoint path

#### Scenario: Deterministic re-audit

- **WHEN** `audit-vessel-purity` runs twice against the same source tree and registry record
- **THEN** both runs produce byte-identical `vesselPurityReport.findings` arrays

#### Scenario: Self-audit of development-vessel

- **WHEN** `audit-vessel-purity` runs against `development-vessel` itself
- **THEN** every finding has `passed=true` or `severity != "high"`
- **AND** `overall_replaceable` is `false`

### Requirement: R2 — `draft-replacement-vessel` template exists in development-vessel

The development-vessel SHALL ship a seed template `draft-replacement-vessel` that, given a `vesselPurityReport` with `overall_replaceable=true`, derives a contract from the report's advertised shapes, invokes the existing `forge-vessel-for-shape` pipeline under the new naming/org convention, and emits a `replacementScaffold` impulse.

- **R2.1** The template MUST exist at `repos/development-vessel/src/seed/draft-replacement-vessel.ts`.
- **R2.2** The template MUST refuse to draft when `vesselPurityReport.overall_replaceable=false`; emits `failure_mode.type="verifier_negative"` with `context.validator_id="overall_replaceable"`.
- **R2.3** The template MUST derive the forge contract from the report's findings: shapes the original vessel advertised that remain in scope under the new vessel name.
- **R2.4** The template MUST enforce naming and org discipline per design §F: the new vessel's repository URL MUST be of the form `github.com/AviGopal/<vessel-name>`, the npm package name MUST be `@avigopal/<vessel-name>`, and the vessel name MUST NOT contain `metabob` or `bob` as substrings.
- **R2.5** The forge dispatch MUST invoke `forge-vessel-for-shape` (from `2026-05-23-substrate-forge-vessel`) via composition; this template MUST NOT duplicate forge logic.
- **R2.6** The LLM prompt MUST live at `repos/development-vessel/src/seed/prompts/draft-replacement-vessel.md` and MUST encode the naming/org constraints (R2.4) as hard requirements. The template's `enforce-naming` task MUST reject LLM output containing the forbidden substrings.

#### Scenario: Naming check rejects forbidden substring

- **WHEN** the LLM dispatch returns a draft whose proposed vessel name contains `metabob-` or `bob` as a substring
- **THEN** the `enforce-naming` task rejects the draft
- **AND** the template records `failure_mode.type="safety_breach"` with `context.breach_type="forbidden_naming"`
- **AND** retries with a stricter prompt up to 3 times before aborting

#### Scenario: Forge invoked, not duplicated

- **WHEN** the template runs successfully
- **THEN** the trace includes a composition edge to a `forge-vessel-for-shape` execution
- **AND** the scaffold's emitted files match the forge's output structure

#### Scenario: Repository URL conforms to AviGopal namespace

- **WHEN** a `replacementScaffold` is emitted
- **THEN** its `repository_url` begins with `github.com/AviGopal/`
- **AND** its `npm_scope` is `@avigopal`

### Requirement: R3 — `shadow-validate-replacement` template exists in development-vessel

The development-vessel SHALL ship a seed template `shadow-validate-replacement` that registers the replacement under `provisional: true` with a `shadow_of` reference to the original, configures discovery-vessel to dispatch matching resolve requests to both, compares responses, and emits a `shadowReport` impulse aggregating per-request divergences.

- **R3.1** The template MUST exist at `repos/development-vessel/src/seed/shadow-validate-replacement.ts`.
- **R3.2** Discovery-vessel MUST accept a `shadow_of: <vessel_id>` field on provisional registrations. When a resolve request matches a shape advertised by both the primary and a shadow, discovery MUST dispatch to both; only the primary's response is returned to the caller; the secondary's response is recorded as a trace.
- **R3.3** The template MUST support two oracle modes per design §D: `oracle` (the original is ground truth; any divergence is a defect) and `divergence_only` (divergences recorded but neither vessel is authoritative). The operator selects the mode at pipeline launch via a `--mode` flag; default is `oracle`.
- **R3.4** The template MUST run until either `min_shadow_traces` (default 200) traces have accumulated or `max_shadow_budget_usd` (default operator-set) is exhausted.
- **R3.5** The emitted `shadowReport` MUST include `divergence_rate` (fraction of traces with non-trivial divergence), `divergence_categories` (a frequency map of divergence kinds), and a recommendation field (`recommend_promotion`, `recommend_reject`, `recommend_continue`).

#### Scenario: Shadow tap dispatches to both

- **WHEN** a provisional vessel is registered with `shadow_of=<old_vessel_id>` for shape S
- **AND** a resolver request for shape S arrives at discovery-vessel
- **THEN** discovery dispatches the request to both vessels
- **AND** returns only the primary's response to the caller
- **AND** records the secondary's response as a trace tagged with the `shadow_of` reference

#### Scenario: Oracle-mode divergence is a defect

- **WHEN** the template runs in `oracle` mode
- **AND** more than 1% of shadow traces show response divergence
- **THEN** the emitted `shadowReport.recommend_promotion` is `false`
- **AND** the report's `divergence_categories` enumerates the failure kinds

#### Scenario: Budget exhaustion before trace floor

- **WHEN** the template's accumulated cost exceeds `max_shadow_budget_usd` before `min_shadow_traces` is reached
- **THEN** the template emits `shadowReport` with `recommend_continue=true`
- **AND** records `failure_mode.type="budget_exhausted"`

### Requirement: R4 — `promote-replacement` template exists in development-vessel

The development-vessel SHALL ship a seed template `promote-replacement` that, given a `shadowReport` with `recommend_promotion=true`, performs an operator-approved atomic discovery-vessel swap so the replacement becomes the producer-of-record for its advertised shapes and emits a `replacementPromotion` impulse. Automated-mode promotion is configurable but is NOT the default.

- **R4.1** The template MUST exist at `repos/development-vessel/src/seed/promote-replacement.ts`.
- **R4.2** The template MUST refuse promotion when `shadowReport.recommend_promotion` is `false`; emits `failure_mode.type="verifier_negative"` with `context.validator_id="shadow_recommendation"`.
- **R4.3** The template MUST require operator approval by default (`automated_mode=false`); the approval step uses the `human_resolver`. Operator denial emits `failure_mode.type="user_abort"` and aborts the swap.
- **R4.4** The atomic-swap mechanism MUST use discovery-vessel's optimistic-concurrency PATCH (etag-validated). On etag conflict the template MUST retry up to 3 times with exponential backoff before failing.
- **R4.5** Replacement vessels MUST NOT inherit posteriors from the original. After promotion, the replacement has fresh α/β under its new `vessel_id`. The original's posteriors are preserved in the archive (R5) for analysis but do not transfer.

#### Scenario: Operator approval gate by default

- **WHEN** the template runs with no `--automated` flag and a clean shadowReport
- **THEN** the `operator-approval` task dispatches to `human_resolver`
- **AND** the swap does NOT proceed until the operator approves

#### Scenario: Etag conflict triggers retry

- **WHEN** the discovery-vessel PATCH returns 409 Conflict on the first attempt
- **THEN** the template retries up to 3 times with exponential backoff
- **AND** records the retry count in the emitted `replacementPromotion`

#### Scenario: Fresh posteriors after swap

- **WHEN** a replacement is promoted
- **THEN** queries to activity-api for the replacement's α/β return values consistent with zero prior traces
- **AND** queries for the original's α/β still return its pre-archive history

### Requirement: R5 — `archive-vessel` template exists in development-vessel

The development-vessel SHALL ship a seed template `archive-vessel` that, given a `replacementPromotion`, moves the original vessel's source under `repos/archive/<name>-<YYYY-MM-DD>/`, updates super-repo manifests, flips the discovery-vessel registration to `state="archived"`, and emits a `vesselArchive` impulse.

- **R5.1** The template MUST exist at `repos/development-vessel/src/seed/archive-vessel.ts`.
- **R5.2** The archive MUST move source files to `repos/archive/<name>-<YYYY-MM-DD>/` with a deterministic timestamp suffix.
- **R5.3** The archive MUST update super-repo manifests (`.gitmodules`, build config) to remove the vessel from the active set.
- **R5.4** The archive MUST PATCH discovery-vessel to set `state="archived"` on the original vessel's registration record. Archived vessels MUST be returned by `GET /vessels/:id` queries (for audit history) but MUST be excluded from shape-resolution queries.
- **R5.5** If any step (move, manifest update, discovery PATCH) fails, the template MUST emit `failure_mode.type="safety_breach"` with `context.breach_type="partial_archive"` and the operator must intervene to either complete or roll back the archive.

#### Scenario: Successful archive

- **WHEN** the template runs against a promoted replacement
- **THEN** the original's source is moved under `repos/archive/<name>-<date>/`
- **AND** `.gitmodules` no longer lists the original
- **AND** discovery returns the original's record on direct lookup but excludes it from shape-resolution queries

#### Scenario: Partial archive halts pipeline

- **WHEN** the manifest update succeeds but the discovery PATCH returns 5xx
- **THEN** the template emits `failure_mode.type="safety_breach"` with `context.breach_type="partial_archive"`
- **AND** the source move is NOT rolled back automatically — the operator decides whether to retry the PATCH or restore the source

#### Scenario: Archived state excludes from resolution

- **WHEN** a resolver request arrives at discovery for a shape previously owned by an archived vessel
- **THEN** discovery does NOT consider the archived vessel as a candidate
- **AND** routes to the replacement (which now owns the shape)

### Requirement: R6 — Naming and organisational discipline

Every vessel minted by this pipeline SHALL conform to the AviGopal namespace and prefix-free naming convention. No artifact produced by this pipeline SHALL retain `metabob-` or `*bob` substrings in repository URLs, package names, vessel names, or required dependencies.

- **R6.1** Every minted vessel's repository URL MUST be `github.com/AviGopal/<vessel-name>`.
- **R6.2** Every minted vessel's npm package name MUST be `@avigopal/<vessel-name>`.
- **R6.3** No minted vessel name MUST contain `metabob` or `bob` as a substring.
- **R6.4** Migration is per-vessel via this pipeline. Vessels not yet replaced retain their existing `metabob-*` / `*bob` names; this spec does NOT require a parallel rename of unmigrated vessels.

#### Scenario: Forbidden substring rejected at draft

- **WHEN** the LLM proposes a vessel name containing `metabob` or `bob`
- **THEN** `enforce-naming` rejects the draft (R2.6) and retries up to 3 times

#### Scenario: Package name conforms

- **WHEN** a minted vessel's `package.json` is read
- **THEN** the `name` field matches `^@avigopal/[a-z0-9-]+$`

### Requirement: R7 — discovery-vessel atomic-swap and shadow-tap support

discovery-vessel SHALL support optimistic-concurrency PATCH (etag-validated), a `state: "active" | "provisional" | "archived"` field on registration records, and a `shadow_of: <vessel_id>` reference for provisional vessels.

- **R7.1** `GET /vessels/:id` MUST return an etag in the response.
- **R7.2** `PATCH /vessels/:id` MUST require a matching etag in the request; mismatch returns 409 Conflict.
- **R7.3** The registry MUST persist `state` per record; archived records are returned by direct lookup but excluded from `/resolve` and `discover-by-shapes` results.
- **R7.4** Provisional registrations MAY carry `shadow_of: <vessel_id>`. When a resolve request matches a shape advertised by both the primary and a shadow, discovery dispatches to both; the primary's response returns to the caller; the secondary's response is recorded as a trace (R3.2).

#### Scenario: Etag-validated PATCH

- **WHEN** two concurrent PATCH requests arrive with the same etag
- **THEN** the first succeeds, returns a new etag
- **AND** the second returns 409 Conflict

#### Scenario: Archived state excluded from shape resolution

- **WHEN** a vessel's `state` is `archived`
- **AND** a `/resolve` query asks for one of its previously-advertised shapes
- **THEN** the archived vessel is NOT in the candidate list

#### Scenario: Shadow-tap dispatches both

- **WHEN** a resolve arrives at a shape with `provisional+shadow_of` and an `active` primary
- **THEN** discovery dispatches the request to both
- **AND** only the primary's response is returned to the caller

### Requirement: R8 — Acceptance

The change MUST be accepted only when R1–R7 contract tests pass, the C.1 (tool-vessel decomposition) canary completes end-to-end against minibob, the closure-audit reports the expected results, and the trace-tagging discipline holds across every emitted trace.

- **R8.1** R1–R7 contract tests all green.
- **R8.2** **C.1 canary**: the pipeline mints `shell-vessel`, `filesystem-vessel`, `editor-vessel`, and `git-vessel`; each clears shadow validation against minibob's existing built-in implementation in `oracle` mode with `divergence_rate ≤ 0.01` over ≥ 200 shadow traces; each is promoted with operator approval; the corresponding source in `repos/minibob/src/tools.ts` (and related files) is archived under `repos/archive/minibob-builtins-<date>/`; minibob's test suite passes with the new routing.
- **R8.3** **Closure-audit**: `closure-audit --without=operator-shell` reports zero failures for the audit → draft → shadow stages and exactly one expected failure at the `promote-replacement` operator-approval gate (which is the audit's correct behaviour; automated-mode promotion is a separate concern).
- **R8.4** **Self-audit**: `audit-vessel-purity` against `development-vessel` reports zero high-severity gaps.
- **R8.5** **Trace tagging**: across all five activities' executions during the canary, every trace carries `intent:substrate_maintenance` and `intent:internal_resolver_replacement`.

#### Scenario: C.1 canary completes end-to-end

- **WHEN** the operator runs the pipeline against minibob's built-in tools per DEV-9
- **THEN** four new vessels are minted, validated, promoted, and the originals archived
- **AND** minibob's test suite passes with no built-in tool implementations

#### Scenario: Closure-audit shows the expected pattern

- **WHEN** `closure-audit --without=operator-shell` runs against the canary
- **THEN** the audit reports zero failures for audit → draft → shadow
- **AND** reports exactly one failure at `promote-replacement` (the operator-approval gate)

## Status

Post-substrate-forge-vessel, post-signal-confidence-weighting. Lands
after both are stable on the active substrate. Sibling to
`2026-05-23-external-resolver-vesselization` at the
substrate-maintenance horizon. Pre-`activity-vessel` and
`goal-vessel` replacement changes, which consume this pipeline.
