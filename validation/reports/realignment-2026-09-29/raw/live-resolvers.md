# Live resolvers — shard notes (source: live-resolvers)

Measured 2026-09-29 ~04:00Z, read-only, against `substrate-live` (hub, node 1) and
`compose2-live` (node 2, profile `compute`). Live clones: `/workspace/git/vessels/*`.
Discovery: `GET :8100/registry/stats|shapes|shape-descriptions|events`, `GET :8100/vessels/<id>`
(ApiKey auth). Traces: SurrealDB `activity-system/learning_loop`.

## 0. Measurement caveat (changes every number below)

| Table | Rows | Window | Notes |
|---|---|---|---|
| `execution` | 149,783 (cap 150,000 in `trace_store_counters`) | effectively **09-24 → 09-29 (5 days)**; 28 rows older | Holds `failure_mode.reason`. `validator-dispatch` 47,732 + `auth_resolve_v1` 21,427 = **46 % of the cap** is telemetry, evicting real traces. |
| `execution_trace_content` | 513,148 | 08-22 → 09-29 (30+ days) | Task-level `resolver_id`, `output_shapes`, `status`. **Stores NO error text** (keys: description, input/output ids/shapes, resolved_config, resolver_id, resolver_tier, status, success, task_id, tool_calls). Since 09-27: 5,742 failed tasks, **0** with error text. Content outlives its `execution` row (orphaned blobs). Anomaly: 54,669 rows on 08-30 alone (not chased). |
| `trace_digest` | 1,984 | 09 only | digest of recent executions |
| `activity_execution_traces` | 18,135 | **all 2026-07** | fossil table, frozen |
| `impulse_resolution_metrics`, `routing_trace`, `tool_usage`, `llm_resolution_log`, `impulse_usage_history`, `execution_system_traces`, `vessel`, `vessel_capabilities`, `shape_definition` | **0** | — | dormant/never-populated tables |

Consequence: "which resolvers have traces in the last 30 days" was answered from
`execution_trace_content` (task level) only. **Why** anything failed is only answerable for the last
~5 days, and only when the writer populated `failure_mode.reason`. Successful task content survives 30+
days; failure reasons evict in ~5. This is the "failure side has no store" class (memory 09-22)
recurring at the trace-store layer.

"Unseen" below = never a traced task `output_shapes` entry or `resolver_id` in 30 days. It is **not**
proof of death: policy shapes (`walkBudget`, `bodyHonestyPolicy`, `extractionPolicy`,
`lessonExecutionPolicy`, `learningMode`, `llmModelPolicy`, ...) are read directly over HTTP by
goal-host/boredom/llm-resolver without producing a trace — itself a violation of "every execution is
traced" (the reads that steer behavior are invisible to the learning loop).

## 1. Discovery registry — what is live

Hub: `totalVessels 11, totalShapes 405, healthy 11`. Node 2: `8 vessels, 325 shapes` (83 hub-only
shapes; 3 node-2-only: `federation_probe`, `federation_verification_report`, `substrateBootstrap`).

| vesselId (hub) | endpoint | resolve_endpoint | shapes | identity |
|---|---|---|---|---|
| activity-api-local | 127.0.0.1:8080 | `/v2/impulses/resolve` (rel) | 66 (64 distinct) | unverified |
| analysis-vessel-local | 127.0.0.1:8250 | `http://localhost:8250/resolve` (**abs**) | 6 | unverified |
| concept-db-local | 127.0.0.1:8260 | `/v2/impulses/resolve` | 27 (21 distinct) | unverified |
| development-vessel-local | `host.containers.internal:18090` | `/v2/impulses/resolve` | 264 (260 distinct) | **verified** (only one) |
| goal-host-vessel | 127.0.0.1:8210 | `http://127.0.0.1:8210/resolve` (**abs**) | 14 | unverified |
| human-surface-vessel | 127.0.0.1:8310 | `http://127.0.0.1:8310/v2/impulses/resolve` (**abs**) | 11 | unverified |
| light-dispatch-vessel | 127.0.0.1:8280 | `/dispatch` | 1 | unverified |
| llm-resolver-vessel | 127.0.0.1:8220 | `http://localhost:8220/resolve` (**abs**) | 6 | unverified |
| local-tools-vessel | 127.0.0.1:8230 | `http://localhost:8230/resolve` (**abs**) | 34 | unverified |
| relevance-sink-vessel | 127.0.0.1:8255 | `http://127.0.0.1:8255/v2/impulses/resolve` (**abs**) | 1 | unverified |
| stateful-ui-vessel | 127.0.0.1:8270 | `/resolve` | 8 | unverified |

