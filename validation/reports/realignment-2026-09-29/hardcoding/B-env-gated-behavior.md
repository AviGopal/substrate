# Topic B — env/constant-gated behavior (law 1) — 2026-10-01, read-only

Method: regex over repos/*/src (*.ts/js/tsx, excl tests/.d.ts/node_modules) for process.env.X, process.env['X'], env.X/env['X']. Heuristic name classifier with spot corrections. Lower bound (helper wrappers missed). Live-set = names in /etc/substrate/env + unit Environment= + EnvironmentFiles of vessel units.

## Counts (name x repo rows; 722 rows, 499 distinct names)
```
repo                              i   ii  iii iii-live-set
activity-api                     45   22   86 9
analysis-vessel                   8    1    0 0
boredom-vessel                   19   13    8 1
concept-db                       27    1    4 0
conversation-vessel               7    0    0 0
development-vessel              112   22   37 2
discovery-vessel                 14    0    2 2
goal-host-vessel                 25   12   20 3
human-surface-vessel             12    0    0 0
ias-executor-ts                  19    3    1 0
identity-vessel                  31    1    5 1
libp2p-federation-transport       9    1    0 0
light-dispatch-vessel             5    2    4 0
llm-resolver-vessel              17    5    7 4
local-tools-vessel               11    3    1 0
metabob-cloud-dashboard           9    0    1 0
metric-collector-vessel           5    0    0 0
obsidian-vessel                   2    0    1 0
react-renderer                   10    1    1 0
relevance-sink-vessel            10    0    0 0
ribosome-vessel                   9    3    2 0
stateful-ui-vessel                9    0    0 0
terminal                          5    1    1 0
user-vessel                      18    1    3 0
workbench                         7    0    1 0
```

Behavior names read at module scope (frozen at boot): >=57 of 185 rows; rest read per call or in startup config objects.

## Full behavior (iii) list, with live status
```
activity-api	AUTO_PROMOTE_MIN_SAMPLES	default
activity-api	AUTO_PROMOTE_MIN_SUCCESS_RATE	default
activity-api	CLUSTER_SHADOW_SAMPLE_RATE	default
activity-api	CROSS_SIG_REPUTATION_MIN_GLOBAL_OBS	default
activity-api	CROSS_SIG_REPUTATION_PENALTY	default
activity-api	DB_POOL_ENABLED	default
activity-api	DENSE_BACKFILL_ENABLED	default
activity-api	DENSE_EMBEDDING_HNSW_ENABLED	default
activity-api	DUAL_WRITE_ENABLED	default
activity-api	EMBEDDING_MODEL	default
activity-api	EMBEDDING_PRIOR_ENABLED	SET
activity-api	EMBEDDING_PRIOR_OBSERVER_ENABLED	SET
activity-api	EMBEDDING_PROVIDER	default
activity-api	EMBEDDING_SEND_DIMENSIONS	default
activity-api	EMPIRICAL_BADNESS_FLOOR	default
activity-api	EMPIRICAL_BADNESS_MIN_OBS	default
activity-api	EMPIRICAL_BADNESS_MIN_RATE	default
activity-api	EXEMPLAR_BURST_THRESHOLD	default
activity-api	EXEMPLAR_N	default
activity-api	EXEMPLAR_SELECTOR_ENABLED	default
activity-api	EXEMPLAR_SELECTOR_RUN_ON_BOOT	default
activity-api	GRADED_YIELD_SUCCESS	default
activity-api	HEARTBEAT_WORKER_ENABLED	default
activity-api	LEARNING_TRACK_CLASSIFIER_ENABLED	default
activity-api	LEARNING_TRACK_MIN_SAMPLES	default
activity-api	LEARNING_TRACK_SAMPLE_WINDOW	default
activity-api	LEARNING_TRACK_SHAPE_LEARNING_THRESHOLD	default
activity-api	LEARNING_TRACK_SHAPE_SYSTEM_THRESHOLD	default
activity-api	LEARNING_TRACK_TASK_LEARNING_THRESHOLD	default
activity-api	LEARNING_TRACK_TASK_SYSTEM_THRESHOLD	default
activity-api	LOG_FORMAT	default
activity-api	M1_OBSERVER_FEATURE_DIM	default
activity-api	M1_OBSERVER_KAPPA	default
activity-api	M1_OBSERVER_LAMBDA	default
activity-api	M1_OBSERVER_MIN_OBS	default
activity-api	M1_OBSERVER_REFIT_TRIGGER	default
activity-api	M1_OBSERVER_WINDOW	default
activity-api	PARADIGM_READ_ENABLED	default
activity-api	PARADIGM_READ_NO_FALLBACK	default
activity-api	PARADIGM_READ_PERCENTAGE	default
activity-api	PRIOR_SEED_ENABLED	default
activity-api	PRIOR_SEED_K	default
activity-api	PRIOR_SEED_KAPPA	default
activity-api	PRIOR_SEED_TIMEOUT_MS	default
activity-api	PROMOTE_GATE_DISABLED	default
activity-api	PROMOTE_GATE_K	default
activity-api	PROMOTE_GATE_THRESHOLD_MEAN	default
activity-api	PROMOTE_GATE_THRESHOLD_SAMPLES	default
activity-api	RECOMMEND_SIGNATURE_SAMPLING_FLOOR	default
activity-api	REPAIR_SIGNATURE_CONSUME	default
activity-api	RUNTIME_TRACING_ENABLED	default
activity-api	SF_BLEND	default
activity-api	SF_BLEND_WEIGHT	default
activity-api	SF_DISCOUNT	default
activity-api	SF_TOPK	default
activity-api	SIGNATURE_CARDINALITY_CAP	default
activity-api	SIGNATURE_CLUSTER_MIN_SIMILARITY	default
activity-api	SIGNATURE_CLUSTER_N_MIN	default
activity-api	SUCCESSOR_FEATURES	default
activity-api	TASK_GENERATION_ENABLED	SET
activity-api	TD_LAMBDA	default
activity-api	THOMPSON_SAMPLING_SEED	default
activity-api	TRACE_RETENTION_ACTIVITIES	default
activity-api	TRACE_RETENTION_AUTO	default
activity-api	TRACE_RETENTION_AUTO_MAX	default
activity-api	TRACE_RETENTION_CEILING_BUDGET_MS	default
activity-api	TRACE_RETENTION_CEILING_PER_SWEEP_CAP	default
activity-api	TRACE_RETENTION_DEFAULT_FAILURE_CAP	SET
activity-api	TRACE_RETENTION_DEFAULT_SUCCESS_CAP	SET
activity-api	TRACE_RETENTION_DRY_RUN	SET
activity-api	TRACE_RETENTION_ENABLED	SET
activity-api	TRACE_RETENTION_GLOBAL_CEILING	default
activity-api	TRACE_RETENTION_GLOBAL_CEILING_ENABLED	SET
activity-api	TRACE_RETENTION_ORPHAN_BUDGET_MS	default
activity-api	TRACE_RETENTION_ORPHAN_REAP_CAP	default
activity-api	TRACE_RETENTION_ORPHAN_REAP_ENABLED	default
activity-api	TRACE_RETENTION_OVERRIDES	default
activity-api	TRACE_RETENTION_ROW_SAMPLE_N	default
activity-api	TRACE_STORE_CAP	SET
activity-api	TRACE_STORE_SUCCESS_SAMPLE_ACTIVITIES	default
activity-api	TRACE_STORE_SUCCESS_SAMPLE_RATE	default
activity-api	UCB_GRADED_MEAN	default
activity-api	VESSEL_CLEANUP_ENABLED	default
activity-api	YIELD_COST_REF	default
activity-api	YIELD_FLOOR	default
activity-api	YIELD_PROD_REF	default
boredom-vessel	BOREDOM_DAEMON_MODE	SET
boredom-vessel	BOREDOM_DISPATCHER_EXPLORATION_RATE	default
boredom-vessel	BOREDOM_EXERCISE_BUDGET	default
boredom-vessel	BOREDOM_MOMENTUM_DEMOTION_FLOOR	default
boredom-vessel	BOREDOM_PRIORITY_WEIGHT_HIGH	default
boredom-vessel	BOREDOM_PRIORITY_WEIGHT_MEDIUM	default
boredom-vessel	BOREDOM_SIG_CONTINUITY_GAIN	default
boredom-vessel	EXTERNAL_DEMAND_EVERY	default
concept-db	CONCEPT_DENSE_BUDGET_MS	default
concept-db	DENSE_BACKFILL_ENABLED	default
concept-db	EMBEDDING_CACHE_CAPACITY	default
concept-db	LOG_FORMAT	default
development-vessel	ANCHOR_REGION_SLACK_LINES	default
development-vessel	CUTOVER_PRECHECK_SUITE	default
development-vessel	DETECTOR_RETIREMENT_EMIT_CAP	default
development-vessel	DETECTOR_RETIREMENT_MIN_GAPS	default
development-vessel	DOC_FIX_AUTOLAND	default
development-vessel	DOC_FIX_MODEL	default
development-vessel	GAP_CLASS_OPEN_CAP	default
development-vessel	GAP_TYPECHECK_MAX_RUNS_PER_PASS	default
development-vessel	GENERATIVE_HEADROOM_THRESHOLD	default
development-vessel	LEARNING_MODE_COMPLETENESS_LOW	default
development-vessel	LEARNING_MODE_EMPHASIS	default
development-vessel	LEARNING_MODE_FLOOR	default
development-vessel	LEARNING_MODE_HYSTERESIS	default
development-vessel	LEARNING_MODE_SHAPE_BOOST	default
development-vessel	LEARNING_MODE_TOP_SHAPES	default
development-vessel	MAX_NEW_RESOLVERS_PER_HOUR	default
development-vessel	MITOSIS_CUTOVER_SKIP_SYSTEMCTL	default
development-vessel	MITOSIS_DIRECT_PUSH	SET
development-vessel	MITOSIS_HOST_SYNC_MODE	default
development-vessel	MITOSIS_SKIP_CLONE_RESET	default
development-vessel	MITOSIS_VESSEL_CLONES	default
development-vessel	OBSIDIAN_ASSIST_MODEL	default
development-vessel	OBSIDIAN_RENDER_BOARD	default
development-vessel	PREFER_LIBP2P_ROUTE	SET
development-vessel	QUIESCE_MARKER	default
development-vessel	REUSE_BEFORE_MINT	default
development-vessel	ROUTE_FEATURE_PROPOSALS_TO_COMPOSE	default
development-vessel	SEMANTIC_CUTOVER_GATE	default
development-vessel	STALE_PROPOSAL_MAX_AGE_DAYS	default
development-vessel	SUBSTRATE_ALLOWED_BRANCH_PATTERNS	default
development-vessel	SUBSTRATE_GAP_SKIP_COMPOSE_TRIGGER	default
development-vessel	SUBSTRATE_MERGE_COMPREHENSIBILITY_FLOOR	default
development-vessel	SUBSTRATE_MERGE_CONVERGENT_VALIDITY_FLOOR	default
development-vessel	SUBSTRATE_MERGE_PHANTOM_DELTA_MAX	default
development-vessel	SUBSTRATE_MERGE_PRECONDITION_DELTA_MAX	default
development-vessel	WEB_RESOURCE_ALLOWLIST	default
development-vessel	WRITE_ALLOWLIST	default
discovery-vessel	MAX_PEER_DEPTH	SET
discovery-vessel	PEER_FANOUT_MODE	SET
goal-host-vessel	GOAL_HOST_DISABLE_SUBSCRIBERS	default
goal-host-vessel	GOAL_HOST_FETCH_PROBE	default
goal-host-vessel	GOAL_HOST_HORIZONTAL_K	default
goal-host-vessel	GOAL_HOST_NOOP_SINK	default
goal-host-vessel	GOAL_HOST_WALK_MAX_STEPS	default
goal-host-vessel	GOAL_HOST_WS_SUBSCRIBER	SET
goal-host-vessel	LLM_MODEL	default
goal-host-vessel	LLM_ROUTER_DISABLED	default
goal-host-vessel	MITOSIS_BASE_VESSEL	default
goal-host-vessel	PEER_SUBSTRATE_LABELS	default
goal-host-vessel	PREFER_LIBP2P_ROUTE	SET
goal-host-vessel	ROUTE_ACTIVITY_REPAIR	default
goal-host-vessel	ROUTE_EDIT_INTENT_TO_COMPOSE	SET
goal-host-vessel	SATISFIER_PROVEN_BAD_ARMED	default
goal-host-vessel	SUBSTRATE_AUTHORING_DECISION_EMIT	default
goal-host-vessel	SUBSTRATE_AUTO_DRAFT_ENABLED	default
goal-host-vessel	SUBSTRATE_AUTO_DRAFT_EXPLORE_FLOOR	default
goal-host-vessel	SUBSTRATE_AUTO_DRAFT_THRESHOLD	default
goal-host-vessel	SUBSTRATE_REUSE_LLM_ENABLED	default
goal-host-vessel	SYMBOL_PROPOSAL_SAMPLES	default
ias-executor-ts	ANTHROPIC_MODEL	default
identity-vessel	ALWAYS_TRACE_FAILURES	default
identity-vessel	LOGIN_SKIP_DUMMY_HASH	default
identity-vessel	RATE_LIMIT_ALLOWLIST_IPS	SET
identity-vessel	SCHEMA_AUTOAPPLY	default
identity-vessel	TRACE_SAMPLE_RATE	default
light-dispatch-vessel	LIGHT_DISPATCH_RETIRE_MAX_PER_SWEEP	default
light-dispatch-vessel	LIGHT_DISPATCH_RETIRE_MIN_SAMPLES	default
light-dispatch-vessel	LIGHT_DISPATCH_RETIRE_WINDOW	default
light-dispatch-vessel	LIGHT_DISPATCH_WORKDIR	default
llm-resolver-vessel	LLM_DEFAULT_MODEL	SET
llm-resolver-vessel	LLM_MAX_TOOL_ITERATIONS	default
llm-resolver-vessel	LLM_PINNED_PROVIDER	default
llm-resolver-vessel	LLM_PROVIDER	default
llm-resolver-vessel	RUNPOD_COST_PER_MTOK	SET
llm-resolver-vessel	RUNPOD_MODELS	SET
llm-resolver-vessel	VLLM_MODELS	SET
local-tools-vessel	WEB_SEARCH_MODEL	default
metabob-cloud-dashboard	VITE_ENABLE_ACTIVITY_VIEWS	default
obsidian-vessel	USERPROFILE	default
react-renderer	DISCOVERY_ENABLED	default
ribosome-vessel	RIBOSOME_REPLAY_MAX_PER_TEMPLATE	default
ribosome-vessel	RIBOSOME_REPLAY_WEIGHT	default
terminal	MODE	default
user-vessel	DISCOVERY_ENABLED	default
user-vessel	LOG_FORMAT	default
user-vessel	SCHEMA_AUTOAPPLY	default
workbench	VITE_ENABLE_DEVTOOLS	default
```

## Infra tuning (ii)
```
activity-api	ACCELERATOR_FLAG_INTERVAL_MS	default
activity-api	CONCEPT_DB_CLUSTER_TIMEOUT_MS	default
activity-api	CONCEPT_DB_EMBED_TIMEOUT_MS	default
activity-api	DB_POOL_MAX	default
activity-api	EMBEDDING_LOOKUP_CACHE_SIZE	default
activity-api	EMBEDDING_LOOKUP_TIMEOUT_MS	default
activity-api	EXEMPLAR_BULK_DELAY_MS	default
activity-api	EXEMPLAR_SELECTOR_INTERVAL_MS	default
activity-api	IMPULSE_DECAY_HALF_LIFE_SECONDS	default
activity-api	LEARNING_TRACK_CADENCE_MS	default
activity-api	M1_OBSERVER_REFIT_INTERVAL_MS	default
activity-api	REPLICATION_INTERVAL_MS	default
activity-api	REPLICATION_MAX_BATCHES	default
activity-api	REPLICATION_PULL_LIMIT	default
activity-api	SIGNATURE_CLUSTER_INTERVAL_MS	default
activity-api	SIGNATURE_CLUSTER_MAX_SIZE	default
activity-api	SURREAL_MAX_CONCURRENT_QUERIES	default
activity-api	TRACE_RETENTION_DELETE_BATCH	default
activity-api	TRACE_RETENTION_GLOBAL_CEILING_BYTES	default
activity-api	TRACE_RETENTION_HOT_WINDOW_MS	default
activity-api	TRACE_RETENTION_INTERVAL_MS	default
activity-api	TRACE_RETENTION_ORPHAN_MIN_AGE_MS	default
analysis-vessel	ANALYSIS_VESSEL_GC_INTERVAL_MS	default
boredom-vessel	BOREDOM_AUTOPROMOTE_INTERVAL_MS	SET
boredom-vessel	BOREDOM_DISPATCHER_COMPARISON_INTERVAL	default
boredom-vessel	BOREDOM_EXERCISE_COOLDOWN_MS	default
boredom-vessel	BOREDOM_EXERCISE_INTERVAL_MS	SET
boredom-vessel	BOREDOM_EXERCISE_SUCCESS_RETRY_MS	default
boredom-vessel	BOREDOM_IDLE_DEMOTION_WINDOW_MS	default
boredom-vessel	BOREDOM_IDLE_WINDOW_SECONDS	SET
boredom-vessel	BOREDOM_IN_FLIGHT_TIMEOUT_MS	SET
boredom-vessel	BOREDOM_MAX_CONCURRENT	SET
boredom-vessel	BOREDOM_MIN_DISPATCH_INTERVAL_MS	SET
boredom-vessel	BOREDOM_POOL_LOOP_INTERVAL_MS	SET
boredom-vessel	BOREDOM_STATE_REFRESH_MS	SET
boredom-vessel	GAP_GOAL_COOLDOWN_MS	default
concept-db	SURREAL_MAX_CONCURRENT_QUERIES	default
development-vessel	COMPOSE_CEILING_MS	default
development-vessel	COMPOSE_DRAIN_MIN_INTERVAL_MS	default
development-vessel	COMPOSE_MAX_CONCURRENT	SET
development-vessel	COMPOSE_SLOT_STALE_MS	default
development-vessel	CUTOVER_LEASE_WAIT_MS	default
development-vessel	DEV_VESSEL_CUTOVER_STAGE_MS	default
development-vessel	DEV_VESSEL_DRAIN_FRESH_MS	default
development-vessel	DEV_VESSEL_GC_INTERVAL_MS	default
development-vessel	EXPECTATION_SCAN_INTERVAL_MS	default
development-vessel	GAP_COMPOSE_COOLDOWN_MS	default
development-vessel	GAP_DRAIN_OBSERVER	default
development-vessel	GAP_TYPECHECK_CACHE_TTL_MS	default
development-vessel	MITOSIS_DRAIN_WAIT_MS	default
development-vessel	MITOSIS_GOALHOST_RESTART_DELAY_S	default
development-vessel	MITOSIS_PENDING_STALE_MS	default
development-vessel	MITOSIS_SELF_RESTART_DELAY_S	default
development-vessel	MITOSIS_SELF_RESTART_QUIESCE_MAX_S	default
development-vessel	MITOSIS_STAGED_MAX_AGE_MS	default
development-vessel	OPSTATE_SNAPSHOT_MAX_AGE_MS	default
development-vessel	QUIESCE_MAX_MS	default
development-vessel	RESTART_BREADCRUMB_FRESH_MS	default
development-vessel	SUBSTRATE_HEARTBEAT_PATH	default
goal-host-vessel	EDIT_INTENT_COMPOSE_TIMEOUT_MS	default
goal-host-vessel	EXPECTATION_HEARTBEAT_STALE_MS	default
goal-host-vessel	EXPECTATION_WATCHDOG_INTERVAL_MS	default
goal-host-vessel	GOAL_FAILURE_MEMORY_PATH	default
goal-host-vessel	GOAL_HOST_DRAIN_FRESH_MS	default
goal-host-vessel	GOAL_HOST_DRAIN_MS	SET
goal-host-vessel	GOAL_HOST_GC_INTERVAL_MS	default
goal-host-vessel	GOAL_HOST_PROXY_TIMEOUT_MS	default
goal-host-vessel	MEM_DUMP_PATH	default
goal-host-vessel	REACHED_CMD_CACHE_PATH	default
goal-host-vessel	REACH_VERDICT_SPOOL_PATH	default
goal-host-vessel	SIGNATURE_CACHE_MS	default
ias-executor-ts	EXECUTOR_INPUT_RESOLUTION_TIMEOUT_MS	default
ias-executor-ts	IMPULSE_RESOLVE_TIMEOUT_MS	default
ias-executor-ts	VESSEL_DRAIN_MS	SET
identity-vessel	IDENTITY_USER_ACCOUNTS_CACHE_TTL_MS	default
libp2p-federation-transport	FED_RESOLVE_TIMEOUT_MS	default
light-dispatch-vessel	LIGHT_DISPATCH_ARTIFACT_TTL_MS	default
light-dispatch-vessel	LIGHT_DISPATCH_GC_INTERVAL_MS	default
llm-resolver-vessel	LLM_EXHAUSTION_COOLDOWN_MS	default
llm-resolver-vessel	LLM_RATE_LIMIT_COOLDOWN_MS	default
llm-resolver-vessel	LLM_RESOLVER_GC_INTERVAL_MS	default
llm-resolver-vessel	LLM_UNAUTHENTICATED_COOLDOWN_MS	default
llm-resolver-vessel	LLM_UNREACHABLE_COOLDOWN_MS	default
local-tools-vessel	LOCAL_TOOLS_GC_INTERVAL_MS	default
local-tools-vessel	TEST_EXEC_MAX_CONCURRENT	default
local-tools-vessel	TEST_EXEC_SLOT_STALE_MS	default
react-renderer	DEBUG	default
ribosome-vessel	RIBOSOME_REPLAY_LLM_TIMEOUT_MS	default
ribosome-vessel	RIBOSOME_REPLAY_TRACE_FETCH_LIMIT	default
ribosome-vessel	RIBOSOME_VESSEL_GC_INTERVAL_MS	default
terminal	DEBUG	default
user-vessel	DISCOVERY_HEARTBEAT_INTERVAL_MS	default
```

## Top behavior gates by decision impact (file:line, default, live)
Credit/posterior: PROMOTE_GATE_THRESHOLD_MEAN activity-api routes/activities.ts:4272 (0.6); AUTO_PROMOTE_MIN_SAMPLES activities.ts:3682 (20); SIGNATURE_CLUSTER_MIN_SIMILARITY lib/signature-cluster.ts:61 (0.6, module); LEARNING_TRACK_* jobs/learning-track-classifier.ts:26; RECOMMEND_SIGNATURE_SAMPLING_FLOOR activities.ts:6472 (5); horizontalK goal-host selection-tuning.ts:82 (4; credit divided by it); in-process tagBoost/historyBoost activities.ts ~6725-6860 (REALIGNMENT 2.6).
Admission/dispatch: GAP_CLASS_OPEN_CAP dev substrate-gap.ts:874 (3); COMPOSE_MAX_CONCURRENT compose-slots.ts:110 (live-set); REUSE_BEFORE_MINT activity-create-variant.ts:805 (enforce); BOREDOM_DISPATCHER_EXPLORATION_RATE boredom index.ts:41 (0.15, module); BOREDOM_PRIORITY_WEIGHT_* index.ts:2148 (module); SUBSTRATE_AUTO_DRAFT_ENABLED/THRESHOLD goal-host index.ts:16285 (off/0.3); MAX_NEW_RESOLVERS_PER_HOUR apply-proposal-as-patch.ts:973 (2); LEARNING_MODE_* learning-mode.ts:57 (module).
Verdict/landing: SEMANTIC_CUTOVER_GATE feature-compose.ts:643 (on, module); SUBSTRATE_MERGE_*_FLOOR gh-pr-merge.ts:61 (0.5); ROUTE_EDIT_INTENT_TO_COMPOSE goal-host index.ts:12791 (live-set); SATISFIER_PROVEN_BAD_ARMED index.ts:9861 (off); DOC_FIX_AUTOLAND doc-drift-fix.ts:182 (off).
Walk shape: maxTargetShapes goal-target-inference.ts:798 (3) / index.ts:12483 (6); GOAL_HOST_WALK_MAX_STEPS (40); LLM_MAX_TOOL_ITERATIONS llm-resolver index.ts:476 (20, module); patch-with-tools MAX_ITERATIONS=30.
Retention: TRACE_RETENTION_* (9 live-set) activity-api services/trace-retention.ts:169-259; dryRun:false observed in journal (pruning active).

## Shaped-policy mechanisms (prior art)
A. goal-host file-policy-as-shape: $WORKSPACE_ROOT/policies/<name>.json served by goal-host /resolve (walkBudget, bodyHonestyPolicy, extractionPolicy, pathwayReusePolicy, lessonExecutionPolicy, dispatchRatePolicy). Effective dir = /workspace/git/super-repo/policies (gitignored; /workspace/policies is a stale copy). walkBudget: 205 SHAPED / ~16 fallback in 24h — WORKS (file only sets max_iters=8). Live log lacks obsExcerpt fields present in source => deployed goal-host predates source (inference). bodyHonestyPolicy: 12x "NOT advertised in discovery — FALLING BACK" in 24h though file exists and goal-host lists it in SHAPES; read via endpointForShape (discovery) vs walkBudget via ufExecuteTool — address failure, unattributed. dispatchRatePolicy: live (SPEND-RATE REFUSED lines). Durability hazard: 734e458b "something erases them".
B. activity-api getTuningParam: substrate_tuning_param table -> env -> literal, 30s TTL; POST/GET /v2/tuning-params REST write seam; writer development-vessel learning-policy-writeback. 12 params routed (TD_LAMBDA, SF_BLEND, YIELD_*, EMPIRICAL_BADNESS_FLOOR, EMBEDDING_PRIOR_ENABLED, RETIREMENT_*...). NOT an advertised shape. REALIGNMENT 3.3: "promote to an advertised shape".
C. per-vessel policy resolvers: dev-vessel learningPolicy/pushPolicy/repairPolicy/docFixPolicy (+ *_POLICY_PATH files); llm-resolver llmModelPolicy (learner-written, rev 27, updated today — the only policy the system writes itself); human-surface renderPolicy/surfaceIntent; dev-vessel learningMode (boredom reads it ~1,400x/day — works, but its own thresholds are env LEARNING_MODE_*).
D. goal-host selection-tuning.json (edgeBlendK, maxWalkSteps, horizontalK): row->env->default order, file not present live => defaults.
E. ribosome extractionEligibilityPolicy: 534 "unresolved — falling back to literal" /24h; no stored doc.
timeShapedRhythm: REALIGNMENT marks disposition broken. autonomyScope: pool record, read by feature-compose/gap-to-feature.

## Detector for the class
development-vessel env-gate-scan.ts (registered config.ts:548, impulses.ts:680): targets UNSET env vars that disable a capability; explicitly EXEMPTS inline-default reads ("tuning, not gating") = the law-1 set. GUARD_RE line is corrupted (repeated ?? alternatives, mangled quoting). 0 ticks in journal over 3d (only a 401 discover). Historic gap-env-gated-* landings (8+ substrate-authored mitosis cutovers in dev-vessel/activity-api) — none remain in gap store; a198907 was "a hollow, env-gated constant read only by a log", closed verified (raw/live-pool-memory.md).

## Prior conversions
activity-api d3d29da (EMBEDDING_PRIOR_ENABLED), d81ab34 (POSTERIOR_COALESCE) via getTuningParam, env kept as middle tier; dc0dee8 classified POSTERIOR_FLUSH_MS as plumbing. goal-host f65556be/d96304c4 (MAX_STEPS, HORIZONTAL_K, edge blend -> selection-tuning.json); walkBudget reader shipped without producer (08-16), fixed. Dev-vessel 47096a74/e2d61581 model literals -> "auto" (llmModelPolicy). docs/operations/CONFIGURATION_SURFACE.md (46e80627, 08-21) defines tier-1 behavioural vs tier-2 bootstrap; measured 52 unit-file names, 48 nowhere else. Open gaps: trace-persistence-and-retention-...-environment-variables (+ -narrowed), the-compose-lane-cap-is-an-env-var-frozen-at-boot.
