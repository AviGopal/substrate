# Substrate Self-Development Routing Analysis

**Date:** 2026-05-25  
**Reference commit:** `06bd8c04` (analysis-vessel Phase 1 migration)  
**Substrate:** local single-container, `http://localhost:18080`

---

## Current Capability Inventory

### Registered vessels (7 healthy, 106 shapes in discovery)

| Vessel | Port | Key shapes |
|--------|------|-----------|
| `discovery-vessel` | 8100 | `vesselCapability`, `vesselEndpoint`, `vesselHealth`, `vesselRegistry` |
| `activity-api` | 8080 (via 18080) | ~53 shapes: traces, templates, metrics, impulse-relevance, goal-paths |
| `development-vessel` | 8090 | 30 shapes — full list below |
| `goal-host-vessel` | 8210 | `goal_execution`, `activity_execution` |
| `llm-resolver-vessel` | 8220 | `llm_completion` |
| `local-tools-vessel` | 8240 | `shellResult`, `fileContent`, `fileWriteResult`, `fileEditResult`, `gitStatus`, `gitDiff`, `gitCommitResult` |
| `analysis-vessel` | 8250 | `source_code`, `error_log`, `problem_detection`, `code_quality`, `code_annotation`, `cpg_query_result` |

### development-vessel shapes (30 total — the primary self-development vessel)

**Topology observation:** `coverage_tick`, `substrate_health_tick`, `learned_topology_snapshot`, `reachable_unlearned_report`, `unknown_shape_report`, `failure_mode_matrix_score`

**Filesystem + git:** `fs_read`, `fs_write`, `fs_edit`, `fs_list`, `git_status`, `git_diff`, `git_add`, `git_commit`, `git_log`

**Activity-api proxy:** `activity_fetch`, `activity_create_variant`, `activity_recommend`, `activity_discover_by_shapes`

**LLM dispatch:** `llm_completion_dispatch` (discovers `llm_completion` vessel via discovery, not hardcoded)

**Meta/infrastructure:** `vessel_register_passthrough`, `systemd_restart`, `boredom_enqueue`, `http_fetch`, `json_path_extract`, `code_introspect`, `propagate_judgment`, `memoryNote`, `memoryNote_write`, `lift_demo_noop`

### Activity templates relevant to development (13 of 28 total)

| Template | Input shapes | Output shapes | Status |
|----------|-------------|---------------|--------|
| `scaffold-new-vessel` | `cwd` | `vesselScaffolded` | Writes fs structure (package.json, tsconfig, config.ts, routes/impulses.ts stubs) |
| `add-resolver-to-vessel` | `path`, `oldString`, `newString`, `cwd`, `message` | `fileEditResult`, `commandResult` | Reads, edits, stages, commits |
| `Forge Vessel For Shape` | `activity_template`, `config_file`, `goal`, `source_code` | `activity_template` | LLM-driven spec → scaffold → discovery wire → systemd |
| `draft-gap-closing-activity` | `failureModeReport`, `gapScenario` | `activityTemplateProposal`, `activityTemplate` | Proposes new templates from gaps |
| `harness-check-scenario` | `gapScenario` | `scenarioOutcome` | Tests scenarios against development-vessel |
| `harness-run-matrix` | `activity_template`, `error`, `goal` | `failureModeReport` | Runs failure-mode matrix against a template |
| `Repair Failed Activity` | `activity_template`, `error` | `activity_template`, `analysis` | LLM patch to a broken template |
| `Evolve Activity Template` | `activity_metrics`, `activity_template` | `analysis`, `config_file`, `documentation` | Performance-driven template evolution |
| `Core Activity Audit` | `activity_metrics`, `activity_template` | audit outputs | Registry quality assessment |
| `Replace Activity` | `activity_template`, `goal` | `activity_template`, `analysis` | Full template replacement |

---

## Shape/Resolver Gaps for Vessel Development

### What exists and works

The substrate can today execute a limited class of vessel development tasks:

1. **Scaffold new vessel boilerplate** — `scaffold-new-vessel` writes package.json, tsconfig, config.ts, and a resolver dispatch stub given a `cwd` variable. No LLM required.
2. **Add/edit a single resolver** — `add-resolver-to-vessel` can read a file, apply an exact-match edit, stage, and commit. Atomic but requires caller to pre-compute `oldString`/`newString`.
3. **Restart a vessel after code change** — `systemd_restart` resolver in development-vessel handles `make -C scripts/substrate substrate-restart-<vessel>` equivalent.
4. **LLM-guided template drafting** — `draft-gap-closing-activity` and `Forge Vessel For Shape` can produce new `activityTemplate` JSON for registration.
5. **Topology coverage measurement** — `coverage_tick` and `reachable_unlearned_report` let the substrate know which shapes exist but have no executing templates.
6. **Memory persistence** — `memoryNote` / `memoryNote_write` now live in development-vessel, closing IAL gate 27.3.j.1.