Running but **not registered**: `ribosome-vessel` (:8240, healthy), `identity-vessel` (:8101, health says
`discovery: pending, registered:false`), `boredom-vessel` (consumer), discovery itself.
Hub `federation-transport-vessel.service` = **disabled**; hub `/bootstrap` returns `relay_multiaddrs: []`,
`discovery_endpoint: ""`. Node 2 runs `federation-transport-vessel@spoke-66684ac4` (:8401).

Writer inconsistency at the routing fixed point: 6 vessels advertise an **absolute** `resolve_endpoint`,
4 relative, 1 `/dispatch`. Discovery `/register` does not normalize it; every consumer re-derives the
URL (see endpoint-routing).

Only 10 of 11 vessels are `unverified` identity — the registry identity mechanism (`ffd1d58`, 09-22) is
live but nearly unused.

Shape descriptions: 312 of 405 described (93 undescribed). Learned-description POST exists
(`discovery index.ts` "auto-describe tick, 2026-06-28").

## 2. Resolver source inventory (live clones)

| vessel | clone HEAD | resolver files (non-test) | notes |
|---|---|---|---|
| development-vessel | f451e42 2026-09-29 | **255 files, 75,049 lines** in `src/resolvers/`; route switch `src/routes/impulses.ts` has 257 `case`s | 260 registered shapes; `config.ts` `discovery.shapes` is the single source |
| ias-executor-ts | 700ceff 09-28 | 16 (`llm-prompt`, `impulse-resolve`, `activity`, `learning-signal-writer`, `impulse-preparation`, `iteration`, `validation`, `producer-selection`, `impulse-pool-selection`, `verify-three-invariants`, `scaffold-vessel-skeleton`, `wire-auth-blueprint`, `wire-discovery-registration`, `docker-build-push`, **`helmfile-sync`**, `resolvers.ts`) | k8s-era resolvers (`helmfile-sync`, `docker-build-push`, `wire-*`, `scaffold-vessel-skeleton`) have **0 traces in 30 d** — fossils |
| concept-db | d844020 09-28 | 8 | 21 distinct shapes, only 5 seen in traces |
| obsidian-vessel | 1bd0226 08-22 | 30 | no unit on hub (served from the human's Obsidian); `obsidian_deliver_assist` last traced 09-19 |
| identity-vessel | bcbcc18 08-26 | 4 | not registered |
| goal-host-vessel | bc99f91 09-28 | 2 (`vessel-scaffold-dispatch-resolver`, `loopC-vessel-designer-resolver`) + a ~16k-line `src/index.ts` | both resolvers: 0 traces |
| boredom-vessel | 12bb26a 09-28 | 1 (+ `.d.ts` build residue checked into `src/resolvers`) | `vesselAdditionScaffoldDispatch` 0 traces |
| ribosome-vessel | 5a374df 09-02 | 1 (`vessel-scaffold-dispatch-result`) | registers `shapes: []` |
| local-tools / llm-resolver / stateful-ui / human-surface / light-dispatch / analysis | — | resolvers inline in `index.ts` | |
| cpg-inference-ts (06-23), metric-collector-vessel (09-07) | — | no unit running on hub | clone-only fossils |

Dev-vessel route/registration mismatches:
- handled in `routes/impulses.ts` but **not registered**: `db_contention_observer`, `doc_drift_fix`, `gap_to_feature` (so `gap_to_feature` is reachable only by direct POST, never by discovery routing).
- registered but **no case** (malformed names from substrate-authored resolvers): `code_quality with substantive assessment content`, `obsidian:note with project list content`, `obsidian:ui_screenshot`, `obsidian:vessel_count`, `light-dispatch-vessel_status`, `template_success_ranking_24h`.
- 26 resolver files match no registered shape (helpers like `types`, `http-retry`, `workspace-roots`, `attempt-checks`, plus `behavioral-verification`, `causal-adjudication`, `region-probe`, `ui-screenshot`, `ui-write-passthrough`, `operator-review-patch`, `compose-workspace`, `federated-llm-egress`, ...). `behavioral_verification`, `causal_adjudication`, `region_probe`, `gap_to_feature`, `doc_drift_fix`: **0 traces as resolver_id in 30 d**.

Hardcoded `127.0.0.1:8xxx`/`localhost:8xxx` literals (non-test src): development-vessel **342**, goal-host 28,
boredom 11, ias-executor 10, ribosome 8, activity-api 8, human-surface 7, others ≤4. activity-api also
carries 9 `*.svc.cluster.local` k8s defaults (`config.ts:270`, `routes/impulses.ts:1394`, `:3887`,
`services/auth.ts:245`, `routes/connections.ts:306`, `routes/boredom.ts:45`, ...).

## 3. Resolver usage in traces (30 d, task level, `execution_trace_content`)

347 distinct `resolver_id`s, 312 distinct output shapes. Top by volume (uses / successes):
`llm-prompt` 452,460/450,620 · `impulse-resolve` 281,754/281,545 · `activity` 273,484/270,918 ·
`learning_signal_writer` 224,024 (100 %) · `json_path_extract` 212,085 · `impulse_preparation` 93,082 ·
`iteration` 93,082 · `gap_to_scenario_bridge` 41,778 · `signature_cluster_scan` 29,668 ·
`mitosis_pending_observer` 27,055 · `vessel_mitosis_evaluate` 25,863 · `vessel_mitosis_cutover` 24,715 ·
`llm_completion_dispatch` 23,628 · `http_fetch` 19,051/13,855 · `fs_write` 18,987 · `shellResult` 11,505/7,104.

Volume is dominated by internal plumbing and ticks (mitosis 77k tasks, scanners/observers); edit-landing
resolvers are tiny: `feature_compose` 924 tasks, `git_commit` 46, **`git_push` 65 → 6 successes**,
`gh_pr_create` 1, `patch_with_tools` 2, `author_producer` 3, `author_composed_capability` 25/6,
`apply_proposal_as_patch` 96/9, `test_suite` 112/95.

Low-success resolvers (≥50 uses, <50 % success):

| resolver_id | uses | ok | rate |
|---|---|---|---|
| `walk` | 4803 | 0 | 0% (bookkeeping rows "walk-satisfier-failed-*", FAILURE-RECALL records — not a resolver) |
| `problem_detection` | 4281 | 448 | 10% |
| `activity:⟨auto-bridge-problem_detection⟩` | 3446 | 216 | 6% |
| `source_code` | 3145 | 296 | 9% |
| `git_branch_create` | 2393 | 0 | **0%** (no error text stored — cause unknown) |
| `substrateGap_write` | 1572 | 89 | 5% (`missing_required_field` 298×) |
| `concept_write` | 1200 | 114 | 9% (concept-db POST unreachable / 400) |
| `activity:⟨auto-bridge-source_code⟩` | 1077 | 30 | 2% |
| `execution_trace` | 781 | 26 | 3% (`execution-trace fetch failed: 404` — evicted rows) |
| `uiFeedback_write` | 569 | 6 | 1% |
| `learned-auto-bridge-problem-detection-1r2k9x` | 463 | 0 | 0% ("is not registered" 305×) |
| `fs_edit` | 372 | 70 | 18% (`path outside workspace root: /vesse…` 161×, `file not found: ""` 78×) |
| `condition` | 219 | 0 | 0% ("Resolver 'condition' is not registered" 88×) |
| `null` | 300 | 0 | 0% (tasks with no resolver id) |
| `fs_list` | 111 | 5 | 4% |
| `llm_completion` | 212 | 42 | 19% |

The `resolver_id` column is overloaded: it carries activity ids (`activity:⟨…⟩` 65+ ids, `learned-*` 35,
`satisfier:*`), pseudo-resolvers (`walk`, `null`, `condition`) and real resolvers — 70 `activity:*` ids
and ~35 `learned-*` ids are not registered anywhere in discovery.

## 4. Execution-level outcomes (5-day window, `execution`)

46,591 failures in window; after checking `failure_mode.reason`, `error_message` and `error.message`,
**26,970 failures carry no reason in any field**: `auth_resolve_v1` 20,636, `satisfier:project_thread_scan`
1,620, `universal-tool-fallback` 1,532, `feature_compose` 474, `satisfier:goal-host-walk-failed` 433,
`satisfier:activity_metrics` 389, `satisfier:shellResult` 318, ...

Selected activity success (5 d): `feature_compose` 382 ok / 1,567 fail (**20 %**);
`universal-tool-fallback` (the ReAct floor) 318 / 1,600 (**17 %**); `validator-dispatch` 47,575 / 179;
`auth_resolve_v1` 792 / 20,636; `slot-binding` 9,775 / 2; `gap-to-scenario-bridge-tick` 17,966 / 17;
`mitosis-tick` 6,983 / 891; `ribosome-extract` 1,456 / 3.

Top failure reasons (normalized): `fetch() URL is invalid` 7,373 direct + ~2,500 via compose sub-activities;
`dev-vessel http_fetch … Unable to connect` 1,740; `development-vessel is draining` 790 (+62 on
feature_compose); `execution-trace fetch failed` 391; `goal or target_template_id is required` 381;
`learned-auto-bridge-problem-detection-* is not registered` 305; `substrateGap_write missing_required_field`
298; `composition chain depth has reached the cap` 284; `llm_completion_dispatch … cascading` 228;
`requires shape 'filePaths' but no matching impulses` 189; `convergent_validity[degraded]` 184; `fs_edit
path outside workspace root` 161; `concept_write concept-db POST` 160; `federation_verification_report
unreachable` 159 + not-registered 94; `fs_read path outside workspace root: /workspace/validation/...` 152;
`Resolver 'condition' is not registered` 88; `federation_probe` 70 + 56; `refusing cutover on protected
vessel: discovery-vessel` 60.

## 5. Findings by problem class

### endpoint-routing
- **Resolve-URL joiner — same failure, three hats.** Memory 09-22: `asResolvePath` returns an ABSOLUTE url for absolute rows; call sites prepend `endpoint` → invalid URL → "no producer". Attempt 1: `goal-host 6c98916` (09-22 07:12, substrate-authored "rawresolve-concatenates-an-absolute-resolve-endpoint…", 1 line). After it, `fetch() URL is invalid` failures continued: 09-24 1,751 · 09-25 1,562 · 09-26 3,422 · 09-27 2,196 · 09-28 897 (≈9.8k; top: `auto-bridge-problem_detection` 2,107, `auto-bridge-source_code` 1,000, `auto-bridge-shellResult` 527). Attempt 2: `goal-host 5ca51be` (09-28 13:00, "resolve-url-walk-path-sites-7457-15128", 2 lines: inline `startsWith('http')` ternaries at `index.ts:7457` and `:15128`). Last invalid-URL hour: 09-28T13. After 14:00: `auto-bridge-problem_detection` 64 ok / 5 fail, `auto-bridge-source_code` 32/4. **Outcome: partial.** The hot path is fixed; the seam is not: `asResolvePath` (`goal-host index.ts:448`) still returns absolute URLs and is concatenated after `endpoint` at `index.ts:9460, 12746, 12776, 13507, 13519, 13994, 14347, 16678, 16797`; `index.ts:8251` (`${sep0.endpoint}${sep0.resolvePath}` terminal-write envelope probe) and `development-vessel feature-compose.ts:538` (`${v.endpoint}${v.resolve_endpoint}`) are unguarded. Their live impact is unmeasured (the envelope probe sits in a try/catch). Root: discovery `/register` stores `resolve_endpoint` in 3 formats and nobody normalizes it at the fixed point; each fix patches call sites one by one.
- `stateful-ui` pin: `development-vessel/src/resolvers/ui-write-passthrough.ts:25`, `docs-decision-deliver.ts:42`, `docs-decision-answer-scan.ts:151`, `compute-state-signature.ts:46` default to `http://127.0.0.1:8270`; `STATEFUL_UI_VESSEL_ENDPOINT` is **unset** in the unit and env file, so the default is live. Seed drafting prompts `seed/draft-gap-closing-activity.ts:118` and `seed/draft-activity-from-pattern.ts:138` teach the drafter `substrateGap_write → http://127.0.0.1:8270/v2/impulses/resolve` (wrong vessel — dev-vessel serves it).
- 342 host:port literals in dev-vessel src; 9 k8s `svc.cluster.local` defaults in activity-api.
- `development-vessel-local` advertises `http://host.containers.internal:18090` (unit env `VESSEL_ADVERTISE_ENDPOINT`), node 2 `…:26090`. It works on podman (169.254.1.2, 200 OK), but every hub-local call to dev-vessel leaves the container through the host port mapping — a host dependency (law 11).
- Node 2 registry events show a stray registrant `activity-api-activity-api` → `http://activity-api.activity-system.svc.cluster.local:8230` (3 events, then evicted as dead). **Source unknown**; the `impulses.ts:3887` string is an mcpTool advertisement, not a `/register`.

### directed-overshoot
- **`discovery-vessel 7cc9da4` (09-19, operator: "validate register payloads and evict dead rows at resolve time")** added `shapes must be a non-empty array` (`index.ts:336`) for audit tests. `ribosome-vessel` registers `shapes: []` by design (`index.ts:697`, "owns no impulse shapes; it's a consumer"). Result: `register failed: 400 — vessel will be unreachable via discovery` every 60 s, **4,560 times since 09-26** (first in journal 09-25 13:11), silently. Identity-vessel also fails its initial registration (21 failures since 09-26; health `registered:false`); cause not confirmed to be the same 400. The fix worked for its target and regressed a consumer — no test registered a consumer-only vessel.

### human-surface-escalation
- `stateful-ui-vessel` (the replaced surface) is still active: 794 panels (480 on 09-22 per memory). Kinds: `gap_needs_human` 336, `gap_pending_verification` 270, `gap_needs_localization` 77, `info` 50, `gap_reland_needs_human` 26, `question` 21, `code_change` 11. **318 panels created 09-22→09-28**, after the 09-22 finding "248 escalations asked of a vessel no human reads". Store `feedback` array: 5 entries total, the latest a `needs-human-DURABILITY-PROBE` dismiss (09-25). **Outcome: the 09-22 diagnosis did not stop the flow — recurred.**
- `ui*` shapes have 2–3 owners (human-surface, stateful-ui, dev-vessel passthrough). `uiFeedback_write` 569 tasks / 6 ok. `interactor*`, `uiQuestion`, `uiFeedback`: no traced output in 30 d.

### write-read-mismatch
- identity `services/trace.ts` sets `error_message` only in the catch path; an ordinary rejected credential (`result.authenticated=false`) posts no reason → 20,636 `auth_resolve_v1` failures in 5 d with `org_id: unknown`, `signatureValid:false`, no reason. ~4k failed authentications per day from an unidentified caller — nobody reads them.
- `execution_trace_content` task rows drop the error field, so the 30-day store has no failure reasons; the reason lives only on `execution.failure_mode.reason` (5-day window). Example: `exec_do2syv76` content says `fs_read` `status:failure` with no detail; the `execution` row says `path outside workspace root: /workspace/validation/failure-modes/scenarios/…` (file exists: 4,573 scenario files there).
- Dev-vessel route handles `gap_to_feature`/`doc_drift_fix`/`db_contention_observer` but never registers them; registers 6 shapes it has no `case` for.
- 9 case/underscore shape twins registered side by side: `fossilRankReport/fossil_rank_report`, `gitDiff/git_diff`, `llmCompletion/llm_completion`, `sourceCode/source_code`, `templateAuditReport/template_audit_report`, `activityTemplate/activity_template`, `failureCountReport/failure_count_report`, `activityMetrics/activity_metrics`, `gitStatus/git_status`. Traces use both (`llmCompletion` 313/77, `llm_completion` 212/42).

### sync-deploy-drift
- `fs_read`/`fs_edit` "path outside workspace root" (152 + 161 in 5 d, still firing after 09-28T14: 7): templates and gap-closing activities built against `/workspace/validation/...` and `/vessels/...` roots, while dev-vessel's workspace root is elsewhere. The same root split as memory 09-22 ("WORKSPACE_ROOT=/workspace vs env-file super-repo"), recurring in a different resolver.
- `development-vessel is draining for restart` refused 790 + 62 feature_compose tasks in 5 d.

### hollow-landing / false-verification
- `gap-closing:pull-sync-unhealthy-activity-api-1784251158497` (gap minted ~07-17) ran **1,490 times in 5 days** (1,424 "success"), about 300/day. Its gap id is not in `/workspace/git/super-repo/gaps/gaps.json` (0 matches). A closing activity for a gap that no longer exists keeps firing and scoring success.
- `gap-closing:vessel-demand-activityExecutionTrace-2026-06-07-…` still dispatched on 09-28 (tag `escalated_from:trace-store-reconcile-2026-09-24`) and fails on the workspace-root check.
- `gap-closing:model-opportunity-gap_landability-1781690425999` 144 runs; boredom journal shows `[exercise] completed proposal gap-closing:… outcome=success` every few seconds.
- `validator-dispatch` 47,575 "successes" in 5 d (~6.6/min) — the largest single traced activity, telemetry-grade.

### trace-store-db
- `execution` cap 150k fills in ~5 days; 46 % is `validator-dispatch` + `auth_resolve_v1`. Retention exemption list is env-gated: `activity-api/src/services/trace-retention.ts:158` `TRACE_RETENTION_ACTIVITIES ?? 'validator-dispatch,slot-binding'`.
- `execution_trace_content` is not reclaimed with its execution (513k rows vs 150k executions).
- Nine tables are empty (see §0); `activity_execution_traces` is a July fossil.

### federation-p2p / node-locality
- Hub `federation-transport-vessel` unit disabled; `/bootstrap` advertises no relay. Hub-side failures: `federation_verification_report` unreachable 159 + not registered 94; `federation_probe` 70 + 56 (5 d). The shapes exist only on node 2's registry.
- Node 2 (compute profile) registers 8 vessels / 325 shapes; 83 hub-only shapes (activity-api, concept-db, …) must resolve cross-node.

### codebase-bloat-fossils / duplicates
- **29 multi-owner shapes** on the hub. Across vessels: `fs_read/fs_write/fs_edit/fileWriteResult/git_status/git_diff/git_commit` (dev-vessel + local-tools); `uiPanel_write/uiQuestion_write` (dev + human-surface + stateful-ui); `interactor*`, `uiQuestion`, `uiFeedback` (human-surface + stateful-ui); `concept`, `concept_write` (concept-db + dev); `mcpTool` (activity-api + concept-db); `poolImpulse_write` (dev + goal-host). Within one vessel's array: `assessment_summary`, `code_locality_mining_tick`, `learningMode`, `concept`×2 (dev); `concept_*_write`×2 (concept-db); `goal_verification_label(_write)`×2 (activity-api).
- 5 non-identifier shape names registered: `code_quality with substantive assessment content`, `obsidian:note with project list content`, `obsidian:ui_screenshot`, `obsidian:vessel_count`, `light-dispatch-vessel_status`.
- Unseen registered shapes (no traced output in 30 d): activity-api 27/64, concept-db 16/21, dev-vessel 84/260 (including `author_new_resolver`, `docs_align_scan`, `docs_align_bridge`, `env_gate_scan`, `escalation_disposition_apply`, `fossil_rank_report`, `gh_pr_merge`, `git_log`, `intervention_evaluate`, `rhythm_conductor_tick`, `selectionEntropy`, `surrealdb_export/import`, 9 `obsidian_*`), goal-host 8/14 (all policy shapes, read untraced), human-surface 7/11, stateful-ui 6/8, local-tools 8/34 (`code_*` edit helpers, `web_search`), llm-resolver 2/6 (`llmModelPolicy`), light-dispatch 1/1.
- Dev-vessel 255 resolver files / 75k lines. Trace-id families: 35 `*scan*`, 17 `*observer*`, 16 `*report*`, 11 `*audit*`, 6 `*tick*` ids active. Most observers succeed near 100 % (e.g. `substrate_heartbeat_observer` 942/942, `detector_meta_scan` 897/897, `generative_frontier_gap_tick` 855/855); whether they yield findings anyone consumes is not measured here.
- ias-executor k8s resolvers (`helmfile-sync`, `docker-build-push`, `wire-auth-blueprint`, `wire-discovery-registration`, `scaffold-vessel-skeleton`, `verify-three-invariants`, `producer-selection`, `impulse-pool-selection`): 0 traces.
- `/workspace` (container) has 197 top-level entries including residue (`FINAL_ANSWER.txt`, `GOAL_COMPLETION_CERTIFICATE.txt`, `BROKEN-goal-host-index-2026-09-03T0514.ts.bak`, `_manual_overlay_broken`, `3_plus_3_note.md`, `and`, `archived-mitosis-2026-06-03`); `/workspace/git/super-repo/gaps/` has 14 stray `gaps.json.*.tmp` files; `boredom-vessel/src/resolvers/*.d.ts` build output is checked in.

### goal-walk-floor
- `universal-tool-fallback` (the ReAct-floor path): 318 ok / 1,600 fail in 5 d, 1,532 failures with **no reason recorded**. The floor is running at ~17 % and its failures are uninspectable.
- `feature_compose`: 20 % success in 5 d; `git_push` 6/65; `git_branch_create` 0/2,393 with no error text.

### env-gating
- `TRACE_RETENTION_ACTIVITIES` (activity-api) decides which traces are kept; `STATEFUL_UI_VESSEL_ENDPOINT` default decides where escalations go; `VESSEL_ADVERTISE_ENDPOINT` decides how the hub reaches dev-vessel. None of these is observable as a shape.

### selection-learning
- `thompson_selection_log` sample: `candidates_count 656`, alpha=beta=1 (uninformed) for a learned activity — selection over 656 candidates with many n≈0 arms (sample only; not quantified here).

## 6. Mechanisms (general vs specific; used or not)

| mechanism | location | general? | status | evidence |
|---|---|---|---|---|
| Discovery registry + `/resolve` gateway | discovery-vessel `src/index.ts`, `registry.ts` | general | live-used | 11 vessels / 405 shapes; the one routing fixed point |
| Registrant identity + event ring + liveness guard | discovery `ffd1d58` (09-22) | general | live-used (partial) | events carry key/user/org; only dev-vessel `verified`, 10 `unverified` |
| Register payload validation | discovery `7cc9da4` `index.ts:336` | general | broken for consumers | ribosome 400 ×4,560 |
| Learned shape descriptions | discovery `POST /registry/shape-descriptions` | general | live-used | 312/405 described |
| Duplicate-policy-aware candidate pick / `distribution_policy` | discovery `7e051d7`, `6ab2e24` (07-30/31) | general | unknown | not verified here which of the 29 multi-owner shapes it disambiguates |
| `asResolvePath` | goal-host `index.ts:448` | general (shared helper) | **broken** | returns absolute URL; still concatenated at 9+ sites |
| Inline absolute-URL ternaries | goal-host `index.ts:7457, 8004, 15128` | specific | live-used | 5ca51be; stopped the invalid-URL flood |
| `endpoint.replace + "/" + resolve_endpoint` joiner | goal-host `llm-router.ts:100` | specific | duplicate (third joiner) | also `human-surface routes/proxy.ts:246` |
| Dev-vessel shape list as single source | dev `config.ts` `discovery.shapes`; `index.ts:74-92` filtering | general | live-used, drifting | 3 routed-but-unregistered, 6 registered-without-case |
| Execution trace store (`execution`) | activity-api `routes/execution-traces.ts` | general | live-used, saturated | 150k cap = 5 days |
| Trace content store | `execution_trace_content` | general | live-used, lossy | no task errors; not reclaimed |
| Trace retention exemptions | activity-api `services/trace-retention.ts:158` | specific | env-gated | `TRACE_RETENTION_ACTIVITIES` |
| Auth telemetry as executions | identity `services/trace.ts` (`auth_resolve_v1`) | specific | live-used, noisy | 21,427 rows / 5 d; no reason on rejects |
| `validator-dispatch` / `slot-binding` per-fire traces | activity-api system templates | specific | live-used, dominant | 47,732 + 9,772 rows / 5 d |
| Failure recall in walk | goal-host `/run-goal` FAILURE-RECALL (`walk` rows) | general | live-used | 4,803 `walk` bookkeeping rows carry "prior hollow verdict(s)… near-miss" text |
| Vessel mitosis (evaluate/cutover/pending/tick) | dev `vessel-mitosis-*.ts` | general | live-used, heavy | 77k tasks / 30 d; how substrate commits land ("via mitosis cutover") |
| Ribosome extraction | ribosome-vessel + `ribosome-extract` | general | live-used | 1,456/1,459 ok in 5 d, though ribosome is undiscoverable |
| Stateful-ui panel store | stateful-ui `store.ts` → `/workspace/state/ui-panel-store.json` | specific | fossil still written | 794 panels, 5 feedback |
| Human-surface | :8310 | general | live-used | the surface a human reads |
| Federation transport | node 2 `:8401`; hub unit disabled | general | half-deployed | hub has no relay; federation shapes fail on the hub |
| ias-executor k8s resolvers | `helmfile-sync`, `docker-build-push`, `wire-*` | specific | fossil | 0 traces |
| goal-host scaffold/designer resolvers, boredom `vesselAdditionScaffoldDispatch`, ribosome `vessel-scaffold-dispatch-result` | — | specific | dormant | 0 traces |
| Empty tables (`routing_trace`, `tool_usage`, `impulse_resolution_metrics`, `llm_resolution_log`, `vessel`, `vessel_capabilities`, `shape_definition`, …) | SurrealDB | general (schema) | dormant | 0 rows |
| `activity_execution_traces` | SurrealDB | general | fossil | 18,135 rows, all July |
| Dev-vessel observers/scans (~70 ids) | dev `src/resolvers/*-observer|*-scan|*-audit|*-report` | mixed | live-used (volume), yield unknown | high success, consumption unmeasured |

## 7. Principles found in the source (with location)

- "REGISTRATION is the list discovery actually ROUTES on — filtering the /shapes handler alone is inert" — `development-vessel/src/index.ts:74`.
- "GRADE IT, BECAUSE AN UNGRADED TRACE IS NOT NEUTRAL" — `identity-vessel/src/services/trace.ts` (2026-08-09).
- "a decomposition planner reads this to match a goal to ANY advertised resolver from its description alone — no hand-written per-resolver hint"; "A vessel-ADVERTISED description always wins over a learned one" — `discovery-vessel/src/index.ts` (~570–600).
- "Resolves through DISCOVERY, never activity-api" — `ribosome-vessel/src/index.ts:117`.
- ribosome "owns no impulse shapes; it's a consumer" — `ribosome-vessel/src/index.ts:697` (conflicts with discovery's non-empty-shapes rule).
- Cross-cutting: every fix above was local to one call site or one resolver; the shared seam (discovery registration normalization, a single URL joiner, one trace schema with reasons) was left unchanged each time, which is why the same failures return.
