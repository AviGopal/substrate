# Design — Closure Replacement Suite

Eight sections, one per closure gap plus the audit and the recursive
audit-of-audit. Each section defines shape body schemas and activity
contracts at contract fidelity (input shapes, output shapes,
one-sentence task summary). JSON task graphs are deferred to
per-activity seed-template implementations in
`repos/development-vessel/src/seed/`.

Owning vessel for all activities below: `development-vessel`, unless
otherwise noted (cron-dispatch shares ownership with boredom-vessel;
audit-security shares with H6 verifier-vessel when shipped).

## §A. Memory closure

### Shape: `memoryNote`

```ts
type MemoryNote = {
  id: string                            // ULID
  type: "finding" | "feedback" | "reference"
  title: string                         // <= 200 chars
  body: string                          // markdown
  provenance_trace_ids: string[]        // execution traces that supplied evidence
  confidence_weight: number             // [0, 1] per signal-confidence-weighting
  last_validated_at: string             // ISO-8601
  supersedes_id?: string                // prior memoryNote this one replaces
}
```

Confidence weights by type: `finding` 0.6 (trace-derived), `feedback`
0.4 (operator-stated, possibly stale), `reference` 0.7 (external
resource pointer).

### Shape: `memoryNote_write`

Admin-gated write shape with body `{ note: MemoryNote }`. Resolver
writes the note and triggers ribosome re-extraction if `type === "finding"`.

### Activity contract: `extract-memory-note`

| Field | Value |
|---|---|
| Input shape | `executionTraceWithSignatures` (lifecycle-supplied) |
| Output shape | `memoryNote_write` |
| Trigger | Lifecycle observer on `lifecycle:execution:succeeded` filtered by `success === true AND duration_ms > threshold AND tasks.length >= 3` |
| Task summary | Identify recurring resolution patterns in the trace, draft a finding-type memoryNote, and write via `memoryNote_write`. |

The operator memory directory becomes a cache populated from
`memoryNote` queries by a one-shot import script
(`scripts/substrate/import-operator-memory.ts`, owned by
substrate-closure-properties Phase 1.4).

## §B. Skill mirror activities

Eight activity contracts, one per slash skill. All use lifecycle and
discovery dispatch — none introduce new resolver primitives. All
output a `proposedSpec` / `prVerdict` / `cleanupReport` /
`securityFindings` / `deploymentReport` / `cronDispatchResult`
impulse as appropriate (shapes named below; bodies defined inline).

| Activity | Mirrors | Input shape | Output shape | Task summary |
|---|---|---|---|---|
| `propose-spec` | `/openspec-propose` | `changeIntent { text, target_capability?, urgency? }` | `proposedSpec { proposal_md, design_md, tasks_md, specs_md, validation_status }` | Compose ribosome pattern recall + spec-template instantiation + foundation-compliance validation into an openspec change draft. |
| `apply-spec` | `/openspec-apply` | `specReference { change_id, task_filter? }` | `applyReport { tasks_completed[], tasks_remaining[], blockers[] }` | Walk an openspec change's tasks.md, dispatch each task as a sub-activity, record outcomes. |
| `archive-spec` | `/openspec-archive` | `specReference { change_id }` | `archiveReport { archive_path, capability_updates[], cleanup_actions[] }` | Verify all tasks complete, move openspec change to archived/, update affected capability specs. |
| `cleanup-docs` | `/jiggle-and-prune` | `docCleanupRequest { scope: "all" | "vessel:<id>" | "path:<glob>" }` | `cleanupReport { files_archived[], files_updated[], stale_refs_fixed[] }` | Identify stale, contradictory, or duplicated docs; archive or refresh per the jiggle-and-prune rubric. |
| `review-pr` | `/review` | `prReference { pr_id, scope?: "diff" | "full" }` | `prVerdict { verdict: "approve" | "request_changes" | "comment", findings[] }` | Read PR diff, evaluate against rubric (correctness, foundation alignment, test coverage, doc updates), emit verdict. |
| `audit-security` | `/security-review` | `securityScope { paths[], scope_tags?[] }` | `securityFindings { findings[], severity_summary, recommendations[] }` | Run security-review heuristics + (when shipped) H6 verifier-vessel checks over scoped paths. |
| `deploy-substrate` | `/deploy` | `deploymentRequest { vessel_id, image_tag, environment }` | `deploymentReport { status: "success" | "failure" | "rolled_back", health_checks[], events[] }` | Dispatch substrate deploy-resolver against the named vessel; verify post-deploy health; record outcome. |
| `cron-dispatch` | `/loop`, `/schedule` | `cronSpec { activity_id, interval_seconds, args?, until? }` | `cronDispatchResult { scheduled_id, next_run_at }` | Register a recurring activity dispatch with boredom-vessel's timer; emit scheduling confirmation. |

`cron-dispatch` is co-owned by boredom-vessel (which holds the timer)
and development-vessel (which holds the activity catalog).

## §C. Subagent equivalents