### Critical gaps

**Gap 1 — No `shell` resolver in development-vessel (only `local-tools-vessel` has it)**  
`local-tools-vessel` (port 8240) advertises `shellResult` but does NOT appear in the discovery registry's 7-vessel list (based on health stats). The development-vessel has no general command-execution resolver. This means: `bun install`, `bun typecheck`, `bun test` cannot be run from a template. The `Forge Vessel For Shape` template references `scaffold_vessel_skeleton` and `wire_discovery_registration` resolvers that are not registered in development-vessel (they appear as template task resolver names but the resolvers themselves don't exist as development-vessel shapes).

**Gap 2 — No `run_tests` or `typecheck` shape**  
Complex vessel development requires validating TypeScript compilation and running the test suite against the new code. There is no resolver that can run `bun test` in a given `cwd` and return structured pass/fail output. The `harness-check-scenario` template validates scenarios but against activity-api's execution engine, not a local build step.

**Gap 3 — `add-resolver-to-vessel` requires pre-computed diffs**  
The template takes `oldString`/`newString` as input impulses — it cannot compute *what* to change. It has no LLM reasoning step. For multi-file changes (e.g., adding a resolver AND updating the dispatch switch AND updating config.ts with a new shape name), this requires multiple sequential calls with computed arguments. There is no template that orchestrates multi-file LLM-guided changes as a unit.

**Gap 4 — No `git_push` resolver**  
development-vessel has `git_commit` but not `git_push`. Completing the loop (local → substrate-restart → test → push → CI) requires operator intervention at the push step.

**Gap 5 — `Forge Vessel For Shape` resolvers not wired**  
The forge template references `scaffold_vessel_skeleton` and `wire_discovery_registration` as resolver IDs in its task graph, but these are not registered as shapes in development-vessel. The template would fail at those task steps.

**Gap 6 — No `bun_install` / `package_install` resolver**  
After `scaffold-new-vessel` writes the file tree, installing dependencies (`bun install`) cannot be triggered from a template.

---

## Proposed Routing for a Complex Dev Goal

**Goal:** "Implement Phase 2 of analysis-vessel — add `code_annotation` resolver with line-range support"

```
goal-host-vessel (port 8210)
  → selects template via Thompson sampling
  → "add-resolver-to-vessel" or constructs multi-step composition

Step 1: READ existing resolver file
  resolver: fs_read (development-vessel)
  input: { path: "/vessels/analysis-vessel/src/index.ts" }
  output: fileContent (bound to impulse pool)

Step 2: LLM generates new resolver code
  resolver: llm_completion_dispatch (development-vessel)
  input: fileContent + goal description
  output: llm_completion (new resolver implementation string)

Step 3: WRITE new resolver file  
  resolver: fs_write (development-vessel)
  input: { path: "/vessels/analysis-vessel/src/resolvers/code-annotation.ts", content: ... }
  output: fileWriteResult

Step 4: EDIT dispatch switch in index.ts
  resolver: fs_edit (development-vessel)
  input: { path: ..., oldString: "default:", newString: "case 'code_annotation': ...\n  default:" }
  output: fileEditResult

Step 5: bun install + bun typecheck  ← GAP: no resolver exists
  resolver: shell_command  [MISSING]
  input: { cwd: "/vessels/analysis-vessel", command: "bun install && bun typecheck" }
  output: commandResult

Step 6: RESTART vessel
  resolver: systemd_restart (development-vessel)
  input: { unit: "analysis-vessel" }
  output: systemd_unit_restart

Step 7: VALIDATE via health check
  resolver: http_fetch (development-vessel)
  input: { url: "http://localhost:8250/health" }
  output: httpFetchResult

Step 8: GIT commit
  resolver: git_commit (development-vessel)
  input: { cwd: "/workspace", message: "feat(analysis-vessel): add code_annotation resolver" }
  output: gitCommitResult

Step 9: git push  ← GAP: no resolver exists
  resolver: git_push  [MISSING]
```

**Context threading:** goal-host-vessel passes `parent_execution_id` and `composition_chain` through each step. Each step's output impulse IDs land in the impulse pool for the next step. The LLM resolver at step 2 sees `fileContent` from step 1 as a bound input shape.

---

## Recommended Next Shapes/Templates to Implement

Priority order based on blocking frequency:

**P1 — `shell_command` resolver in development-vessel**  
Resolves a shell command in a given `cwd` and returns structured `{ exit_code, stdout, stderr, duration_ms }`. Blocks: build validation, `bun install`, `bun test`, any subprocess-based check. Implementation: ~40 LOC wrapping `Bun.spawn`, identical pattern to `git_commit.ts`.

**P2 — `git_push` resolver in development-vessel**  
Calls `git push origin <branch>` in a given `cwd`. Needed to close the local → remote loop. Currently operators must push manually.

**P3 — `implement-vessel-resolver` composite template**  
A template that orchestrates: `fs_read` (existing file) → `llm_completion_dispatch` (generate new resolver code) → `fs_write` (new resolver file) → `fs_edit` (update dispatch switch) → `shell_command` (typecheck) → `systemd_restart` → `http_fetch` (health verify) → `git_commit`. This is the "add a resolver to an existing vessel" workflow end-to-end. Uses all existing resolvers except `shell_command`.

**P4 — Fix `Forge Vessel For Shape` resolver references**  
The `scaffold_vessel_skeleton` and `wire_discovery_registration` task resolvers don't exist. Either register them as development-vessel shapes backed by LLM calls, or rewrite those tasks to use `llm_completion_dispatch` + `fs_write` sequences.

**P5 — `validate-vessel-build` template**  
Combines: `shell_command` (bun install) → `shell_command` (bun typecheck) → `shell_command` (bun test) → produces `buildValidationReport`. Input: `cwd`. Reusable across all vessel development goals.

---

## analysis-vessel Migration as a Reference Task

**What commit `06bd8c04` actually did (6 files changed, 215 insertions):**
- Created `repos/analysis-vessel/src/index.ts` — a single-file `VesselDaemon` vessel (~300 LOC) using `@avigopal/ias-executor-ts`. Six inline resolver handlers (`sourceCode`, `errorLog`, `problemDetection`, `codeQuality`, `codeAnnotation`, `cpgQueryResult`) each implemented as 20-50 LOC closures.
- Added `scripts/substrate/units/analysis-vessel.service` (22 lines systemd unit).
- Extended `Dockerfile.substrate` with a build stage for analysis-vessel.
- Added `scripts/substrate/Makefile` targets (sync, restart, logs, health).
- Added migration spec at `openspec/changes/2026-05-25-metabob-vessel-migration/design.md`.
- Updated `validation/state/agent-coordination.json` with F-069 Thompson fix.

**Which operations map to existing shapes:**

| Migration step | Existing shape | Can substrate do it? |
|---------------|----------------|---------------------|
| Read existing `metabob-analysis-api` source for patterns | `fs_read` | Yes |
| Generate resolver implementations from source | `llm_completion_dispatch` | Yes (one resolver at a time) |
| Write `src/index.ts` with all resolvers | `fs_write` | Yes |
| Write `package.json`, `tsconfig.json` | `fs_write` | Yes (via `scaffold-new-vessel`) |
| Write systemd unit file | `fs_write` | Yes |
| Run `bun install` | **MISSING** | No — `shell_command` needed |
| Run `bun typecheck` | **MISSING** | No — `shell_command` needed |
| Add Dockerfile stage | `fs_edit` | Yes (exact-match edit) |
| Add Makefile targets | `fs_edit` | Yes |
| Commit all changes | `git_commit` | Yes (but one path at a time via `git_add`) |
| Push to dev | **MISSING** | No — `git_push` needed |
| Validate vessel health post-restart | `http_fetch` + `systemd_restart` | Yes |

**Conclusion:** 9 of 12 migration steps have working resolvers. The two blockers — `shell_command` (for `bun install`/`bun test`) and `git_push` — are both single-resolver additions requiring ~40-60 LOC each in `repos/development-vessel/src/resolvers/`. Once those land and are wired into an `implement-vessel-resolver` template, the substrate can self-author the analysis-vessel migration (minus the multi-file coordination logic, which requires the P3 composite template).

The actual migration was done in one operator session. The substrate's primary gap is not reasoning capability (the LLM resolver handles that) but orchestration capability: it lacks the `shell_command` resolver that lets it validate its own build artifacts before committing.