Three activity contracts. Each is a *composition* over existing
vessels; none introduces new resolver primitives.

| Activity | Composes | Input shape | Output shape | Task summary |
|---|---|---|---|---|
| `subagent-plan` | llm-resolver-vessel + concept-db + activity-api | `planRequest { goal_text, context_refs?[], depth?: number }` | `executionPlan { steps[], expected_shapes[], estimated_cost_usd, fallback_branches[] }` | Recall prior patterns from concept-db, Thompson-rank candidate activity chains via activity-api, synthesise a plan via llm-resolver-vessel. |
| `subagent-explore` | local-tools-vessel + concept-db + llm-resolver-vessel | `exploreRequest { question, scope_glob?, max_files?: number }` | `codebaseExplorationReport { findings[], file_refs[], open_questions[] }` | Grep/find within scope, build a semantic map via concept-db, summarise findings via llm-resolver-vessel. |
| `subagent-general` | goal-host-vessel | `generalSubgoal { goal_text, parent_execution_id?, max_steps?: number }` | `goalCompletionReport { status, produced_impulses[], cost_usd, traces[] }` | Dispatch goal-host-vessel's `runGoal` with multi-step ExecuteOptions; aggregate trace outcomes. |

Removing operator-side subagent dispatch does not change substrate
research/planning/multi-step capacity: the substrate Thompson-ranks
`(subagent_activity, problem_class)` per existing posterior machinery.

## §D. CI closure — `verify-merge-candidate`

### Shape: `mergeCandidate`

```ts
type MergeCandidate = {
  pr_id: string
  head_branch: string
  base_branch: string
  diff_summary: { files_changed: number, additions: number, deletions: number }
  diff_ref: string            // git rev or object pointer the verifier can fetch
}
```

### Shape: `mergeVerdict`

```ts
type MergeVerdict = {
  verdict: "pass" | "fail" | "needs_human"
  evidence_trace_ids: string[]
  harness_results: {
    failure_mode_harness: { passed: number, failed: number, regressions: string[] }
    reuse_validation: { mrr: number, baseline_mrr: number, delta: number }
    lift_anchors?: { all_passed: boolean, anchor_results: Array<{ id, passed }> }
  }
  regression_indicators: Array<{ kind, detail, severity }>
  confidence_weight: number
}
```

### Activity contract

| Field | Value |
|---|---|
| Input shape | `mergeCandidate` |
| Output shape | `mergeVerdict` |
| Trigger | Lifecycle observer on `pr_opened` events from substrate-self-deployment's git resolvers, plus manual dispatch |
| Task summary | Apply the diff against a substrate-forge-vessel fork, run failure-mode-harness + Phase 19 reuse-validation harness + (when present) lift-criterion-hardening anchors, aggregate outcomes into a verdict. |

The `needs_human` verdict is emitted when harness results contradict
each other or when regression indicators include a category whose
remediation is not in the §27.3.c.1 substrate-authorised set (admin
scope mutation, trace deletion, lift-status write). This routes to
operator review without blocking other merges.

## §E. Self-healing activities

Five new activity contracts. All are referenced by
substrate-explicit-vessels, substrate-self-deployment, or
substrate-forge-vessel as if extant; this spec is the definition site.

### Shape: `recoveryReport`

```ts
type RecoveryReport = {
  vessel_id: string
  recovery_action: "restart" | "restore" | "rerun-migration" | "logs-fetched" | "probe-dispatched"
  status: "success" | "failure" | "partial"
  evidence_trace_ids: string[]
  follow_up_required?: string
  duration_ms: number
}
```

### Activity contracts

| Activity | Input shape | Output shape | Task summary |
|---|---|---|---|
| `restart-vessel` | `recoveryTarget { vessel_id, reason }` | `recoveryReport` | Dispatch substrate container-orchestration resolver to restart the named vessel; verify it re-registers with discovery within 30s. |
| `restore-from-backup` | `recoveryTarget { vessel_id, backup_ref }` | `recoveryReport` | Restore the named vessel's persistent state from the indicated backup, restart the vessel, verify schema integrity. |
| `rerun-migration` | `migrationRequest { migration_id, vessel_id }` | `recoveryReport` | Re-execute a named migration file against the target vessel's database; record the outcome including idempotency check. |
| `inspect-vessel-logs` | `logQuery { vessel_id, since?, grep_pattern?, max_lines? }` | `recoveryReport` (status: "logs-fetched") + embedded `log_excerpt` | Fetch container logs for the named vessel via substrate's log resolver; emit excerpt as evidence for downstream diagnosis. |
| `dispatch-debug-probe` | `probeRequest { vessel_id, probe_type, args? }` | `recoveryReport` (status: "probe-dispatched") | Dispatch a debug probe activity (per probe_type taxonomy) against the named vessel; emit results as evidence. |

Cross-references (no spec edits, consumption only):
- substrate-self-deployment uses `restart-vessel` post-merge.
- substrate-forge-vessel uses `restart-vessel` for canonical
  promotion and `restore-from-backup` for rollback.

## §F. Spec-authoring closure

The `propose-spec` activity is defined in §B. This section documents
its second role: substrate-authored spec proposals.

The output of `propose-spec` is a `proposedSpec` impulse containing
draft `proposal.md`, `design.md`, `tasks.md`, `specs/*/spec.md`. The
new `foundation-compliance` validator runs against this output before
the spec is considered acceptance-ready.

### Validator: `foundation-compliance`

| Field | Value |
|---|---|
| Validator id | `foundation-compliance` |
| Input | `proposedSpec` |
| Output | `validationResult { passed: boolean, failures: Array<{ rule_id, detail }>, warnings[] }` |
| Owner | development-vessel |

Indicative checks (full list deferred to follow-up; this spec names
the validator but does not pin its check list):

1. The proposal cites `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
   when introducing a new primitive.
2. No new REST endpoints are added for single-use queries (foundation
   red flag).
3. Activities declared in the spec have explicit `input_shapes` and
   `output_shapes`.
4. No resolver is centralised outside the vessel that owns the data.
5. New shapes appear in `config.discovery.shapes` of an owning vessel.

The full enumeration of foundation invariants is a follow-up spec
(reason: the foundation doc evolves; pinning the check list here
would lag the foundation).

## §G. Closure-audit script

### Algorithm

```
let report = []
for property P in (IAL §27.1.* ∪ §27.2.*):
  for external_tool T in [
    "operator-memory",
    "slash-skills",
    "subagents",
    "github-actions",
    "operator-shell",
    "operator-spec-authoring"
  ]:
    let verdict = "not-applicable"
    if property P depends on T (per the dependency table in design §G.1):
      // Synthetic removal: do not actually modify the substrate.
      // Run the property's evaluation routine with a flag instructing
      // resolvers to refuse calls that would route through T.
      let outcome = try_evaluate_property(P, refuse_tool=T)
      verdict = outcome.passed ? "pass" : "fail"
      if verdict == "fail":
        report.push({P, T, verdict, missing_dependency: outcome.failure_reason})
      else:
        report.push({P, T, verdict})
    else:
      report.push({P, T, verdict: "not-applicable"})
let all_green = report.every(r => r.verdict in {"pass", "not-applicable"})
emit closureStatusReport { runs_at, report, all_green, mode: "standard" | "without-audit-itself" }
```

### Shape: `closureStatusReport`

```ts
type ClosureStatusReport = {
  runs_at: string                                  // ISO-8601
  mode: "standard" | "without-audit-itself"
  report: Array<{
    property_id: string
    external_tool: string
    verdict: "pass" | "fail" | "not-applicable"
    missing_dependency?: string
  }>
  all_green: boolean
  confidence_weight: number   // 1.0 standard, 0.7 without-audit-itself
}
```

### Activity contract: `closure-audit-tick`

| Field | Value |
|---|---|
| Input | `cronTick { audit_mode?: "standard" | "without-audit-itself" }` (default "standard") |
| Output | `closureStatusReport` |
| Trigger | boredom-vessel cron (default: nightly at substrate-local 02:00) |
| Task summary | Invoke `validation/scripts/closure-audit.ts` with the requested mode; persist result to `validation/state/closure-status.json`; emit `closureStatusReport` impulse. |

§27.3.j.7 acceptance: three consecutive `all_green: true` standard-mode
reports.

## §H. Recursive closure (audit-of-audit)

The closure-audit script is substrate-resident code. A buggy or
adversarial substrate could pass closure by tampering with its own
audit. Mitigation: alternative-signals mode.

When `closure-audit-tick` runs with `audit_mode === "without-audit-itself"`,
the script does NOT consult its own per-property evaluators. Instead it
checks for closure indicators via *alternative signals*:

1. **Chain-stall reports** (from topology-discovery-loop): the loop's
   own dispatch chain has executed end-to-end within the lookback
   window without operator intervention.
2. **Lift-criterion-hardening anchors** (when shipped): the
   harness-side anchor evaluations pass against the running substrate.
3. **Adversarial probe results** (when shipped): substrate has not
   regressed against the most recent adversarial probe set.
4. **Operator-quiescence indicator**: `operator-state-import` table
   has not been re-imported during the lookback window (the substrate
   has been running without operator memory refresh).

If alternative signals also report green, the substrate is closed
*even without the standard audit*. `confidence_weight` for the
without-audit-itself report is 0.7 (smaller signal, narrower window).

This is the third-layer defence:
- Layer 1: standard closure-audit-tick (high signal, depends on
  substrate honesty about its own audit).
- Layer 2: without-audit-itself mode (medium signal, depends on
  multiple independent indicators).
- Layer 3: operator inspection (always available per §27.3.c.1).

§27.3.j.7 acceptance counts Layer 1 reports; Layer 2 reports are
*reinforcing*, not load-bearing for the lift gate. If Layer 1 reports
green but Layer 2 disagrees, this constitutes a `needs_human` lift
verdict.
