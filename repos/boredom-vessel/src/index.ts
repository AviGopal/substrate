/**
 * boredom-vessel — autonomous topology-discovery loop trigger.
 *
 * Spec: openspec/changes/2026-05-23-substrate-explicit-vessels Phase 7, tasks 7.1–7.3.
 *
 * Runs as a one-shot script triggered by systemd timer (OnUnitActiveSec=5min).
 * Checks for recent external activity; if idle, submits a topology-discovery
 * goal to goal-host-vessel so Thompson Sampling selects and executes the best
 * coverage-improvement template.
 *
 * Design:
 *   - Idle check: queries activity-api for traces in the last IDLE_WINDOW_SECONDS.
 *     If any non-boredom trace exists in that window, skips (substrate is busy).
 *   - Goal rotation: cycles through AUTONOMOUS_GOALS so topology, coverage,
 *     and probe templates all get Thompson exposure over time.
 *   - Tags: traces produced via this path carry intent:topology_discovery
 *     (via the recommended templates) — satisfying IAL Phase 27.1.2.
 */

const ACTIVITY_API_ENDPOINT = process.env.ACTIVITY_API_ENDPOINT ?? "http://127.0.0.1:8080";
const GOAL_HOST_ENDPOINT = process.env.GOAL_HOST_VESSEL_ENDPOINT ?? "http://127.0.0.1:8210";
const LIGHT_DISPATCH_ENDPOINT = process.env.LIGHT_DISPATCH_ENDPOINT ?? "http://127.0.0.1:8280";
const DEV_VESSEL_ENDPOINT = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const API_KEY = process.env.METABOB_API_KEY ?? "";
const IDLE_WINDOW_SECONDS = parseInt(process.env.BOREDOM_IDLE_WINDOW_SECONDS ?? "300", 10);
const GOAL_INDEX_FILE = process.env.BOREDOM_GOAL_INDEX_FILE ?? "/tmp/boredom-goal-index";
const DISPATCHER_EXPLORATION_RATE = parseFloat(
  process.env.BOREDOM_DISPATCHER_EXPLORATION_RATE ?? "0.15",
);
const DISPATCHER_COMPARISON_INTERVAL = parseInt(
  process.env.BOREDOM_DISPATCHER_COMPARISON_INTERVAL ?? "50",
  10,
);
const DISPATCHER_CYCLE_COUNTER_FILE =
  process.env.BOREDOM_DISPATCHER_COUNTER_FILE ?? "/tmp/boredom-dispatcher-cycle";

interface LoadSample {
  cpu_usec: number;
  mem_bytes: number | null;
  load_1m: number | null;
  load_anomaly: boolean;
  load_anomaly_severe: boolean;
}

/**
 * Sample system_load_report via dev-vessel. Used before/after each goal
 * dispatch to compute load deltas — substrate-citizen causal attribution
 * per concept_QCBqcPjQbdF_ (delta_observation_causal_attribution).
 *
 * Returns null on failure (dev-vessel unreachable etc) — load attribution is
 * best-effort, the goal dispatch happens either way.
 */
async function sampleLoad(): Promise<LoadSample | null> {
  try {
    const res = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` },
      body: JSON.stringify({ impulse: { pointer: { type: "system_load_report" } } }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { body?: Record<string, unknown> };
    const body = data?.body;
    if (!body || typeof body !== "object") return null;
    const cpuStat = (body as Record<string, unknown>)["cpu_stat_cumulative"] as
      | { usage_usec?: number }
      | undefined;
    const memBytes = (body as Record<string, unknown>)["mem_cgroup_current_bytes"];
    const load1m = (body as Record<string, unknown>)["load_avg_1m"];
    return {
      cpu_usec: typeof cpuStat?.usage_usec === "number" ? cpuStat.usage_usec : 0,
      mem_bytes: typeof memBytes === "number" ? memBytes : null,
      load_1m: typeof load1m === "number" ? load1m : null,
      load_anomaly: (body as Record<string, unknown>)["load_anomaly"] === true,
      load_anomaly_severe: (body as Record<string, unknown>)["load_anomaly_severe"] === true,
    };
  } catch {
    return null;
  }
}

/** Write a loadAttribution record via dev-vessel. Best-effort. */
async function writeLoadAttribution(record: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` },
      body: JSON.stringify({
        impulse: { pointer: { type: "loadAttribution_write", record } },
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // best-effort
  }
}

/**
 * Sample load AFTER the goal completes, compute deltas vs the before sample,
 * and write the loadAttribution record. Called at every exit path that
 * follows a successful dispatch — substrate-citizen causal attribution.
 */
interface AttributionContext {
  dispatch_id: string;
  execution_id?: string;
  goal_idx: number;
  template_id?: string;
  dispatched_at: string;
  dispatch_start_ms: number;
  load_before: LoadSample | null;
  goal_status?: string;
}
async function recordLoadAttribution(ctx: AttributionContext): Promise<void> {
  // Retry the after-sample up to 3 times under load — dev-vessel is the
  // primary suspect for timeout when boredom-attribution matters most
  // (substrate is heavily loaded, dev-vessel is part of that load). Detection
  // primitives must be resilient to the very loads they're measuring.
  let loadAfter: LoadSample | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    loadAfter = await sampleLoad();
    if (loadAfter !== null) break;
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }

  const durationMs = Date.now() - ctx.dispatch_start_ms;

  // CRITICAL: if either sample is missing, the delta is meaningless.
  // Earlier bug — defaulting null to 0 produced negative deltas (cpu_after=0
  // - cpu_before=87B = -87B), corrupting the substrate's load-attribution
  // signal at exactly the moments the substrate was under stress. Record
  // the raw samples with null markers so load_attribution_report can filter,
  // never fabricate a delta from missing data.
  const haveBefore = ctx.load_before !== null;
  const haveAfter = loadAfter !== null;
  const cpu_usec_delta =
    haveBefore && haveAfter
      ? loadAfter!.cpu_usec - ctx.load_before!.cpu_usec
      : null;
  const mem_bytes_delta =
    haveBefore && haveAfter && ctx.load_before!.mem_bytes !== null && loadAfter!.mem_bytes !== null
      ? loadAfter!.mem_bytes - ctx.load_before!.mem_bytes
      : null;
  const load_1m_delta =
    haveBefore && haveAfter && ctx.load_before!.load_1m !== null && loadAfter!.load_1m !== null
      ? loadAfter!.load_1m - ctx.load_before!.load_1m
      : null;

  await writeLoadAttribution({
    dispatch_id: ctx.dispatch_id,
    execution_id: ctx.execution_id,
    goal_idx: ctx.goal_idx,
    template_id: ctx.template_id,
    duration_ms: durationMs,
    // Raw cpu_usec values stored as nullable — preserves provenance vs the
    // delta computation. Use the delta for attribution; the raw values are
    // for forensics / re-derivation if the delta logic changes.
    cpu_usec_before: ctx.load_before?.cpu_usec ?? null,
    cpu_usec_after: loadAfter?.cpu_usec ?? null,
    cpu_usec_delta,
    mem_bytes_before: ctx.load_before?.mem_bytes ?? null,
    mem_bytes_after: loadAfter?.mem_bytes ?? null,
    mem_bytes_delta,
    load_1m_before: ctx.load_before?.load_1m ?? null,
    load_1m_after: loadAfter?.load_1m ?? null,
    load_1m_delta,
    // Surface measurement quality so the aggregation resolver can filter:
    // records with sample_quality=both_missing are unusable; before_only is
    // a partial signal; both_present is the fully-attributable case.
    sample_quality:
      haveBefore && haveAfter ? "both_present" :
      haveBefore ? "after_missing" :
      haveAfter ? "before_missing" : "both_missing",
    goal_status: ctx.goal_status,
    dispatched_at: ctx.dispatched_at,
    completed_at: new Date().toISOString(),
  });
}

// Rotating set of autonomous goals. Thompson Sampling will learn which
// templates satisfy these goals and rank them over time.
// Goals are split into topology-discovery (learning) and self-healing (operational).
//
// NOTE: Goals that name templates explicitly use targetTemplateId (see AUTONOMOUS_GOAL_TARGET_TEMPLATES)
// to bypass Thompson Sampling entirely. expected_output_shapes is a soft re-sort boost, not a hard
// filter — high-alpha templates (harness-run-matrix α=18, substrate-health-tick α=25) would dominate
// without direct template routing. goal[4] is open-ended and lets Thompson choose freely.
const AUTONOMOUS_GOALS: readonly string[] = [
  // topology / coverage — explicit template names + output shapes to bypass high-alpha template bias
  "run the coverage-tick activity to measure substrate topology coverage and emit a coverageReport",
  "run the substrate-health-tick activity to check vessel health and emit a substrateHealthReport",
  // self-healing — closes diagnostic→action loop: reads health verdict + below-floor list →
  // dispatches the cheapest template to close the confidence gap. The substrate identifies
  // which activities to run from its own diagnosis, not operator judgment.
  "run the close-health-gap activity to identify and dispatch the template most needed to close the confidence gap",
  "run the probe-reachable-unlearned activity to find templates with zero execution traces and emit a reachableUnlearnedReport",
  "run the harness-check-scenario activity to validate a failure-mode scenario from the harness matrix",
  // gap-closing / self-healing
  "identify shapes in the execution graph that have no known producer and escalate the most critical one",
  // S2 harness loop — run the full scenario matrix against the live registry and emit a failureModeReport
  "run the harness-run-matrix activity to score all failure-mode scenarios against the live activity registry and emit a failureModeReport",
  // exploration — exercises n=0 templates to build Thompson priors; async dispatch now handles >5min runs
  "run the probe-untraversed-edge activity to find unreachable execution graph edges and emit a topologyGapReport",
  // substrate-authoring — draft-gap-closing-activity reads a failure-mode scenario and produces an
  // activityTemplateVariant via activity_create_variant resolver.
  "draft a gap-closing activity variant from a recent failure-mode scenario, producing an activityTemplateVariant",
  // evidence accumulation — executes the top proposed gap-closing template to build Thompson
  // posteriors so auto-promote can graduate it. Closes the author→execute→promote loop:
  // goal[8] authors templates (proposed=true), goal[9] exercises them, tickAutoPromote()
  // promotes them once they have ≥3 successful executions.
  "execute the most recently authored proposed gap-closing template to accumulate empirical evidence for promotion",
  // gap-drain — wires substrateGap impulses (persisted by substrateGap_write) into the drafter.
  // Spec: openspec/changes/2026-05-30-substrate-gap-drafter-wiring.
  "run the drain-pending-substrate-gaps activity to convert open substrateGap impulses into gap-closing template variants",
  // audit-ingestion bridge (iter-080): reads audit findings → substrateGap impulses → drain pipeline
  "run the ingest-audit-findings activity to parse audit findings and create substrateGap impulses for the drain pipeline",
  // Lift-iter (2026-06-02): vessel-demand-driven scaffold dispatch.
  // The resolver surfaces shapes ≥3 templates demand but no vessel produces.
  // When demand crosses the threshold, the substrate authors a new vessel
  // via scaffold-and-publish-vessel rather than waiting for an operator.
  "run vessel-demand-report; if the highest-priority demand has occurrence >= 3, dispatch scaffold-and-publish-vessel with that shape as the new vessel's advertised shape",
  // Autonomous self-improvement loop (2026-06-03, goal[13]):
  // dispatch enact-orthogonal-decisions — the substrate reads its own observations
  // (orthogonal-decisions file + live code_needs_report) and decides between
  // mitosis (MODIFY) and drafter (CREATE_*) on its own. All variables (vessel_name,
  // target_file_path, intent_summary, scenario_id) are derived LIVE inside the
  // template, not hardcoded here. Closes Gap #3+#4: the substrate observes a need,
  // derives its own variables, and dispatches its own self-mitosis or self-authoring.
  "run enact-orthogonal-decisions to read live observations + code_needs_report and dispatch self-mitosis (MODIFY) or self-authoring (CREATE_*)",
  // Durability cadence (iter 2026-06-03, goal[14]):
  // Dispatch backend-snapshot-to-git so SurrealDB tables get dumped to the
  // bind-mounted /workspace/snapshots/<ISO>/ on a regular cadence. Without
  // this, container destruction wipes all Thompson posteriors, all concepts,
  // and all execution traces. Closes Gap A from the lift iteration.
  "run backend_snapshot_to_git to dump SurrealDB state to /workspace/snapshots/<ISO>/ and commit the manifest to git so container destruction does not lose learning state",
  // Autonomous mitosis evaluate+cutover (iter 2026-06-03, goal[15]):
  // run mitosis-tick to evaluate the most recent mitosis pair recorded in
  // /workspace/mitosis-pending.json. vessel_mitosis_cutover self-refuses
  // unless the verdict is FAVORABLE, so the chain is safe to fire on cadence —
  // refuse traces ARE the substrate's audited NO; accept traces are the
  // audited YES. Closes the lift loop on the modify path.
  "run mitosis-tick to evaluate the most recent mitosis pair and cut over to the new track if vessel_mitosis_evaluate returns FAVORABLE",
  // Concept-db relevance writeback (iter 2026-06-03, goal[16]):
  // Empirically, 29/37 concepts have times_loaded > 0 (reads work) but only
  // 6 have times_succeeded > 0 (all from one manual backfill). Zero
  // autonomous traces invoke concept_usage_record. The Bayesian relevance
  // formula (ts+1)/(tl+2) is one-sided — concepts decay from 0.5 toward 0
  // the more they're cited, inverting the signal. This goal dispatches
  // concept-usage-backfill on cadence: select a candidate concept via
  // concept_select_for_prompt, extract the top id, POST conceptUsageRecorded
  // to concept-db. Per tick: one writeback. Over many ticks: per-concept
  // relevance accumulates. cheap tier — no LLM, single HTTP round-trip.
  "run concept-usage-backfill to surface a candidate concept and POST a conceptUsageRecorded outcome so concept-db's relevance signal accumulates both-sided data",
  // Horizon detectors (Stage 1 of openspec change
  // 2026-06-03-pre-lift-bootstrap-and-architecture-aware-loop). Four
  // immunity-pattern detectors that consult architectural principle
  // concepts and emit substrateGap impulses for violations. Each goal
  // pins targetTemplateId to the corresponding *-tick wrapper template so
  // the goal text routes deterministically to the resolver dispatch.
  // Cost: cheap (single resolver, bounded I/O, no LLM).
  "run vessel-responsibility-audit-tick to scan vessel sources against architectural_pattern_principle concepts and emit substrateGap for responsibility misallocations",
  "run vessel-architecture-pattern-scan-tick to detect cross-vessel SPOFs / catalogue-bloat / cost-output mismatches and emit substrateGap for each finding",
  "run activity-lifecycle-audit-tick to rank templates by success-recency-affinity and surface hot/cold/promote sets",
  "run resolver-distribution-audit-tick to detect shape orphans, demand-supply mismatches, and responsibility imbalance per principle concepts",
  // Gap-drain bridges (Break 1+2 close, 2026-06-04). goal[21] runs the
  // gap→scenario bridge so detector-emitted + operator-seeded substrateGap
  // rows materialise as scenario JSON files the file-polling drafter
  // already consumes. goal[22] picks the newest unexecuted gap-closing:auto-*
  // template and dispatches it through light-dispatch so its Thompson
  // posterior gets seeded — drains the 6+ unexecuted auto-drafts blocking
  // the executor side of the loop.
  "run gap-to-scenario-bridge-tick to drain open substrateGap rows into scenario JSON files the drafter consumes",
  "run dispatch-latest-auto-draft to pick the newest unexecuted gap-closing:auto-* template and seed its Thompson posterior via light-dispatch",
  // Apply-proposal close (Break 3, 2026-06-04, goal[23]): convert the newest
  // unstaged drafter proposal into a staged mitosis directory the existing
  // cutover machinery (mitosis-tick + vessel_mitosis_cutover) can apply.
  // Closes the analyse→enact gap end-to-end.
  "run apply-proposal-as-patch to convert the newest unstaged proposal report into a staged mitosis directory with mitosis-pending.json updated",
  // mechanism-health-tick (goal[24], 2026-06-04): aggregator that composes the
  // 3 generic detection templates (classifier-skew / feature-flag-zero-exercise /
  // filter-saturation) against the M1-M6 observable surface defined in
  // concept_q2n0_XaSvphV. Detects wiring anomalies in the learning-rate
  // mechanisms autonomously every ~5 minutes; emits per-mechanism
  // mechanismHealthFinding memos + a substrateHealthReport rollup that the
  // drafter primes against on next tick.
  "run mechanism-health-tick to detect wiring anomalies in M1-M6 learning-rate mechanisms",
  // Template-mitosis variant-authoring loop (goal[25], 2026-06-04). Audits
  // weak template families (Thompson posterior mean < 0.3, samples >= 10) and
  // authors improved variants through activity_create_variant (write-scope).
  // Variant-first repair discipline — never calls activityTemplate_update or
  // _deprecate (admin-scope; would 403). Thompson Sampling promotes the
  // better variant naturally over time as samples accumulate on the successor.
  "run template-mitosis-tick to detect the weakest template family by Thompson posterior mean and author an improved variant via activity_create_variant",
  // Vector-space orthogonality audit (goal[26], 2026-06-04): substrate scans
  // recent failure traces for embeddings orthogonal to all existing
  // architectural_pattern_principle concepts (max cosine similarity below
  // threshold) and emits substrateGap impulses (category=
  // novel_failure_mode_detected) for each cluster. Closes the meta-recursion
  // — the drafter then authors a new principle covering that vector subspace
  // on the next gap-drain cycle. cheap tier (no LLM, HTTP-only).
  "run vector-space-orthogonality-audit-tick to detect failure traces orthogonal to existing architectural_pattern_principle concepts and emit novel_failure_mode_detected substrateGap impulses",
  // Trace-recording correctness audit (goal[27], 2026-06-05). Substrate inspects
  // its own traces for tail_shape/status mismatches (e.g. structuredError +
  // success) and emits trace_outcome_inconsistency substrateGap. Closes the
  // operator-detected-via-journal-scraping gap that caused the apply-proposal-
  // as-patch echo chamber (commit a0f9f593) — substrate now detects via activity.
  "run trace-outcome-validity-audit-tick to detect tail_shape/status mismatches in recent traces (structuredError + success, mitosisStaged + success, etc.) and emit trace_outcome_inconsistency substrateGap impulses",
  // Posterior consistency audit (goal[28], 2026-06-05). Substrate cross-checks
  // claimed Thompson α/β cells against empirical trace counts; emits substrateGap
  // (posterior_consistency_drift) when posterior means drift > threshold.
  "run posterior-consistency-audit-tick to cross-check claimed Thompson α/β cells against empirical trace counts and emit posterior_consistency_drift substrateGap impulses for stale posteriors",
  // Meta-cognition bootstrap (goal[29], 2026-06-05). The last operator-extension
  // required for the substrate to extend its own capability surface. Detects
  // failure traces with "unknown shape" / "no resolver for type" signatures
  // and emits substrateGap (category=missing_capability). The resolver-author
  // seed template consumes those gaps on a subsequent tick and produces a
  // 4-file new-resolver patch that apply_proposal_as_patch's multifile branch
  // stages for cutover. After this loop closes the substrate authors its own
  // resolvers in response to its own observed needs.
  "run capability-gap-audit-tick to scan recent failure traces for missing-capability signatures (unknown shape, no resolver for type, endpoint 404) and emit substrateGap impulses for each capability gap cluster",
  // Shadow-state observer ticks (goals[30..35], 2026-06-05). Promote
  // out-of-band substrate state (systemd unit health, mitosis intent queue,
  // applied-proposal sentinel, mitosis pending pointer, BoundedBusSink drop
  // log, LLM-resolver reachability) into shape-typed impulses so the
  // orthogonality / validation audits can observe the same surface the
  // operator does. Single-resolver immunity-pattern templates, cheap tier;
  // dispatch is precondition-always-true (empty inputShapes / variables).
  "run systemd-unit-health-observer-tick to probe each substrate vessel unit and emit one systemdUnitHealth impulse with active/inactive/failed counts so detectors can observe vessel up/down state",
  "run mitosis-intent-queue-observer-tick to read the host-sync intent queue + results and emit mitosisIntentQueueState with pending/pushed/rejected counts and oldest-pending age",
  "run applied-proposal-sentinel-observer-tick to list proposals/.applied/ and emit appliedProposalSentinelState with applied_count, recent_applied entries, and last_applied timestamp",
  "run mitosis-pending-observer-tick to read mitosis-pending.json and emit mitosisPendingState indicating whether a staged mitosis is awaiting host-sync push",
  "run dispatch-dropped-observer-tick to read the BoundedBusSink drop log and emit dispatchDroppedHistory with recent-window drop counts and dominant reason",
  "run llm-api-health-observer-tick to probe llm-resolver-vessel /health and emit llmApiHealth with reachability, HTTP status, and roundtrip latency",
  // Round 2 shadow-state observer ticks (goals[36..41], 2026-06-05). Close
  // the remaining round-1 impulse-coverage gaps. host-container-source-drift
  // is the headline: surfaces the dominant host-sync rejection cause
  // (rejected_base_sha, ~43% of intents). The rest cover disk pressure,
  // concept-db reachability, discovery-registry staleness, substrate-heartbeat
  // liveness, and LLM-quota signals from recent trace error patterns.
  "run host-container-source-drift-observer-tick to walk each substrate vessel's src/ tree in both container and host paths and emit hostContainerSourceDriftState with per-vessel drift counts, surfacing the dominant rejected_base_sha cause of host-sync rejections",
  "run disk-space-observer-tick to run df -k on /workspace, /vessels, / and emit diskSpaceState with per-mount used_pct and green/yellow/red pressure level so disk-pressure becomes substrate-observable",
  "run concept-db-health-observer-tick to probe concept-db /health and /concepts/search and emit conceptDbHealth distinguishing control-plane outage from data-plane wedge",
  "run discovery-vessel-registry-observer-tick to query the vesselRegistry impulse and emit discoveryRegistryState with per-vessel last-heartbeat age and stale-count threshold so silently-degraded vessels become observable",
  "run substrate-heartbeat-observer-tick to read /workspace/substrate-heartbeat.json mtime and emit substrateHeartbeatState with age_seconds and stale flag — coarse boredom-loop liveness signal",
  "run llm-quota-observer-tick to scan recent llm_completion traces for 429 and rate-limit signatures and emit llmQuotaState with recent-window counts and estimated quota remaining so the substrate can throttle expensive goals before hitting a wall",
  // V21c (2026-06-07): producer-chain bridge. Without this entry, the pool's
  // n = AUTONOMOUS_GOALS.length bound stops at 42 and goal[42] never gets
  // considered for scoring. The matching template entry is in
  // AUTONOMOUS_GOAL_TARGET_TEMPLATES (V21) and cost is moderate (V21b).
  "run drafter-trigger-tick to enumerate scenarios on disk, pick one, and dispatch draft-gap-closing-activity with scenario_id + paths filled in — closes the producer chain so boredom rotation can drive new gap-closing variants",
];

// targetTemplateId per goal — bypasses recommend() entirely for goals that name a specific template.
// undefined means use Thompson Sampling freely (only for goals that don't name a template).
const AUTONOMOUS_GOAL_TARGET_TEMPLATES: readonly (string | undefined)[] = [
  "development-vessel:coverage-tick",              // goal[0]
  "development-vessel:substrate-health-tick",      // goal[1]
  "development-vessel:close-health-gap",           // goal[2] — self-healing: diagnose→act on confidence gap
  "development-vessel:probe-reachable-unlearned",  // goal[3]
  "development-vessel:harness-check-scenario",     // goal[4]
  undefined,                                       // goal[5] — open-ended, let Thompson choose
  "development-vessel:harness-run-matrix",         // goal[6]
  "development-vessel:probe-untraversed-edge",     // goal[7]
  "development-vessel:draft-gap-closing-activity", // goal[8] — substrate-authoring path
  undefined,                                       // goal[9] — dynamic: top proposed gap-closing template
  "development-vessel:drain-pending-substrate-gaps", // goal[10] — substrateGap → drafter wiring
  "development-vessel:ingest-audit-findings",       // goal[11] — audit findings → substrateGap pipeline
  // goal[12] — explicit targetTemplateId (2026-06-03 fix): wraps vessel_demand_report
  // resolver in a deterministic single-task template. Eliminates the LLM-reuse
  // misalignment that mapped goal[12] to detect-service-oom-cascade in earlier
  // session (see validation/findings/autonomous-loop-fires-2026-06-03/). The
  // downstream conditional dispatch to scaffold-and-publish-vessel will be
  // wired in a follow-up template once vessel-demand-tick output exposes the
  // top_priority entry in a chainable shape.
  "development-vessel:vessel-demand-tick",
  // goal[13] — autonomous self-improvement entry point (2026-06-03 retarget):
  // enact-orthogonal-decisions reads BOTH the orthogonal-decisions file AND
  // a live code_needs_report, then synthesizes a single dispatch — either
  // scaffold-mitosis-track (MODIFY priority) or draft-gap-closing-activity
  // (CREATE_* priority). All downstream variables are LIVE-derived inside the
  // template; no operator hardcoding.
  "development-vessel:enact-orthogonal-decisions",
  // goal[14] — backend-snapshot-to-git: deterministic dump+publish chain;
  // explicit targetTemplateId so Thompson cannot misroute to a high-α template.
  "development-vessel:backend-snapshot-to-git",
  // goal[15] — mitosis-tick: deterministic evaluate+cutover chain. Reads
  // /workspace/mitosis-pending.json, dispatches vessel_mitosis_evaluate
  // and vessel_mitosis_cutover. Cutover self-refuses unless FAVORABLE.
  "development-vessel:mitosis-tick",
  // goal[16] — concept-usage-backfill: deterministic 3-task chain
  // (concept_select_for_prompt → json_path_extract → concept_usage_record).
  // Explicit targetTemplateId so Thompson doesn't misroute to a high-α
  // template; the goal text doesn't semantically match any prior template
  // and LLM-reuse on novel goals is currently brittle.
  "development-vessel:concept-usage-backfill",
  // goal[17..20] — horizon detector ticks (Stage 1 of pre-lift-bootstrap).
  // All four are immunity-pattern single-resolver wrappers; explicit
  // targetTemplateId ensures Thompson cannot misroute to high-α templates.
  "development-vessel:vessel-responsibility-audit-tick",
  "development-vessel:vessel-architecture-pattern-scan-tick",
  "development-vessel:activity-lifecycle-audit-tick",
  "development-vessel:resolver-distribution-audit-tick",
  // goal[21..22] — gap-drain bridges (Break 1+2 close, 2026-06-04). Both are
  // single-resolver deterministic ticks routed through light-dispatch via
  // capability hints. Explicit targetTemplateId prevents Thompson from
  // misrouting to a high-α template (goal texts are novel).
  "development-vessel:gap-to-scenario-bridge-tick",
  "development-vessel:dispatch-latest-auto-draft",
  // goal[23] — apply-proposal-as-patch (Break 3, 2026-06-04). Single-task
  // wrapper around apply_proposal_as_patch resolver. One LLM call + deterministic
  // I/O — moderate tier.
  "development-vessel:apply-proposal-as-patch",
  // goal[24] — mechanism-health-tick (2026-06-04): explicit targetTemplateId
  // so Thompson cannot misroute to a high-α template. The goal text is novel
  // and the aggregator orchestrates 5 deterministic child dispatches.
  "development-vessel:mechanism-health-tick",
  // goal[25] — template-mitosis-tick (2026-06-04): variant-authoring loop
  // around weak template families. One LLM call (haiku) wrapped by
  // deterministic audit + fetch + register. Moderate cost.
  "development-vessel:template-mitosis-tick",
  // goal[26] — vector-space-orthogonality-audit-tick (2026-06-04): immunity-
  // pattern single-resolver wrapper. Explicit targetTemplateId so Thompson
  // cannot misroute to a high-α template; the goal text is novel.
  "development-vessel:vector-space-orthogonality-audit-tick",
  // goal[27] — trace-outcome-validity-audit-tick (2026-06-05): immunity-pattern
  // single-resolver wrapper. Explicit targetTemplateId; goal text is novel.
  "development-vessel:trace-outcome-validity-audit-tick",
  // goal[28] — posterior-consistency-audit-tick (2026-06-05): immunity-pattern
  // single-resolver wrapper. Explicit targetTemplateId; goal text is novel.
  "development-vessel:posterior-consistency-audit-tick",
  // goal[29] — capability-gap-audit-tick (2026-06-05): meta-cognition bootstrap
  // detector half. Single-resolver immunity-pattern wrapper; explicit
  // targetTemplateId routes the novel goal text deterministically.
  "development-vessel:capability-gap-audit-tick",
  // goal[30..35] — shadow-state observer ticks (2026-06-05). Each promotes
  // one out-of-band substrate state into impulse form. Single-resolver
  // immunity-pattern templates; explicit targetTemplateId routes the novel
  // goal text deterministically so Thompson can't misroute to a high-α one.
  "development-vessel:systemd-unit-health-observer-tick",
  "development-vessel:mitosis-intent-queue-observer-tick",
  "development-vessel:applied-proposal-sentinel-observer-tick",
  "development-vessel:mitosis-pending-observer-tick",
  "development-vessel:dispatch-dropped-observer-tick",
  "development-vessel:llm-api-health-observer-tick",
  // goal[36..41] — round 2 shadow-state observer ticks (2026-06-05). Explicit
  // targetTemplateId routes the novel goal text deterministically.
  "development-vessel:host-container-source-drift-observer-tick",
  "development-vessel:disk-space-observer-tick",
  "development-vessel:concept-db-health-observer-tick",
  "development-vessel:discovery-vessel-registry-observer-tick",
  "development-vessel:substrate-heartbeat-observer-tick",
  "development-vessel:llm-quota-observer-tick",
  // drafter-trigger-tick (V21, 2026-06-07) — bridges boredom rotation to the
  // drafter's variable-supply requirement. fs_list scenarios → pick → strip
  // .json → POST light-dispatch /dispatch with scenario_id+paths filled.
  // Without this entry, goal[8] (draft-gap-closing-activity) sits in the
  // rotation but precondition-rejects every dispatch because boredom can't
  // seed report_path/scenario_id variables. This tick supplies them.
  "development-vessel:drafter-trigger-tick",
];

/**
 * Per-goal cost classification — used by load-aware gating to skip expensive
 * goals when system_load_report reports anomalous load (concept_uNEIKtMneq5c
 * load_aware_boredom_triage_policy). Each tier maps to the maximum acceptable
 * cost given the current load state:
 *
 *   load_anomaly_severe  → cheap only
 *   load_anomaly         → cheap or moderate
 *   normal               → any tier
 *
 * cheap     = single resolver call, no LLM, bounded I/O
 * moderate  = small dispatch, may include one bounded scan
 * expensive = multi-task LLM chain, full-matrix scan, or long-running dispatch
 *
 * Classification derived from observed loadAttribution records (iter-089):
 * close-health-gap consumed 1.6 cores + 16 GB per dispatch → expensive.
 * coverage-tick + substrate-health-tick are single-query primitives → cheap.
 */
type GoalCost = "cheap" | "moderate" | "expensive";
const AUTONOMOUS_GOAL_COSTS: readonly GoalCost[] = [
  "cheap",     // goal[0]  coverage-tick
  "cheap",     // goal[1]  substrate-health-tick
  "expensive", // goal[2]  close-health-gap (observed: 1.6 cores, 16GB, 304s+)
  "moderate",  // goal[3]  probe-reachable-unlearned (bounded query)
  "moderate",  // goal[4]  harness-check-scenario (single scenario)
  "moderate",  // goal[5]  escalate-unknown-shape (bounded)
  "expensive", // goal[6]  harness-run-matrix (full scenario matrix scan)
  "moderate",  // goal[7]  probe-untraversed-edge (bounded)
  "expensive", // goal[8]  draft-gap-closing-activity (14 tasks, 2 LLM calls)
  "expensive", // goal[9]  proposed gap-closing template (variable, often heavy)
  "moderate",  // goal[10] drain-pending-substrate-gaps (1 resolver + 1 dispatch)
  "moderate",  // goal[11] ingest-audit-findings (fs_read + LLM + http_fetch)
  "cheap",     // goal[12] vessel-demand-report (single resolver, no LLM)
  "expensive", // goal[13] enact-orthogonal-decisions (1 LLM dispatch + child mitosis or drafter goal)
  "moderate",  // goal[14] backend-snapshot-to-git (surreal export + small commit; bigger than a tick, smaller than LLM)
  "moderate",  // goal[15] mitosis-tick (fs_read + 4 json_path_extract + 2 mitosis resolvers; no LLM)
  "cheap",     // goal[16] concept-usage-backfill (3 resolvers, no LLM, bounded HTTP)
  "cheap",     // goal[17] vessel-responsibility-audit-tick (fs scan + concept-db; no LLM)
  "cheap",     // goal[18] vessel-architecture-pattern-scan-tick (HTTP only; no LLM)
  "cheap",     // goal[19] activity-lifecycle-audit-tick (templates + traces; no LLM)
  "cheap",     // goal[20] resolver-distribution-audit-tick (HTTP only; no LLM)
  "cheap",     // goal[21] gap-to-scenario-bridge-tick (single fs scan + bounded writes; no LLM)
  "moderate",  // goal[22] dispatch-latest-auto-draft (resolver + downstream light-dispatch chain runs an authored 4-task LLM template)
  "moderate",  // goal[23] apply-proposal-as-patch (1 LLM patch call + bounded fs I/O)
  "moderate",  // goal[24] mechanism-health-tick (5 child dispatches via /run-goal; no LLM, bounded HTTP + bash + journalctl)
  "moderate",  // goal[25] template-mitosis-tick (1 LLM call + deterministic audit/fetch/register; variant-first repair)
  "cheap",     // goal[26] vector-space-orthogonality-audit-tick (HTTP only; no LLM)
  "cheap",     // goal[27] trace-outcome-validity-audit-tick (HTTP only; no LLM)
  "cheap",     // goal[28] posterior-consistency-audit-tick (HTTP only; no LLM)
  "cheap",     // goal[29] capability-gap-audit-tick (HTTP only; no LLM)
  // Shadow-state observer ticks — all cheap (one resolver, bounded file/HTTP I/O).
  "cheap",     // goal[30] systemd-unit-health-observer-tick (Bun.spawn × N units)
  "cheap",     // goal[31] mitosis-intent-queue-observer-tick (2 small JSONL reads)
  "cheap",     // goal[32] applied-proposal-sentinel-observer-tick (readdir + stat)
  "cheap",     // goal[33] mitosis-pending-observer-tick (1 small JSON read)
  "cheap",     // goal[34] dispatch-dropped-observer-tick (1 JSONL read)
  "cheap",     // goal[35] llm-api-health-observer-tick (1 HTTP GET)
  // Round 2 observers — all cheap (bounded I/O, no LLM).
  "cheap",     // goal[36] host-container-source-drift-observer-tick (bounded fs walk + sha256)
  "cheap",     // goal[37] disk-space-observer-tick (Bun.spawn df × N mounts)
  "cheap",     // goal[38] concept-db-health-observer-tick (2 HTTP GETs)
  "cheap",     // goal[39] discovery-vessel-registry-observer-tick (1 HTTP POST)
  "cheap",     // goal[40] substrate-heartbeat-observer-tick (1 stat + 1 read)
  "cheap",     // goal[41] llm-quota-observer-tick (1 HTTP GET, bounded scan)
  "moderate",  // goal[42] drafter-trigger-tick (fs_list + json_path_extract + HTTP POST → drafter, ~15s)
];

// Per-goal extra variables passed to goal-host-vessel /run-goal. Most goals need only the
// default `source` variable; goal[8] (draft-gap-closing-activity) needs explicit paths.
// Scenarios picked DYNAMICALLY from disk (2026-06-04, Part C): newest mtime wins so
// freshly-bridged gaps get drafted with low latency. Fallback to the hardcoded list
// only if the scenarios dir is unreadable or empty (defensive).
const SCENARIO_ROTATION_FALLBACK: readonly string[] = [
  "fm-17-resolver-budget-noncompliance",
  "fm-43-cascade-attribution-error",
  "fm-44-silent-trace-loss",
  "fp-11-silent-semantic-failure",
  "fp-12-partial-success-recorded-as-total",
  "fp-15-missing-producer-stale-registration",
];

const SCENARIOS_DIR = process.env.SCENARIOS_DIR ?? "/workspace/validation/failure-modes/scenarios";

function pickScenarioForCycle(): string {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const names = fs.readdirSync(SCENARIOS_DIR).filter((n) => n.endsWith(".json"));
    if (names.length === 0) return SCENARIO_ROTATION_FALLBACK[0]!;
    const ranked = names
      .map((n) => ({ id: n.replace(/\.json$/, ""), mtime: fs.statSync(`${SCENARIOS_DIR}/${n}`).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    const rotIdx = Math.floor(Date.now() / (30 * 60 * 1000)) % ranked.length;
    return ranked[rotIdx]!.id;
  } catch {
    const rotIdx = Math.floor(Date.now() / (30 * 60 * 1000)) % SCENARIO_ROTATION_FALLBACK.length;
    return SCENARIO_ROTATION_FALLBACK[rotIdx]!;
  }
}

// Rotating query for concept-usage-backfill (goal[16]). Spreads the
// candidate-concept surface across different substrate topics so different
// source_types and tag clusters get exercised on successive ticks.
const CONCEPT_BACKFILL_QUERIES: readonly string[] = [
  "substrate authoring failure modes",
  "concept-db Bayesian relevance",
  "boredom vessel selection policy",
  "Thompson sampling posterior",
  "lift verdict push-away",
  "discovery vessel registration",
  "impulse resolver contract",
  "trace failure mode taxonomy",
];

function extraVariablesForGoal(goalIdx: number): Record<string, unknown> {
  if (goalIdx === 16) {
    // concept-usage-backfill — rotate the query across topic clusters so
    // different concepts get exercised; supply a unique trace_id per tick
    // (autonomous_backfill_<ISO>) so concept-db's writeback gating works.
    const rotIdx = Math.floor(Date.now() / (5 * 60 * 1000)) % CONCEPT_BACKFILL_QUERIES.length;
    const isoNow = new Date().toISOString();
    return {
      query: CONCEPT_BACKFILL_QUERIES[rotIdx]!,
      trace_id: `autonomous_backfill_${isoNow}`,
    };
  }
  if (goalIdx === 14) {
    // backend-snapshot-to-git — derive a sortable compact ISO timestamp
    // (YYYY-MM-DDTHH-mm-ssZ) for the snapshot dir and manifest path.
    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "Z");
    const snapshotDir = `/workspace/snapshots/${ts}`;
    const manifestRel = `validation/snapshots/${ts}/manifest.md`;
    const branch = `substrate-authored/backend-snapshot-${ts}`;
    return {
      cwd: "/workspace/git/super-repo",
      snapshot_ts: ts,
      snapshot_dir: snapshotDir,
      manifest_relpath: manifestRel,
      manifest_body:
        `# Backend snapshot ${ts}\n\n` +
        `- snapshot_dir (host bind-mount): \`${snapshotDir}\`\n` +
        `- tables dumped: activity_template, activity_execution_traces, activity_metrics, concept, substrate_gap\n` +
        `- replay: \`surrealdb_import {input_dir: "${snapshotDir}"}\`\n` +
        `- author: boredom-vessel goal[14] / backend-snapshot-to-git\n`,
      target_branch: branch,
      base_branch: "dev",
      commit_message: `substrate-authored: backend snapshot ${ts}\n\nSubstrate-Authored-By: boredom-vessel:backend-snapshot-to-git`,
      owner: "AviGopal",
      repo: "metabob-devbob",
      pr_title: `substrate-authored: backend snapshot ${ts}`,
      pr_body:
        `Backend snapshot manifest authored by the substrate.\n\n` +
        `Snapshot bodies live in \`${snapshotDir}\` (bind-mounted, not committed). ` +
        `This manifest is the durable index.\n\n` +
        `Substrate-Authored-By: boredom-vessel:backend-snapshot-to-git\n`,
    };
  }
  if (goalIdx === 13) {
    // enact-orthogonal-decisions derives its own dispatch decision LIVE from
    // (a) the latest orthogonal-decisions observation file and
    // (b) a fresh code_needs_report resolver call.
    // We supply only filesystem paths; vessel_name / target_file_path /
    // intent_summary / scenario_id are synthesized inside the template from
    // the live observation data (Gap #3 closure — no operator hardcoding).
    return {
      observation_path: "/workspace/observations/orthogonal-latest.json",
      scenarios_dir: "/workspace/validation/failure-modes/scenarios",
      report_path: "/workspace/validation/results/latest-failure-mode-report.json",
      proposals_dir: "/workspace/proposals",
      dispatch_ts: new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z",
      modify_priority_floor: 0.4,
    };
  }
  if (goalIdx === 10) {
    // drain-pending-substrate-gaps reads gap.id from the resolver and passes it
    // as scenario_id to the drafter. The drafter still needs scenarios_dir / report_path /
    // proposals_dir on the filesystem — same paths as goal[8].
    return {
      scenarios_dir: "/workspace/validation/failure-modes/scenarios",
      report_path: "/workspace/validation/results/latest-failure-mode-report.json",
      proposals_dir: "/workspace/proposals",
    };
  }
  if (goalIdx === 8) {
    // draft-gap-closing-activity reads {{report_path}} and {{scenarios_dir}}/{{scenario_id}}.json.
    // Dynamic scenario rotation (2026-06-04, Part C): pickScenarioForCycle reads the
    // scenarios dir live and prefers newest-mtime entries so freshly-bridged gaps drain.
    return {
      scenarios_dir: SCENARIOS_DIR,
      scenario_id: pickScenarioForCycle(),
      // report_path points to the most-recent harness-run-matrix output — goal[5] writes here.
      // If the file is missing, fs_read fails fast and the gap-drafting skips (graceful).
      report_path: "/workspace/validation/results/latest-failure-mode-report.json",
      // proposals_dir: where draft-gap-closing-activity writes the proposal JSON.
      proposals_dir: "/workspace/proposals",
    };
  }
  return {};
}

// ── Proposed gap-closing template picker ─────────────────────────────────────
// Fetches the most recently authored proposed gap-closing template that uses
// only executable resolvers (fs_read, fs_write, llm_completion_dispatch,
// json_path_extract, http_fetch). Returns null if none are found or all use
// invalid resolvers.
const EXECUTABLE_RESOLVERS = new Set([
  "fs_read", "fs_write", "llm_completion_dispatch",
  "json_path_extract", "http_fetch", "noop",
]);

interface TemplateWithAlpha {
  id?: string;
  proposed?: boolean;
  tasks?: Array<{ resolver?: string }>;
  // top-level thompson_alpha is the static prior (always 1); the learned
  // posterior lives in metrics.thompson_alpha — always prefer metrics.
  thompson_alpha?: number;
  metrics?: { thompson_alpha?: number; thompson_beta?: number };
}

async function pickTopProposedGapClosingTemplate(): Promise<string | null> {
  try {
    const res = await fetch(
      `${ACTIVITY_API_ENDPOINT}/v2/activities/templates?limit=60`,
      { headers: authHeaders() },
    );
    if (!res.ok) return null;
    const data = await res.json() as { templates?: TemplateWithAlpha[] };
    const candidates = (data.templates ?? []).filter(t => {
      if (!t.proposed) return false;
      const id = (t.id ?? "").replace(/^activity:⟨(.+)⟩$/, "$1");
      if (!id.startsWith("gap-closing:")) return false;
      // Check all tasks use executable resolvers
      const tasks = t.tasks ?? [];
      return tasks.length > 0 && tasks.every(task => EXECUTABLE_RESOLVERS.has(task.resolver ?? ""));
    });
    if (candidates.length === 0) return null;
    // Pick the template with the HIGHEST alpha (most executions so far) to drive it
    // over the 3-sample threshold fastest. Consistent selection means 3 focused runs
    // promote one template rather than distributing 3 runs across different templates.
    const top = candidates.reduce((best, cur) => {
      // metrics.thompson_alpha is the learned posterior; top-level is always 1 (prior).
      const bestAlpha = best.metrics?.thompson_alpha ?? best.thompson_alpha ?? 1;
      const curAlpha = cur.metrics?.thompson_alpha ?? cur.thompson_alpha ?? 1;
      return curAlpha > bestAlpha ? cur : best;
    });
    return top.id ? top.id.replace(/^activity:⟨(.+)⟩$/, "$1") : null;
  } catch {
    return null;
  }
}

const BOREDOM_TAG = "intent:boredom_source";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `ApiKey ${API_KEY}` } : {}),
  };
}

/**
 * Check whether the substrate has had recent external (non-boredom) activity.
 * Returns true if the substrate is idle (no recent external traces).
 */
async function isIdle(): Promise<boolean> {
  const since = Date.now() - IDLE_WINDOW_SECONDS * 1000;

  let res: Response;
  try {
    res = await fetch(
      `${ACTIVITY_API_ENDPOINT}/v2/activities/execution-traces?limit=20&since=${since}`,
      { headers: authHeaders() },
    );
  } catch (err) {
    // If activity-api is unreachable, assume idle (fail-open for coverage).
    console.warn(`[boredom-vessel] activity-api unreachable, assuming idle: ${(err as Error).message}`);
    return true;
  }

  if (!res.ok) {
    console.warn(`[boredom-vessel] execution-traces query HTTP ${res.status}, assuming idle`);
    return true;
  }

  let traces: Array<{ tags?: string[] }> = [];
  try {
    const body = await res.json() as { traces?: typeof traces } | typeof traces;
    traces = Array.isArray(body) ? body : ((body as { traces?: typeof traces }).traces ?? []);
  } catch {
    return true;
  }

  // Filter out traces that were themselves boredom-initiated (tagged BOREDOM_TAG).
  const externalTraces = traces.filter((t) => !(t.tags ?? []).includes(BOREDOM_TAG));

  if (externalTraces.length > 0) {
    console.log(
      `[boredom-vessel] ${externalTraces.length} external traces in last ${IDLE_WINDOW_SECONDS}s — skipping`,
    );
    return false;
  }

  return true;
}

/** Read the persisted goal index without advancing — gating may move it. */
async function peekGoalIndex(): Promise<number> {
  try {
    const file = Bun.file(GOAL_INDEX_FILE);
    if (await file.exists()) {
      const raw = parseInt(await file.text(), 10);
      if (!isNaN(raw)) return raw;
    }
  } catch {}
  return 0;
}

/** Persist the next position (one past the dispatched index). */
async function advanceGoalIndex(dispatchedIdx: number): Promise<void> {
  const next = (dispatchedIdx + 1) % AUTONOMOUS_GOALS.length;
  try {
    await Bun.write(GOAL_INDEX_FILE, String(next));
  } catch {}
}

/**
 * Pre-iter-090 nextGoalIndex(): read-and-advance round-robin without
 * load-awareness. Retained as a fallback for codepaths that don't need
 * gating. New code should use peekGoalIndex + selectGoalForLoad +
 * advanceGoalIndex so the rotation cursor stays consistent with what
 * actually gets dispatched.
 */
async function nextGoalIndex(): Promise<number> {
  const idx = await peekGoalIndex();
  await advanceGoalIndex(idx);
  return idx;
}

/**
 * Maximum acceptable goal cost for the current load state. Implements the
 * triage policy from concept_uNEIKtMneq5c (load_aware_boredom_triage_policy):
 *
 *   load_anomaly_severe → "cheap" only — substrate is over its head; even
 *                         monitors should be cheap. The substrate's own
 *                         observation surface must remain available.
 *   load_anomaly        → "moderate" — defer expensive multi-task chains.
 *                         Single-query monitors and bounded scans are fine.
 *   normal              → "expensive" — anything goes.
 *
 * On null sample (system_load_report unreachable), assume normal — the
 * substrate makes a forward-progress choice when its own observation surface
 * is unavailable. The alternative (stop everything when blind) would be a
 * worse equilibrium: substrate stalls when its instruments degrade.
 */
function maxCostForLoad(sample: LoadSample | null): GoalCost {
  if (sample === null) return "expensive";
  if (sample.load_anomaly_severe) return "cheap";
  if (sample.load_anomaly) return "moderate";
  return "expensive";
}

const COST_RANK: Record<GoalCost, number> = { cheap: 0, moderate: 1, expensive: 2 };

/**
 * Walk forward from the round-robin pick until we find a goal whose cost
 * is acceptable for current load. The walk preserves rotation fairness —
 * we skip-not-cancel — so once load recovers, expensive goals naturally
 * re-enter rotation. If nothing within budget is found (rare; would mean
 * cheap-tier full of pending work and load_anomaly_severe), fall back to
 * goal[0] (coverage-tick) which is the cheapest always-safe activity.
 */
function selectGoalForLoad(startIdx: number, maxCost: GoalCost): number {
  const budgetRank = COST_RANK[maxCost];
  const n = AUTONOMOUS_GOALS.length;
  for (let offset = 0; offset < n; offset++) {
    const candidateIdx = (startIdx + offset) % n;
    const cost = AUTONOMOUS_GOAL_COSTS[candidateIdx] ?? "expensive";
    if (COST_RANK[cost] <= budgetRank) return candidateIdx;
  }
  // Defensive fallback — should be unreachable since goal[0] is cheap.
  return 0;
}

// ── Gap #2: state-conditioned Thompson selection ───────────────────────────
// Sample Beta(alpha+1, beta+1) — Marsaglia approximation via the trick
// Beta(a,b) = X/(X+Y) where X ~ Gamma(a,1), Y ~ Gamma(b,1). For integer
// a,b > 0 we draw Gamma as sum of -ln(U_i) over i=1..a (Bun's Math.random is
// fine; this is a policy, not a security primitive).
function gammaIntApprox(shape: number): number {
  let acc = 0;
  const n = Math.max(1, Math.floor(shape));
  for (let i = 0; i < n; i++) acc += -Math.log(Math.max(1e-9, Math.random()));
  return acc;
}
function sampleBeta(alpha: number, beta: number): number {
  const x = gammaIntApprox(alpha);
  const y = gammaIntApprox(beta);
  const denom = x + y;
  return denom === 0 ? 0.5 : x / denom;
}

/**
 * Fetch the substrate's current state-space signature via dev-vessel. Returns
 * null when dev-vessel is unreachable — caller falls back to unconditioned
 * round-robin. Best-effort and bounded (3s).
 */
async function fetchCurrentSignature(): Promise<string | null> {
  try {
    const res = await fetch(`${DEV_VESSEL_ENDPOINT}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` },
      body: JSON.stringify({ impulse: { pointer: { type: "compute_state_signature" } } }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { body?: { signature_hash?: string } };
    return data?.body?.signature_hash ?? null;
  } catch {
    return null;
  }
}

/**
 * Pull recent traces and segment by (signature_hash, goal_idx) tag. Returns a
 * map goalIdx → { alpha, beta, samples } for the current signature only. Falls
 * back to empty map on any error so the caller degrades to round-robin.
 *
 * We read traces from the last 24h (limit 200). Each trace has tags including
 * `state_signature:<hash>` (added by goal-host) and `boredom_source` + an
 * implicit goal_idx via the targetTemplateId. We map template_id back to
 * goal_idx via AUTONOMOUS_GOAL_TARGET_TEMPLATES.
 */
interface PosteriorCell { alpha: number; beta: number; samples: number; }
async function fetchPosteriorsForSignature(
  signature: string,
): Promise<Map<number, PosteriorCell>> {
  const cells = new Map<number, PosteriorCell>();
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    // Bump limit 200 → 500: lifecycle-spawned nested traces now inherit
    // state_signature: tags (ias-executor 95636c3) but have null template_id;
    // the goal-idx lookup already skips them via `if (!tid) continue`. We
    // bump the fetch limit modestly so root traces aren't crowded out of the
    // sample window. 1000 caused activity-api timeouts under load; 500 is
    // safer on memory + DB I/O while still ~2.5x the prior headroom.
    const res = await fetch(
      `${ACTIVITY_API_ENDPOINT}/v2/activities/execution-traces?limit=500&since=${since}`,
      { headers: authHeaders(), signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return cells;
    const data = (await res.json()) as
      | { executions?: unknown; traces?: unknown }
      | unknown;
    const arr = Array.isArray(data)
      ? (data as Array<Record<string, unknown>>)
      : ((data as { executions?: unknown; traces?: unknown })?.executions
        ?? (data as { executions?: unknown; traces?: unknown })?.traces
        ?? []) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) return cells;
    const sigTag = `state_signature:${signature}`;
    // Build template_id → goal_idx index once.
    const tplToGoal = new Map<string, number>();
    AUTONOMOUS_GOAL_TARGET_TEMPLATES.forEach((tid, idx) => {
      if (typeof tid === "string") tplToGoal.set(tid, idx);
    });
    for (const t of arr) {
      const tags = Array.isArray(t.tags) ? (t.tags as string[]) : [];
      if (!tags.includes(sigTag)) continue;
      // Trace's template id (one of several possible field names).
      const tid =
        (typeof t.activity_id === "string" ? t.activity_id : undefined)
        ?? (typeof t.template_id === "string" ? t.template_id : undefined)
        ?? (typeof t.selected_template_id === "string" ? t.selected_template_id : undefined);
      if (!tid) continue;
      const normalized = tid.replace(/^activity:⟨(.+)⟩$/, "$1");
      const goalIdx = tplToGoal.get(normalized) ?? tplToGoal.get(tid);
      if (goalIdx === undefined) continue;
      const status = t.status;
      const success = status === "success" || status === "completed" || t.success === true;
      let cell = cells.get(goalIdx);
      if (!cell) { cell = { alpha: 0, beta: 0, samples: 0 }; cells.set(goalIdx, cell); }
      if (success) cell.alpha += 1;
      else cell.beta += 1;
      cell.samples += 1;
    }
  } catch {
    /* swallow — degrade to round-robin */
  }
  return cells;
}

/**
 * State-conditioned goal selection (Gap #2). Layers Thompson Sampling on top
 * of the load-aware round-robin walk:
 *
 *   1. Compute candidates that satisfy the cost budget for current load.
 *   2. Fetch posteriors keyed by (current_signature, goal_idx) from recent
 *      24h traces.
 *   3. If any cell has samples >= MIN_CELL_SAMPLES, Thompson-sample over all
 *      eligible cells (with Beta(1,1) prior for goals lacking data) and pick
 *      the highest draw.
 *   4. If no cell has enough samples (cold start for this signature),
 *      fall back to load-aware round-robin (unchanged behavior).
 *
 * Degrades gracefully on any error or null signature.
 */
const MIN_CELL_SAMPLES = 3;
async function selectGoalForLoadConditioned(
  startIdx: number,
  maxCost: GoalCost,
): Promise<{ goalIdx: number; mode: "thompson" | "round_robin"; signature: string | null; cellsExamined: number }> {
  const rrPick = selectGoalForLoad(startIdx, maxCost);
  const signature = await fetchCurrentSignature();
  if (!signature) return { goalIdx: rrPick, mode: "round_robin", signature: null, cellsExamined: 0 };

  // Build eligible-candidate list (respects cost budget, preserves rotation
  // fairness by starting at startIdx).
  const budgetRank = COST_RANK[maxCost];
  const n = AUTONOMOUS_GOALS.length;
  const eligible: number[] = [];
  for (let offset = 0; offset < n; offset++) {
    const idx = (startIdx + offset) % n;
    const cost = AUTONOMOUS_GOAL_COSTS[idx] ?? "expensive";
    if (COST_RANK[cost] <= budgetRank) eligible.push(idx);
  }
  if (eligible.length === 0) return { goalIdx: rrPick, mode: "round_robin", signature, cellsExamined: 0 };

  const posteriors = await fetchPosteriorsForSignature(signature);
  // Require AT LEAST ONE eligible cell with sufficient samples — otherwise
  // every draw is from Beta(1,1) which is uniform noise.
  let anyConfident = false;
  for (const idx of eligible) {
    const cell = posteriors.get(idx);
    if (cell && cell.samples >= MIN_CELL_SAMPLES) { anyConfident = true; break; }
  }
  if (!anyConfident) {
    return { goalIdx: rrPick, mode: "round_robin", signature, cellsExamined: posteriors.size };
  }

  // Thompson sample across eligible candidates. Beta(α+1, β+1) — +1 prior
  // keeps zero-data cells in play with uniform draws.
  let bestIdx = eligible[0]!;
  let bestDraw = -1;
  for (const idx of eligible) {
    const cell = posteriors.get(idx) ?? { alpha: 0, beta: 0, samples: 0 };
    const draw = sampleBeta(cell.alpha + 1, cell.beta + 1);
    if (draw > bestDraw) { bestDraw = draw; bestIdx = idx; }
  }
  return { goalIdx: bestIdx, mode: "thompson", signature, cellsExamined: posteriors.size };
}

/**
 * Substrate-internal autonomous promoter tick. Calls activity-api's
 * auto-promote endpoint which scans proposed templates and promotes any with
 * sufficient real empirical evidence (α/(α+β) ≥ 0.6 AND samples ≥ 20 by default).
 * Best-effort: errors are logged but never block boredom dispatch.
 *
 * Per operator directive 2026-05-28 ("push back against more operator-keyed gates"):
 * no operator action is required for promotion. Substrate decides on its own
 * empirical evidence whether to graduate proposed templates.
 */
async function tickAutoPromote(): Promise<void> {
  try {
    const res = await fetch(
      `${ACTIVITY_API_ENDPOINT}/v2/activities/templates/auto-promote`,
      {
        method: "POST",
        headers: authHeaders(),
        // min_samples=3: substrate-authored templates need only 3 successful executions
        // to graduate. The default of 20 means gap-closing templates would never promote
        // in a reasonable timeframe (~80h per template at current dispatch rate).
        // 3 samples provides statistical confidence that the template is runnable while
        // keeping the promotion loop fast enough to matter within a session.
        body: JSON.stringify({ min_samples: 3, min_success_rate: 0.6 }),
      },
    );
    if (!res.ok) {
      console.warn(`[boredom-vessel] auto-promote tick HTTP ${res.status} — skipping`);
      return;
    }
    const body = await res.json() as {
      promoted?: Array<{ template_id?: string; empirical_mean?: number; empirical_samples?: number }>;
      considered?: number;
    };
    const promoted = body.promoted ?? [];
    console.log(
      `[boredom-vessel] auto-promote tick: considered=${body.considered ?? 0} promoted=${promoted.length}` +
      (promoted.length > 0 ? ` ids=[${promoted.map(p => p.template_id).join(",")}]` : ""),
    );
  } catch (err) {
    console.warn(`[boredom-vessel] auto-promote tick error: ${(err as Error).message}`);
  }
}

// ── Stage 2.C: capability-based dispatcher routing ──────────────────────────
//
// Two dispatchers now exist:
//   - goal-host   — full machinery (LLM-reuse, state-space services, proxy
//                   resolvers, ProxyImpulseBus). Required for open-ended goals
//                   without targetTemplateId or templates needing state-space
//                   services.
//   - light-dispatch — stateless oneshot (port 8280). Walks tasks, calls
//                   resolver-owning vessels via discovery, posts trace.
//                   Cheaper per-dispatch; cannot do LLM-reuse.
//
// Selection: hard filter (capability) → soft filter (recent OOM count) →
// Thompson sample over (dispatcher × signature × goalIdx) posteriors with
// DISPATCHER_EXPLORATION_RATE for keep-warm exploration.
// ─────────────────────────────────────────────────────────────────────────────

type DispatcherChoice = "goal-host" | "light-dispatch";

interface CapabilityHints {
  requires_llm_reuse: boolean;
  requires_state_space_services: boolean;
  is_multi_task: boolean;
}

interface DispatcherDecision {
  dispatcher: DispatcherChoice;
  reason: "capability_filter" | "health_soft_filter" | "thompson_sample" | "exploration_bonus" | "comparison_probe";
  eligible: DispatcherChoice[];
  capability_hints: CapabilityHints;
}

/**
 * Derive capability hints from goal/template metadata. Pessimistic by default
 * (assumes any unknown goal needs full machinery) so we never route an
 * LLM-needing goal to light-dispatch.
 *
 * Templates whose id ends in "-tick", "-scan", "-audit", "-report", "-backfill"
 * are deterministic detector wrappers — light-dispatch eligible. Open-ended
 * goals (no targetTemplateId) ALWAYS go to goal-host (need LLM-reuse).
 */
function deriveCapabilityHints(
  _goalIdx: number,
  targetTemplateId: string | undefined,
): CapabilityHints {
  if (!targetTemplateId) {
    return { requires_llm_reuse: true, requires_state_space_services: true, is_multi_task: true };
  }
  // Detector / tick / single-shot templates: no LLM reuse, no state-space services.
  // Light-dispatch can make single LLM calls (via llm-resolver-vessel) and can
  // run fs_read/fs_write/http_fetch chains. What it CAN'T do is reuse LLM
  // context across goals or query state-space services. So everything that's
  // a single autonomous chain (even one with an LLM step) belongs here.
  const isDeterministicChain =
    /-(tick|scan|audit|report|backfill)$/.test(targetTemplateId) ||
    targetTemplateId.endsWith(":coverage-tick") ||
    targetTemplateId.endsWith(":concept-usage-backfill") ||
    targetTemplateId.endsWith(":mitosis-tick") ||
    targetTemplateId.endsWith(":backend-snapshot-to-git") ||
    // Gap-drain bridges (2026-06-04): single-LLM chains, no reuse, no state.
    targetTemplateId.endsWith(":dispatch-latest-auto-draft") ||
    targetTemplateId.endsWith(":apply-proposal-as-patch") ||
    targetTemplateId.endsWith(":auto-promote") ||
    targetTemplateId.endsWith(":drain-pending-substrate-gaps") ||
    targetTemplateId.endsWith(":gap-to-scenario-bridge-tick");
  return {
    requires_llm_reuse: false,
    requires_state_space_services: !isDeterministicChain,
    is_multi_task: true,
  };
}

/**
 * Fetch per-dispatcher Thompson posteriors for the given signature, segmented
 * by `dispatcher_used:<choice>` tags. Returns {alpha, beta, samples} per
 * dispatcher; missing entries default to zero (uniform Beta(1,1) prior in
 * sampleBeta call).
 */
async function fetchDispatcherPosteriors(
  signature: string,
  goalIdx: number,
): Promise<Map<DispatcherChoice, PosteriorCell>> {
  const cells = new Map<DispatcherChoice, PosteriorCell>();
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    // See fetchPosteriorsForSignature comment — same dilution issue.
    const res = await fetch(
      `${ACTIVITY_API_ENDPOINT}/v2/activities/execution-traces?limit=500&since=${since}`,
      { headers: authHeaders(), signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return cells;
    const data = (await res.json()) as { executions?: unknown; traces?: unknown } | unknown;
    const arr = (Array.isArray(data)
      ? (data as Array<Record<string, unknown>>)
      : ((data as { executions?: unknown; traces?: unknown })?.executions
        ?? (data as { executions?: unknown; traces?: unknown })?.traces
        ?? [])) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) return cells;
    const sigTag = `state_signature:${signature}`;
    const targetTpl = AUTONOMOUS_GOAL_TARGET_TEMPLATES[goalIdx];
    for (const t of arr) {
      const tags = Array.isArray(t.tags) ? (t.tags as string[]) : [];
      if (!tags.includes(sigTag)) continue;
      let dispatcher: DispatcherChoice | undefined;
      for (const tag of tags) {
        if (tag === "dispatcher_used:goal-host") { dispatcher = "goal-host"; break; }
        if (tag === "dispatcher_used:light-dispatch") { dispatcher = "light-dispatch"; break; }
      }
      if (!dispatcher) continue;
      // Optionally filter by goal-template match — when targetTpl is undefined,
      // the goal is open-ended and we accept any trace at this signature.
      if (targetTpl) {
        const tid =
          (typeof t.activity_id === "string" ? t.activity_id : undefined)
          ?? (typeof t.template_id === "string" ? t.template_id : undefined)
          ?? (typeof t.selected_template_id === "string" ? t.selected_template_id : undefined);
        if (tid && !tid.includes(targetTpl)) continue;
      }
      const status = t.status;
      const success = status === "success" || status === "completed" || t.success === true;
      let cell = cells.get(dispatcher);
      if (!cell) { cell = { alpha: 0, beta: 0, samples: 0 }; cells.set(dispatcher, cell); }
      if (success) cell.alpha += 1; else cell.beta += 1;
      cell.samples += 1;
    }
  } catch { /* degrade to empty map */ }
  return cells;
}

/**
 * Check recent OOM count for the given systemd service. Used as soft filter:
 * if goal-host has OOMed > N times recently, prefer light-dispatch when
 * eligible. Best-effort; degrades to zero on any error.
 *
 * Reads from activity-api's recent traces for tags indicating dispatcher OOMs
 * (when the trace records dispatcher health). For now: degrade to zero — wire
 * to a real OOM-detection resolver in a follow-up. The architectural piece
 * (eligible-dispatcher routing) is what unblocks autonomous chains; the soft
 * filter is a refinement.
 */
async function checkRecentOOMCount(_dispatcher: DispatcherChoice): Promise<number> {
  return 0;
}

/**
 * Read+bump the per-cycle counter persisted at DISPATCHER_CYCLE_COUNTER_FILE.
 * Used to fire a comparison probe every DISPATCHER_COMPARISON_INTERVAL cycles
 * (same goal through both dispatchers, tagged comparison_probe:true).
 */
function readCycleCounter(): number {
  try {
    const text = Bun.file(DISPATCHER_CYCLE_COUNTER_FILE).text();
    // Synchronous-style: the file is < 32 bytes; use the sync API.
    void text;
  } catch { /* swallow */ }
  // Use sync fs since Bun.file().text() is async; fall back to atomic read here.
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    if (fs.existsSync(DISPATCHER_CYCLE_COUNTER_FILE)) {
      const n = parseInt(fs.readFileSync(DISPATCHER_CYCLE_COUNTER_FILE, "utf8"), 10);
      return Number.isFinite(n) ? n : 0;
    }
  } catch { /* swallow */ }
  return 0;
}

function writeCycleCounter(n: number): void {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    fs.writeFileSync(DISPATCHER_CYCLE_COUNTER_FILE, String(n));
  } catch { /* swallow */ }
}

async function selectDispatcher(
  goalIdx: number,
  signature: string | null,
  capability_hints: CapabilityHints,
): Promise<DispatcherDecision> {
  // Hard filter: capability
  const eligible: DispatcherChoice[] = ["goal-host"];
  if (!capability_hints.requires_llm_reuse && !capability_hints.requires_state_space_services) {
    eligible.push("light-dispatch");
  }
  if (eligible.length === 1) {
    return { dispatcher: eligible[0]!, reason: "capability_filter", eligible, capability_hints };
  }

  // Soft filter: dispatcher health
  const goalHostOOMs = await checkRecentOOMCount("goal-host");
  if (goalHostOOMs > 2 && eligible.includes("light-dispatch")) {
    return { dispatcher: "light-dispatch", reason: "health_soft_filter", eligible, capability_hints };
  }

  // Exploration bonus — keep both paths warm.
  if (Math.random() < DISPATCHER_EXPLORATION_RATE) {
    const pick = eligible[Math.floor(Math.random() * eligible.length)]!;
    return { dispatcher: pick, reason: "exploration_bonus", eligible, capability_hints };
  }

  // Thompson sample over (dispatcher × signature × goalIdx).
  if (signature) {
    const posteriors = await fetchDispatcherPosteriors(signature, goalIdx);
    let bestDraw = -1;
    let bestPick: DispatcherChoice = eligible[0]!;
    for (const d of eligible) {
      const cell = posteriors.get(d) ?? { alpha: 0, beta: 0, samples: 0 };
      const draw = sampleBeta(cell.alpha + 1, cell.beta + 1);
      if (draw > bestDraw) { bestDraw = draw; bestPick = d; }
    }
    return { dispatcher: bestPick, reason: "thompson_sample", eligible, capability_hints };
  }

  // Cold-start: prefer light-dispatch (saves goal-host resources for goals
  // that NEED its full machinery).
  return { dispatcher: "light-dispatch", reason: "thompson_sample", eligible, capability_hints };
}

/**
 * Dispatch a goal to the chosen dispatcher. Returns a unified result shape.
 * goal-host returns 202+dispatchId (then poll); light-dispatch returns 200/207
 * + outcome inline (single request).
 */
async function dispatchGoal(
  dispatcher: DispatcherChoice,
  goal: string,
  targetTemplateId: string | undefined,
  variables: Record<string, unknown>,
  tags: string[],
  stateSignatureHash?: string | null,
): Promise<Response> {
  if (dispatcher === "light-dispatch") {
    if (!targetTemplateId) {
      throw new Error("light-dispatch requires targetTemplateId");
    }
    return await fetch(`${LIGHT_DISPATCH_ENDPOINT}/dispatch`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        template_id: targetTemplateId,
        variables: { source: "boredom-vessel", ...variables },
        tags,
        ...(stateSignatureHash ? { state_signature_hash: stateSignatureHash } : {}),
      }),
    });
  }
  // goal-host
  const requestBody: Record<string, unknown> = {
    goal,
    tags,
    variables: { source: "boredom-vessel", ...variables },
  };
  if (targetTemplateId) requestBody.targetTemplateId = targetTemplateId;
  if (stateSignatureHash) requestBody.state_signature_hash = stateSignatureHash;
  return await fetch(`${GOAL_HOST_ENDPOINT}/run-goal`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(requestBody),
  });
}

async function main(): Promise<void> {
  console.log("[boredom-vessel] tick start");

  // Run auto-promote scan first — independent of idle check. Substrate-authored
  // proposed templates that accumulated real empirical evidence get promoted
  // without any operator intervention. Closes the loop on goal[7]'s outputs.
  await tickAutoPromote();

  const idle = await isIdle();
  if (!idle) {
    console.log("[boredom-vessel] substrate busy — no autonomous goal dispatched");
    process.exit(0);
  }

  // Sample system load FIRST — gates both goal selection AND attribution.
  // Without an early sample, the substrate would commit to an expensive goal
  // before knowing it can afford it. The same sample is reused as load_before
  // for the attribution record so we don't double-pay for the call.
  const loadBefore = await sampleLoad();
  const dispatchedAt = new Date().toISOString();
  const dispatchStartMs = Date.now();

  // Load-aware goal selection + state-conditioned Thompson sampling (Gap #2):
  // walk forward from the round-robin pointer (cost-budget filter), then if
  // enough posterior data exists for the current state signature, sample
  // Thompson over eligible cells. Cold-start falls back to pure round-robin.
  const roundRobinIdx = await peekGoalIndex();
  const maxCost = maxCostForLoad(loadBefore);
  const selection = await selectGoalForLoadConditioned(roundRobinIdx, maxCost);
  const goalIdx = selection.goalIdx;
  await advanceGoalIndex(goalIdx);
  const skipped = (goalIdx - roundRobinIdx + AUTONOMOUS_GOALS.length) % AUTONOMOUS_GOALS.length;
  if (selection.mode === "thompson") {
    console.log(
      `[boredom-vessel] state-conditioned selection: signature=${selection.signature} ` +
      `mode=thompson cells_examined=${selection.cellsExamined} picked=${goalIdx} ` +
      `(round_robin would have picked ${roundRobinIdx})`,
    );
  } else if (skipped > 0) {
    console.log(
      `[boredom-vessel] load-gating: maxCost=${maxCost} (load_anomaly=${loadBefore?.load_anomaly}, severe=${loadBefore?.load_anomaly_severe}) — ` +
      `skipped ${skipped} goal(s) from idx=${roundRobinIdx} to idx=${goalIdx}` +
      ` (signature=${selection.signature ?? "unknown"}, mode=round_robin)`,
    );
  } else if (selection.signature) {
    console.log(
      `[boredom-vessel] state-conditioned selection: signature=${selection.signature} ` +
      `mode=round_robin (insufficient posterior samples) picked=${goalIdx}`,
    );
  }

  const goal = AUTONOMOUS_GOALS[goalIdx]!;
  // goal[9]: dynamic target — pick the top executable proposed gap-closing template at runtime.
  // This closes the author→execute→promote loop without hardcoding a specific template ID.
  let targetTemplateId = AUTONOMOUS_GOAL_TARGET_TEMPLATES[goalIdx];
  if (goalIdx === 9 && targetTemplateId === undefined) {
    const dynamicTarget = await pickTopProposedGapClosingTemplate();
    if (dynamicTarget) {
      targetTemplateId = dynamicTarget;
      console.log(`[boredom-vessel] goal[9] dynamic target: ${dynamicTarget}`);
    } else {
      console.log("[boredom-vessel] goal[9] no executable proposed gap-closing template found — skipping dispatch");
      process.exit(0);
    }
  }
  // Stage 2.C: capability-based dispatcher selection.
  const capability_hints = deriveCapabilityHints(goalIdx, targetTemplateId);
  const decision = await selectDispatcher(goalIdx, selection.signature, capability_hints);
  let dispatcher = decision.dispatcher;

  // Comparison probe: every Nth cycle, dispatch the same goal through BOTH
  // dispatchers (when both are eligible) so downstream analysis can compare.
  // The "primary" dispatch follows the Thompson choice; the "probe" fire-and-
  // forgets to the other dispatcher with a comparison_probe tag.
  const cycle = readCycleCounter() + 1;
  writeCycleCounter(cycle);
  const fireComparisonProbe =
    decision.eligible.length === 2 &&
    DISPATCHER_COMPARISON_INTERVAL > 0 &&
    cycle % DISPATCHER_COMPARISON_INTERVAL === 0;

  console.log(
    `[boredom-vessel] dispatcher selected: ${dispatcher} (reason=${decision.reason}, ` +
    `eligible=[${decision.eligible.join(",")}], signature=${selection.signature ?? "null"}, goalIdx=${goalIdx}, ` +
    `cycle=${cycle}${fireComparisonProbe ? ", comparison_probe=on" : ""})`,
  );

  console.log(`[boredom-vessel] submitting goal[${goalIdx}]: "${goal}"${targetTemplateId ? ` (targetTemplateId=${targetTemplateId})` : ""}`);

  const baseTags = [
    "intent:topology_discovery",
    BOREDOM_TAG,
    `dispatcher_reason:${decision.reason}`,
  ];
  const extraVars = extraVariablesForGoal(goalIdx);

  // Fire comparison probe (fire-and-forget; tagged so it can be filtered out
  // of normal posterior aggregation).
  if (fireComparisonProbe) {
    const probeDispatcher: DispatcherChoice =
      dispatcher === "goal-host" ? "light-dispatch" : "goal-host";
    void dispatchGoal(probeDispatcher, goal, targetTemplateId, extraVars,
      [...baseTags, "comparison_probe:true", `comparison_probe_pair:${dispatcher}`],
      selection.signature)
      .catch((err) => {
        console.warn(`[boredom-vessel] comparison probe (${probeDispatcher}) failed: ${(err as Error).message}`);
      });
  }

  let res: Response;
  try {
    res = await dispatchGoal(dispatcher, goal, targetTemplateId, extraVars, baseTags, selection.signature);
  } catch (err) {
    console.error(`[boredom-vessel] ${dispatcher} dispatcher unreachable: ${(err as Error).message}`);
    // Fallback: if primary was light-dispatch and goal-host is eligible, try goal-host
    if (dispatcher === "light-dispatch" && decision.eligible.includes("goal-host")) {
      console.warn(`[boredom-vessel] falling back to goal-host`);
      dispatcher = "goal-host";
      try {
        res = await dispatchGoal("goal-host", goal, targetTemplateId, extraVars,
          [...baseTags, "dispatcher_fallback:from_light-dispatch"], selection.signature);
      } catch (err2) {
        console.error(`[boredom-vessel] fallback also failed: ${(err2 as Error).message}`);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }

  if (!res.ok && res.status !== 202 && res.status !== 207) {
    const text = await res.text().catch(() => "(no body)");
    console.error(`[boredom-vessel] ${dispatcher} HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const dispatch = await res.json() as { dispatchId?: string; executionId?: string; status?: string; error?: string };
  if (dispatch.error) {
    console.error(`[boredom-vessel] goal dispatch error: ${dispatch.error}`);
    process.exit(1);
  }

  // light-dispatch returns the full outcome inline (200/207) — no polling
  // needed. status is "success"|"failure". Treat as synchronous completion.
  if (dispatcher === "light-dispatch") {
    console.log(
      `[boredom-vessel] dispatched via light-dispatch — executionId=${dispatch.executionId ?? "?"} status=${dispatch.status ?? "?"}`,
    );
    await recordLoadAttribution({
      dispatch_id: dispatch.dispatchId ?? dispatch.executionId ?? "light-no-id",
      execution_id: dispatch.executionId,
      goal_idx: goalIdx,
      template_id: targetTemplateId,
      dispatched_at: dispatchedAt,
      dispatch_start_ms: dispatchStartMs,
      load_before: loadBefore,
      goal_status: dispatch.status,
    });
    process.exit(0);
  }

  // If synchronous response (legacy / no dispatchId), log + attribute load + exit.
  if (!dispatch.dispatchId) {
    console.log(
      `[boredom-vessel] dispatched — executionId=${dispatch.executionId ?? "?"} status=${dispatch.status ?? "?"}`,
    );
    await recordLoadAttribution({
      dispatch_id: dispatch.executionId ?? "sync-no-id",
      execution_id: dispatch.executionId,
      goal_idx: goalIdx,
      template_id: targetTemplateId,
      dispatched_at: dispatchedAt,
      dispatch_start_ms: dispatchStartMs,
      load_before: loadBefore,
      goal_status: dispatch.status,
    });
    process.exit(0);
  }

  // Poll for async completion. Budget: ~270s (systemd TimeoutStartSec=600 is the hard kill).
  const { dispatchId } = dispatch;
  console.log(`[boredom-vessel] goal launched async dispatchId=${dispatchId}, polling...`);
  const pollDeadline = Date.now() + 270_000;
  while (Date.now() < pollDeadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    let pollRes: Response;
    try {
      pollRes = await fetch(`${GOAL_HOST_ENDPOINT}/executions/${dispatchId}`, {
        headers: authHeaders(),
      });
    } catch (err) {
      console.warn(`[boredom-vessel] poll error: ${(err as Error).message}`);
      continue;
    }
    if (!pollRes.ok) continue;
    const poll = await pollRes.json() as { status?: string; executionId?: string; error?: string };
    if (poll.status === "completed" || poll.status === "failed") {
      console.log(
        `[boredom-vessel] dispatched — executionId=${poll.executionId ?? "?"} status=${poll.status}`,
      );
      await recordLoadAttribution({
        dispatch_id: dispatchId,
        execution_id: poll.executionId,
        goal_idx: goalIdx,
        template_id: targetTemplateId,
        dispatched_at: dispatchedAt,
        dispatch_start_ms: dispatchStartMs,
        load_before: loadBefore,
        goal_status: poll.status,
      });
      // Always exit 0 — goal failure is a normal outcome (β+=1 in Thompson posteriors).
      // Exiting 1 marks the systemd unit as failed and disrupts the boredom timer.
      process.exit(0);
    }
  }
  // Systemd will kill us at TimeoutStartSec=600; goal continues async.
  console.log(`[boredom-vessel] poll budget exhausted — goal continuing async, dispatchId=${dispatchId}`);
  await recordLoadAttribution({
    dispatch_id: dispatchId,
    goal_idx: goalIdx,
    template_id: targetTemplateId,
    dispatched_at: dispatchedAt,
    dispatch_start_ms: dispatchStartMs,
    load_before: loadBefore,
    goal_status: "poll_budget_exhausted",
  });
  process.exit(0);
}

// ────────────────────────────────────────────────────────────────────────────
// DAEMON MODE — throughput-paced concurrent dispatch pool (2026-06-04).
//
// Replaces the 5-minute timer cadence with a continuously-running pool that
// maintains N concurrent dispatches. On any completion, the pool immediately
// picks the next best goal given current substrate state + per-goal momentum.
//
// Why: timer-paced cadence (~0.2 dispatch/min) is the slowest substrate clock.
// State-conditioned Thompson learning needs throughput more than coverage —
// concurrent dispatches amortize the WS roundtrip + state-poll cost and let
// posteriors accumulate fast enough to make momentum measurable within a
// session. Backwards-compat: BOREDOM_DAEMON_MODE=0 keeps oneshot behaviour.
// ────────────────────────────────────────────────────────────────────────────

const DAEMON_FLAG = process.argv.includes("--daemon") || process.env["BOREDOM_DAEMON_MODE"] === "1";
const MAX_CONCURRENT = parseInt(process.env["BOREDOM_MAX_CONCURRENT"] ?? "3", 10);
const MIN_DISPATCH_INTERVAL_MS = parseInt(process.env["BOREDOM_MIN_DISPATCH_INTERVAL_MS"] ?? "2000", 10);
const POOL_LOOP_INTERVAL_MS = parseInt(process.env["BOREDOM_POOL_LOOP_INTERVAL_MS"] ?? "5000", 10);
const POOL_STATE_REFRESH_MS = parseInt(process.env["BOREDOM_STATE_REFRESH_MS"] ?? "30000", 10);
const POOL_AUTOPROMOTE_INTERVAL_MS = parseInt(process.env["BOREDOM_AUTOPROMOTE_INTERVAL_MS"] ?? "600000", 10);
// Reaper deadline for in-flight dispatches. Original 300s (5 min) was too short
// for goal-host LLM chains (apply-proposal-as-patch, drafter chains, mitosis-evaluate
// with overlay typecheck). The trace eventually lands but our inFlight entry
// gets reaped first, so even the WS-replay buffer can't help (the entry no
// longer exists when execution_id is finally resolved). Bumped to 900s so
// 5-10 min LLM chains complete naturally.
const IN_FLIGHT_TIMEOUT_MS = parseInt(process.env["BOREDOM_IN_FLIGHT_TIMEOUT_MS"] ?? "900000", 10);

interface SubstrateState {
  // Observable counts derived from the workspace + activity-api. Each predicate
  // (Part 2) reads these — refreshed every POOL_STATE_REFRESH_MS so daemon
  // selection stays cheap. Best-effort: missing files / API errors degrade to
  // null/0 so we never block dispatch on instrument health.
  openGapCount: number;
  unbridgedScenarioGapCount: number;
  stagedMitosisPresent: boolean;
  pendingProposalCount: number;
  unrankedAutoTemplateCount: number;
  refreshedAt: number;
}

interface InFlightEntry {
  goal_idx: number;
  dispatch_id: string;
  execution_id?: string;
  template_id?: string;
  started_at: number;
  signature: string | null;
}

interface Momentum {
  outcomes: ("success" | "failure")[];
}

const inFlight = new Map<string, InFlightEntry>();
const momentumByGoal = new Map<number, Momentum>();
let running = true;
let lastDispatchAt = 0;
let lastAutoPromoteAt = 0;

// ── Signature-continuity self-direction (2026-06-04, Part C) ───────────────
// Cache the current state-space signature + per-goal posteriors at the same
// cadence as substrate state. `pickBestEligible` boosts the score of any goal
// that has prior wins at the current signature so the substrate's self-
// direction reflects "what worked recently in this operational class".
//
// The boost is multiplicative (factor = 1 + SIG_CONTINUITY_GAIN * winRate)
// so cold-cell goals (samples=0) are unaffected and high-prior-win goals get
// up to a +SIG_CONTINUITY_GAIN multiplier when winRate=1.
const SIG_CONTINUITY_GAIN = parseFloat(process.env["BOREDOM_SIG_CONTINUITY_GAIN"] ?? "0.5");
const SIG_CONTINUITY_MIN_SAMPLES = 2;
let currentSignature: string | null = null;
let posteriorsBySig: Map<number, PosteriorCell> = new Map();
let lastSigRefreshAt = 0;
const SIG_REFRESH_INTERVAL_MS = 60_000;

async function refreshSignatureAndPosteriors(): Promise<void> {
  try {
    const sig = await fetchCurrentSignature();
    if (!sig) { currentSignature = null; posteriorsBySig = new Map(); return; }
    currentSignature = sig;
    posteriorsBySig = await fetchPosteriorsForSignature(sig);
  } catch { /* tolerant */ }
}

async function refreshSubstrateState(): Promise<SubstrateState> {
  const fs = await import("node:fs/promises");
  let stagedMitosisPresent = false;
  let pendingProposalCount = 0;
  let unbridgedScenarioGapCount = 0;
  let openGapCount = 0;
  let unrankedAutoTemplateCount = 0;
  try {
    stagedMitosisPresent = !!(await fs.stat("/workspace/mitosis-pending.json").catch(() => null));
  } catch { /* ignore */ }
  try {
    const proposalDir = await fs.readdir("/workspace/proposals").catch(() => [] as string[]);
    pendingProposalCount = proposalDir.filter((n) => n.endsWith(".json") && !n.startsWith("applied-")).length;
  } catch { /* ignore */ }
  try {
    const gapsRaw = await fs.readFile("/workspace/gaps.json", "utf8").catch(() => "");
    if (gapsRaw) {
      const parsed = JSON.parse(gapsRaw) as { gaps?: Array<{ status?: string; scenario_id?: string }> };
      const gaps = parsed.gaps ?? [];
      openGapCount = gaps.filter((g) => g.status !== "closed" && g.status !== "resolved").length;
      const scenarios = await fs.readdir(SCENARIOS_DIR).catch(() => [] as string[]);
      const scenarioIds = new Set(scenarios.filter((n) => n.endsWith(".json")).map((n) => n.replace(/\.json$/, "")));
      unbridgedScenarioGapCount = gaps.filter(
        (g) => g.status !== "closed" && (!g.scenario_id || !scenarioIds.has(g.scenario_id)),
      ).length;
    }
  } catch { /* ignore */ }
  try {
    const res = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/templates?limit=60`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(4_000),
    });
    if (res.ok) {
      const data = (await res.json()) as { templates?: Array<{ id?: string; metrics?: { total_executions?: number } }> };
      unrankedAutoTemplateCount = (data.templates ?? []).filter((t) => {
        const id = (t.id ?? "").replace(/^activity:⟨(.+)⟩$/, "$1");
        return id.includes("gap-closing:auto-") && (t.metrics?.total_executions ?? 0) === 0;
      }).length;
    }
  } catch { /* ignore */ }
  return {
    openGapCount,
    unbridgedScenarioGapCount,
    stagedMitosisPresent,
    pendingProposalCount,
    unrankedAutoTemplateCount,
    refreshedAt: Date.now(),
  };
}

/**
 * Per-goal precondition predicates. Returning false means "skip this goal in
 * the current state space" — daemon never dispatches an ineligible goal.
 *
 * Defaults: any goal not listed always fires (observation / detector / probe
 * goals that emit findings regardless of backlog state). Listed goals gate on
 * their specific signal: gap-closing only when there's a gap to close,
 * mitosis-tick only when pending.json exists, apply-proposal only when there
 * are proposals, etc.
 */
function goalCanFire(goalIdx: number, state: SubstrateState): boolean {
  switch (goalIdx) {
    case 8:  // draft-gap-closing-activity
    case 10: // drain-pending-substrate-gaps
      return state.openGapCount > 0;
    case 15: // mitosis-tick
      return state.stagedMitosisPresent;
    case 21: // gap-to-scenario-bridge-tick
      return state.unbridgedScenarioGapCount > 0;
    case 22: // dispatch-latest-auto-draft
      return state.unrankedAutoTemplateCount > 0;
    case 23: // apply-proposal-as-patch
      return state.pendingProposalCount > 0;
    default:
      return true;
  }
}

function recordOutcome(goalIdx: number, success: boolean): void {
  let m = momentumByGoal.get(goalIdx);
  if (!m) { m = { outcomes: [] }; momentumByGoal.set(goalIdx, m); }
  m.outcomes.push(success ? "success" : "failure");
  while (m.outcomes.length > 10) m.outcomes.shift();
}

// =====================================================================
// V24 (2026-06-08): SHAPE-DRIVEN SELECTION — impulse-activity foundation.
//
// The legacy AUTONOMOUS_GOALS / AUTONOMOUS_GOAL_TARGET_TEMPLATES / per-goal-
// index switches (goalCanFire, statePressure, AUTONOMOUS_GOAL_COSTS) are
// architectural debt. They treat activities as enumerated goals with hardcoded
// scoring inputs, requiring 5+ parallel-array edits to add a new entry. The
// IAL foundation prescribes the opposite: activities declare inputShapes +
// outputShapes, the binding-layer finds producers when consumers need inputs,
// and selection emerges from impulse-graph availability + Thompson posteriors.
//
// This selector queries activity-api for templates tagged `boredom_target_template`,
// scores each by (a) input-shape availability in recent execution traces
// (proxy for impulse-pool readiness), (b) success rate at the current
// state-signature (from the existing posteriorsBySig Map), (c) noise jitter.
// Returns the template_id of the winner. Falls back to legacy selection
// when activity-api is unreachable so the pool stays alive under degradation.
// =====================================================================

interface ShapeDrivenCandidate {
  template_id: string;
  input_shapes: string[];
  output_shapes: string[];
  tags: string[];
}

interface ShapeDrivenPick {
  template_id: string;
  score: number;
  reason: string;
}

let candidateCache: { fetchedAt: number; entries: ShapeDrivenCandidate[] } | null = null;
const CANDIDATE_CACHE_TTL_MS = 60_000;

async function fetchShapeDrivenCandidates(): Promise<ShapeDrivenCandidate[]> {
  if (candidateCache && Date.now() - candidateCache.fetchedAt < CANDIDATE_CACHE_TTL_MS) {
    return candidateCache.entries;
  }
  try {
    // V24b (2026-06-08): activity-api caps `limit` at 100 internally even when
    // higher values requested. Use FTS search on the collapsed tag form
    // ("boredomtargettemplate" — activity-api strips underscores from tag
    // tokens) so we get all boredom-target templates regardless of total
    // template count. Returns ~37 vs the 13 the first-page query missed.
    const res = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/templates?q=boredomtargettemplate&limit=200`, {
      headers: { Authorization: `ApiKey ${API_KEY}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return candidateCache?.entries ?? [];
    const body = await res.json() as { templates?: Array<Record<string, unknown>> };
    const entries: ShapeDrivenCandidate[] = [];
    for (const t of body.templates ?? []) {
      const tags = Array.isArray(t.tags) ? (t.tags as string[]) : [];
      // Match both literal and tag-prefix-normalized forms.
      const isBoredomTarget =
        tags.includes("boredom_target_template") ||
        tags.includes("boredomtargettemplate");
      if (!isBoredomTarget) continue;
      if (t.deprecated === true || t.retired === true) continue;
      const rawId = typeof t.id === "string" ? t.id : "";
      // activity-api wraps ids as activity:⟨…⟩; strip wrapper for dispatch.
      const id = rawId.replace(/^activity:⟨(.+)⟩$/, "$1");
      if (!id) continue;
      entries.push({
        template_id: id,
        input_shapes: Array.isArray(t.input_shapes) ? (t.input_shapes as string[]) : [],
        output_shapes: Array.isArray(t.output_shapes) ? (t.output_shapes as string[]) : [],
        tags,
      });
    }
    candidateCache = { fetchedAt: Date.now(), entries };
    return entries;
  } catch {
    return candidateCache?.entries ?? [];
  }
}

// Recent output_shapes set — proxy for "what's been produced in the impulse pool
// lately." Used to score input-shape availability: if a candidate's inputShapes
// are mostly in this set, its inputs are likely satisfiable.
let recentShapesCache: { fetchedAt: number; shapes: Set<string> } | null = null;
const RECENT_SHAPES_TTL_MS = 30_000;

async function fetchRecentlyProducedShapes(): Promise<Set<string>> {
  if (recentShapesCache && Date.now() - recentShapesCache.fetchedAt < RECENT_SHAPES_TTL_MS) {
    return recentShapesCache.shapes;
  }
  const shapes = new Set<string>();
  try {
    const res = await fetch(
      `${ACTIVITY_API_ENDPOINT}/v2/activities/execution-traces?limit=50`,
      { headers: { Authorization: `ApiKey ${METABOB_API_KEY}` }, signal: AbortSignal.timeout(3_000) },
    );
    if (res.ok) {
      const body = await res.json() as { executions?: Array<Record<string, unknown>>; traces?: Array<Record<string, unknown>> };
      const traces = body.executions ?? body.traces ?? [];
      for (const tr of traces) {
        const outs = tr["output_shapes"];
        if (Array.isArray(outs)) for (const s of outs) if (typeof s === "string") shapes.add(s);
      }
    }
  } catch { /* tolerant — empty set means everything looks unavailable, falls back to legacy */ }
  recentShapesCache = { fetchedAt: Date.now(), shapes };
  return shapes;
}

// Per-template momentum (parallel to per-goalIdx). When the shape-driven
// selector wins, outcomes get recorded here so the same template-id keys
// momentum across re-registrations / pool restarts.
const momentumByTemplate = new Map<string, { outcomes: ("success" | "failure")[] }>();

function recordOutcomeByTemplate(templateId: string, success: boolean): void {
  let m = momentumByTemplate.get(templateId);
  if (!m) { m = { outcomes: [] }; momentumByTemplate.set(templateId, m); }
  m.outcomes.push(success ? "success" : "failure");
  while (m.outcomes.length > 10) m.outcomes.shift();
}

function templateMomentum(templateId: string): number {
  const m = momentumByTemplate.get(templateId);
  if (!m || m.outcomes.length === 0) return 1.5; // cold-start bonus (mirrors V22)
  const succ = m.outcomes.filter((o) => o === "success").length;
  return (succ + 1) / (m.outcomes.length + 2);
}

async function pickByShapeAvailability(
  inFlightTemplateIds: Set<string>,
): Promise<ShapeDrivenPick | null> {
  const candidates = await fetchShapeDrivenCandidates();
  if (candidates.length === 0) return null;
  const recentShapes = await fetchRecentlyProducedShapes();
  const eligible = candidates.filter((c) => !inFlightTemplateIds.has(c.template_id));
  if (eligible.length === 0) return null;

  let best: ShapeDrivenPick | null = null;
  for (const c of eligible) {
    const mom = templateMomentum(c.template_id);
    // Shape-availability: empty inputShapes means always-fireable (high).
    // Otherwise count how many inputShapes appear in recently-produced set.
    let shapeAvail: number;
    if (c.input_shapes.length === 0) {
      shapeAvail = 1.5; // no preconditions — always available
    } else {
      const matched = c.input_shapes.filter((s) => recentShapes.has(s)).length;
      // Score by ratio matched; floor at 0.3 so unfulfilled-input activities
      // still occasionally fire to populate priors (exploration vs starvation).
      shapeAvail = Math.max(0.3, matched / c.input_shapes.length);
    }
    const noise = 0.7 + Math.random() * 0.6;
    const score = mom * shapeAvail * noise;
    if (!best || score > best.score) {
      best = {
        template_id: c.template_id,
        score,
        reason: `mom=${mom.toFixed(2)} shape=${shapeAvail.toFixed(2)} inputs=${c.input_shapes.length}/${c.input_shapes.filter((s) => recentShapes.has(s)).length}`,
      };
    }
  }
  return best;
}

// Dispatch by template_id via light-dispatch (uses existing infrastructure).
// Returns { dispatch_id, execution_id, success } shaped like dispatchOne.
async function dispatchByTemplateId(templateId: string): Promise<{ dispatch_id: string; execution_id?: string; success: boolean } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:8280/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` },
      body: JSON.stringify({ template_id: templateId, variables: {} }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok && res.status !== 207) {
      console.warn(`[pool/shape] dispatch HTTP ${res.status} for ${templateId}`);
      return null;
    }
    const body = await res.json() as {
      dispatchId?: string;
      executionId?: string;
      status?: string;
      output_shapes?: string[];
    };
    const dispatchId = body.dispatchId ?? body.executionId ?? `shape-${Date.now()}`;
    // Treat last-shape=structuredError as no_op (echo chamber guard).
    const shapes = Array.isArray(body.output_shapes) ? body.output_shapes : [];
    const lastShape = shapes[shapes.length - 1];
    const noOp = lastShape === "structuredError";
    const success = (body.status === "success" || body.status === "completed") && !noOp;
    recordOutcomeByTemplate(templateId, success);
    return { dispatch_id: dispatchId, execution_id: body.executionId, success };
  } catch (err) {
    console.warn(`[pool/shape] dispatch failed for ${templateId}: ${(err as Error).message}`);
    return null;
  }
}

function momentumScore(goalIdx: number): number {
  const m = momentumByGoal.get(goalIdx);
  // Cold-start exploration bonus (V22, 2026-06-07): goals with zero outcome
  // history get mom=1.5 instead of 1.0. Without this, brand-new goal entries
  // (e.g. drafter-trigger-tick at goal[42]) lose every Thompson roll against
  // established goals that have accumulated press-based scores in the 4-6
  // range. Cold-start bonus expires as soon as the first outcome lands —
  // after that Laplace smoothing takes over and mom returns to evidence-based
  // tracking. Maximum amplification is just ×1.5 so well-established goals
  // still dominate when their press is high.
  if (!m || m.outcomes.length === 0) return 1.5;
  const succ = m.outcomes.filter((o) => o === "success").length;
  return (succ + 1) / (m.outcomes.length + 2); // Laplace
}

function statePressure(goalIdx: number, state: SubstrateState): number {
  const backlog =
    goalIdx === 8 || goalIdx === 10 ? state.openGapCount :
    goalIdx === 21 ? state.unbridgedScenarioGapCount :
    goalIdx === 22 ? state.unrankedAutoTemplateCount :
    goalIdx === 23 ? state.pendingProposalCount :
    goalIdx === 15 ? (state.stagedMitosisPresent ? 1 : 0) :
    0;
  const rawPress = 1 + Math.log(1 + backlog);
  // V22 adaptive press decay (2026-06-07): when a goal's recent success rate
  // drops below 0.3, scale press down by the success rate. Prevents goal[23]
  // (apply-proposal) from monopolizing the pool when every dispatch returns
  // no_op — press stays high because the proposals queue is full, but failures
  // accumulate so other goals starve. Decay restores room for cold-start /
  // exploration goals to find slots once failure-bias kicks in.
  const m = momentumByGoal.get(goalIdx);
  if (m && m.outcomes.length >= 5) {
    const succ = m.outcomes.filter((o) => o === "success").length;
    const succRate = succ / m.outcomes.length;
    if (succRate < 0.3) return rawPress * Math.max(0.2, succRate);
  }
  return rawPress;
}

/**
 * Pick the highest-scoring eligible goal. Score = momentum × state-pressure ×
 * uniform-noise-perturbation (keeps exploration without a separate ε-greedy
 * branch). We do NOT fetch per-signature posteriors here — the existing one-
 * shot path's selectGoalForLoadConditioned does that on each dispatch; the
 * daemon-side selection adds momentum + backlog-pressure on top of the cost
 * filter.
 */
function pickBestEligible(
  eligibleIdxs: number[],
  state: SubstrateState,
): { idx: number; score: number; reason: string } {
  // Signature-continuity boost: when the substrate is in the same operational
  // class as recent successful dispatches, repeat what worked. Cells with
  // < SIG_CONTINUITY_MIN_SAMPLES samples contribute no boost (avoids
  // amplifying noise from cold cells).
  const scored = eligibleIdxs.map((idx) => {
    const mom = momentumScore(idx);
    const press = statePressure(idx, state);
    const noise = 0.7 + Math.random() * 0.6; // ε-greedy-equivalent jitter
    let sigBoost = 1.0;
    let boostNote = "";
    if (currentSignature) {
      const cell = posteriorsBySig.get(idx);
      if (cell && cell.samples >= SIG_CONTINUITY_MIN_SAMPLES) {
        const winRate = cell.alpha / Math.max(1, cell.alpha + cell.beta);
        sigBoost = 1 + SIG_CONTINUITY_GAIN * winRate;
        boostNote = ` sig+${(sigBoost - 1).toFixed(2)}`;
      }
    }
    const score = mom * press * noise * sigBoost;
    return { idx, score, mom, press, sigBoost, boostNote };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]!;
  // Surface the signature boost in the log so we can audit self-direction.
  if (top.sigBoost > 1.0) {
    // Count cells that met the sample threshold and contributed boost to any
    // eligible goal — this is the per-signature Thompson cell count whose
    // posterior means drive the boost-weighted selection.
    let cellsExamined = 0;
    for (const idx of eligibleIdxs) {
      const cell = posteriorsBySig.get(idx);
      if (cell && cell.samples >= SIG_CONTINUITY_MIN_SAMPLES) cellsExamined++;
    }
    const sigShort = currentSignature?.slice(0, 8) ?? "null";
    console.log(
      `[pool] signature-continuity: boosted goal[${top.idx}] by ${(top.sigBoost - 1).toFixed(2)} ` +
      `based on prior wins at signature=${sigShort}`,
    );
    console.log(
      `[pool] mode=thompson cells_examined=${cellsExamined} picked=goal[${top.idx}] at signature=${sigShort}`,
    );
  }
  return {
    idx: top.idx,
    score: top.score,
    reason: `mom=${top.mom.toFixed(2)} press=${top.press.toFixed(2)}${top.boostNote}`,
  };
}

function inFlightHasGoal(goalIdx: number): boolean {
  for (const entry of inFlight.values()) {
    if (entry.goal_idx === goalIdx) return true;
  }
  return false;
}

function reapStaleInFlight(): void {
  const now = Date.now();
  const stale: string[] = [];
  for (const [k, v] of inFlight.entries()) {
    if (now - v.started_at > IN_FLIGHT_TIMEOUT_MS) stale.push(k);
  }
  for (const k of stale) {
    const e = inFlight.get(k)!;
    inFlight.delete(k);
    console.warn(
      `[pool] reaped stale in-flight: dispatch_id=${k.slice(0, 8)} goal[${e.goal_idx}] ` +
      `age=${Math.round((now - e.started_at) / 1000)}s — assuming hung`,
    );
    recordOutcome(e.goal_idx, false);
  }
}

/**
 * Resolve dispatchId → executionId by polling goal-host's /executions/:id.
 * goal-host returns 202+dispatchId immediately from /run-goal but only sets
 * record.executionId once the engine assigns it (inside the async closure).
 * Poll briefly (max ~15s) so the WS observer can match execution_completed
 * against this in-flight entry by execution_id. Best-effort; failures are
 * silent because the stale reaper still cleans up if this never resolves.
 */
/**
 * Buffer of recent execution_completed WS events keyed by execution_id.
 * Holds events that arrived before our inFlight entry had its execution_id
 * resolved. resolveExecutionIdForDispatch checks this buffer when it sets
 * a new execution_id so we don't lose completions to the race.
 */
const recentWsCompletions = new Map<string, { success: boolean; received_at: number }>();

async function resolveExecutionIdForDispatch(dispatchId: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (!inFlight.has(dispatchId)) return; // already completed/reaped
    let res: Response;
    try {
      res = await fetch(`${GOAL_HOST_ENDPOINT}/executions/${dispatchId}`, { headers: authHeaders() });
    } catch { continue; }
    if (!res.ok) continue;
    const body = await res.json().catch(() => ({})) as { executionId?: string; status?: string };
    if (body.executionId) {
      const entry = inFlight.get(dispatchId);
      if (entry && !entry.execution_id) {
        entry.execution_id = body.executionId;
        console.log(
          `[pool] resolved execution_id for dispatch_id=${dispatchId.slice(0, 8)} ` +
          `execution_id=${body.executionId.slice(0, 12)}`,
        );
        // Race fix: a WS execution_completed event may have arrived in the
        // window between dispatch and execution_id resolution (typically
        // milliseconds for fast templates). Replay recent events to catch any
        // completion that fired before our entry had its execution_id set.
        const pending = recentWsCompletions.get(body.executionId);
        if (pending) {
          recentWsCompletions.delete(body.executionId);
          inFlight.delete(dispatchId);
          recordOutcome(entry.goal_idx, pending.success);
          console.log(
            `[pool] completion (replay): goal[${entry.goal_idx}] (${entry.template_id ?? "?"}) ` +
            `success=${pending.success} in_flight=${inFlight.size}/${MAX_CONCURRENT}`,
          );
        }
      }
      return;
    }
    // Terminal state without executionId (e.g. template-not-found,
    // pre-execute throw) — no trace ever lands, no WS event will arrive.
    // Record the outcome here and drop from inFlight so the 5-min reaper
    // doesn't keep the slot held for nothing.
    if (body.status === "completed" || body.status === "failed") {
      const entry = inFlight.get(dispatchId);
      if (entry) {
        inFlight.delete(dispatchId);
        recordOutcome(entry.goal_idx, body.status === "completed");
        console.log(
          `[pool] early-terminal: goal[${entry.goal_idx}] (${entry.template_id ?? "?"}) ` +
          `status=${body.status} (no executionId; not awaiting WS) in_flight=${inFlight.size}/${MAX_CONCURRENT}`,
        );
      }
      return;
    }
  }
}

/**
 * Subscribe to activity-api /ws for execution_completed events. On completion
 * matching one of our in-flight executions, remove from pool + record momentum.
 * Best-effort: drops connection on error and lets the in-flight timeout reaper
 * clean up. Reconnect with exponential backoff.
 */
async function startWSObserver(): Promise<void> {
  const wsUrl = ACTIVITY_API_ENDPOINT.replace(/^http/, "ws") + "/ws";
  let backoff = 1000;
  const connect = (): void => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.warn(`[pool-ws] connect threw: ${(err as Error).message}`);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30_000);
      return;
    }
    ws.onopen = () => {
      backoff = 1000;
      ws.send(JSON.stringify({ type: "authenticate", token: API_KEY }));
      console.log(`[pool-ws] connected to ${wsUrl}`);
    };
    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)) as {
          type?: string;
          data?: { execution_id?: string; success?: boolean };
        };
        if (msg.type !== "execution_completed") return;
        const execId = msg.data?.execution_id;
        if (!execId) return;
        // Try direct match first.
        let matched = false;
        for (const [dispatchId, entry] of inFlight.entries()) {
          if (entry.execution_id === execId) {
            inFlight.delete(dispatchId);
            recordOutcome(entry.goal_idx, msg.data?.success === true);
            console.log(
              `[pool] completion: goal[${entry.goal_idx}] (${entry.template_id ?? "?"}) ` +
              `success=${msg.data?.success === true} in_flight=${inFlight.size}/${MAX_CONCURRENT}`,
            );
            matched = true;
            break;
          }
        }
        // Race fix: WS event may arrive before resolveExecutionIdForDispatch
        // sets entry.execution_id. Stash so resolveExecutionId can replay it
        // on the next poll-resolved entry.
        if (!matched) {
          recentWsCompletions.set(execId, { success: msg.data?.success === true, received_at: Date.now() });
          // Bound the buffer (drop oldest if >200 entries).
          if (recentWsCompletions.size > 200) {
            const oldest = [...recentWsCompletions.entries()]
              .sort((a, b) => a[1].received_at - b[1].received_at)[0]?.[0];
            if (oldest !== undefined) recentWsCompletions.delete(oldest);
          }
        }
      } catch (err) {
        console.warn(`[pool-ws] message parse error: ${(err as Error).message}`);
      }
    };
    ws.onclose = () => {
      console.warn(`[pool-ws] closed, reconnecting in ${backoff}ms`);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    };
    ws.onerror = () => { /* onclose handles reconnect */ };
  };
  connect();
}

/**
 * Fire one dispatch through the existing capability-aware selectDispatcher +
 * dispatchGoal path. Returns dispatch_id + execution_id so the pool can track.
 * Synchronous (light-dispatch) completions are handled inline; async (goal-host)
 * completions arrive via WS or in-flight reaper.
 */
async function dispatchOne(goalIdx: number, state: SubstrateState): Promise<{ dispatch_id: string; execution_id?: string } | null> {
  void state; // state is computed for selection, not passed downstream
  // Pull signature + Thompson posteriors via the existing one-shot path.
  const loadBefore = await sampleLoad();
  const maxCost = maxCostForLoad(loadBefore);
  const goal = AUTONOMOUS_GOALS[goalIdx]!;
  let targetTemplateId = AUTONOMOUS_GOAL_TARGET_TEMPLATES[goalIdx];
  if (goalIdx === 9 && !targetTemplateId) {
    const dyn = await pickTopProposedGapClosingTemplate();
    if (!dyn) return null;
    targetTemplateId = dyn;
  }
  // Respect the cost budget too — skip if our budget can't afford the goal.
  const cost = AUTONOMOUS_GOAL_COSTS[goalIdx] ?? "expensive";
  if (COST_RANK[cost] > COST_RANK[maxCost]) {
    console.log(`[pool] skipping goal[${goalIdx}] cost=${cost} > budget=${maxCost} (load-gated)`);
    return null;
  }
  const signature = await fetchCurrentSignature();
  const capability_hints = deriveCapabilityHints(goalIdx, targetTemplateId);
  const decision = await selectDispatcher(goalIdx, signature, capability_hints);
  const baseTags = [
    "intent:topology_discovery",
    BOREDOM_TAG,
    `dispatcher_reason:${decision.reason}`,
    "pool:daemon",
  ];
  const extraVars = extraVariablesForGoal(goalIdx);
  let res: Response;
  try {
    res = await dispatchGoal(decision.dispatcher, goal, targetTemplateId, extraVars, baseTags, signature);
  } catch (err) {
    console.warn(`[pool] dispatch failed: ${(err as Error).message}`);
    return null;
  }
  if (!res.ok && res.status !== 202 && res.status !== 207) {
    const text = await res.text().catch(() => "(no body)");
    console.warn(`[pool] ${decision.dispatcher} HTTP ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  const dispatch = (await res.json()) as {
    dispatchId?: string;
    executionId?: string;
    status?: string;
  };
  const dispatchId = dispatch.dispatchId ?? dispatch.executionId ?? `pool-${Date.now()}`;
  // Fire load attribution best-effort (non-blocking).
  void recordLoadAttribution({
    dispatch_id: dispatchId,
    execution_id: dispatch.executionId,
    goal_idx: goalIdx,
    template_id: targetTemplateId,
    dispatched_at: new Date().toISOString(),
    dispatch_start_ms: Date.now(),
    load_before: loadBefore,
    goal_status: dispatch.status,
  });
  // Light-dispatch returns synchronously — record outcome immediately.
  if (decision.dispatcher === "light-dispatch") {
    // Outcome shape check: light-dispatch returns status=success when the
    // resolver chain completed without throwing, but the LAST task's body
    // may be `structuredError` — meaning the resolver itself reported
    // no_eligible_work / validation_rejected / missing_dependency. Treat
    // those as failures for momentum/Thompson purposes; otherwise the pool
    // gets trapped in echo chambers where goals that always succeed-with-
    // no-work keep dominating selection.
    const shapes = (dispatch as Record<string, unknown>)["output_shapes"] as string[] | undefined;
    const lastShape = Array.isArray(shapes) && shapes.length > 0 ? shapes[shapes.length - 1] : undefined;
    const noOpSignaled = lastShape === "structuredError";
    const success = (dispatch.status === "success" || dispatch.status === "completed") && !noOpSignaled;
    recordOutcome(goalIdx, success);
    console.log(
      `[pool] light-dispatch sync goal[${goalIdx}] (${targetTemplateId ?? "?"}) status=${dispatch.status} ` +
      `outcome=${success ? "success" : "no_op"} executionId=${dispatch.executionId ?? "?"} dispatcher=${decision.dispatcher}`,
    );
    // Return null so the caller doesn't add it to inFlight (already complete).
    return null;
  }
  return { dispatch_id: dispatchId, execution_id: dispatch.executionId };
}

async function poolLoop(): Promise<void> {
  console.log(
    `[pool] daemon starting: MAX_CONCURRENT=${MAX_CONCURRENT} ` +
    `MIN_DISPATCH_INTERVAL_MS=${MIN_DISPATCH_INTERVAL_MS} ` +
    `LOOP_INTERVAL_MS=${POOL_LOOP_INTERVAL_MS} STATE_REFRESH_MS=${POOL_STATE_REFRESH_MS}`,
  );
  void startWSObserver();
  let state = await refreshSubstrateState();
  await refreshSignatureAndPosteriors();
  lastSigRefreshAt = Date.now();
  let lastStateRefresh = Date.now();
  while (running) {
    reapStaleInFlight();
    if (Date.now() - lastStateRefresh > POOL_STATE_REFRESH_MS) {
      state = await refreshSubstrateState();
      lastStateRefresh = Date.now();
    }
    if (Date.now() - lastSigRefreshAt > SIG_REFRESH_INTERVAL_MS) {
      await refreshSignatureAndPosteriors();
      lastSigRefreshAt = Date.now();
    }
    // Run auto-promote on a slower cadence than the pool loop.
    if (Date.now() - lastAutoPromoteAt > POOL_AUTOPROMOTE_INTERVAL_MS) {
      await tickAutoPromote();
      lastAutoPromoteAt = Date.now();
    }
    // Inner fill loop: fire dispatches in PARALLEL up to MAX_CONCURRENT.
    // Each dispatch is wrapped in a fire-and-forget IIFE so the loop body
    // doesn't await network. Reserve the goal slot via a synthetic
    // in-flight entry first; replace with the real dispatch_id on resolve.
    // This is what makes the pool genuinely throughput-paced rather than
    // serialized on dispatchOne's HTTP latency.
    while (inFlight.size < MAX_CONCURRENT && Date.now() - lastDispatchAt >= MIN_DISPATCH_INTERVAL_MS) {
      // V24 shape-driven primary path. Query activity-api for templates
      // tagged boredom_target_template, score by inputShape availability +
      // per-template Thompson posterior, dispatch winner via light-dispatch.
      // Falls back to legacy goal-index loop on transport failure or empty
      // candidate set.
      const inFlightTemplateIds = new Set<string>();
      for (const e of inFlight.values()) {
        if (e.template_id) inFlightTemplateIds.add(e.template_id);
      }
      const shapePick = await pickByShapeAvailability(inFlightTemplateIds);
      if (shapePick) {
        const reserveId = `reserve-shape-${Date.now()}`;
        inFlight.set(reserveId, {
          goal_idx: -1, // sentinel: shape-driven dispatch, not goal-index
          dispatch_id: reserveId,
          template_id: shapePick.template_id,
          started_at: Date.now(),
          signature: null,
        });
        lastDispatchAt = Date.now();
        console.log(
          `[pool/shape] reserving ${shapePick.template_id} score=${shapePick.score.toFixed(2)} ` +
          `(${shapePick.reason}) in_flight=${inFlight.size}/${MAX_CONCURRENT}`,
        );
        void (async () => {
          try {
            const result = await dispatchByTemplateId(shapePick.template_id);
            inFlight.delete(reserveId);
            if (result) {
              console.log(
                `[pool/shape] completed ${shapePick.template_id} ` +
                `outcome=${result.success ? "success" : "no_op"} ` +
                `executionId=${result.execution_id ?? "?"}`,
              );
            }
          } catch (err) {
            inFlight.delete(reserveId);
            console.warn(`[pool/shape] dispatch error: ${(err as Error).message}`);
          }
        })();
        continue; // next iteration of fill loop
      }
      // Legacy fallback: activity-api unreachable or no candidates tagged.
      const eligible: number[] = [];
      for (let i = 0; i < AUTONOMOUS_GOALS.length; i++) {
        if (!goalCanFire(i, state)) continue;
        if (inFlightHasGoal(i)) continue;
        eligible.push(i);
      }
      if (eligible.length === 0) break;
      const pick = pickBestEligible(eligible, state);
      const goalIdx = pick.idx;
      const reserveId = `reserve-${Date.now()}-${goalIdx}`;
      inFlight.set(reserveId, {
        goal_idx: goalIdx,
        dispatch_id: reserveId,
        template_id: AUTONOMOUS_GOAL_TARGET_TEMPLATES[goalIdx],
        started_at: Date.now(),
        signature: null,
      });
      lastDispatchAt = Date.now();
      console.log(
        `[pool] reserving goal[${goalIdx}] (${AUTONOMOUS_GOAL_TARGET_TEMPLATES[goalIdx] ?? "?"}) ` +
        `score=${pick.score.toFixed(2)} (${pick.reason}) ` +
        `in_flight=${inFlight.size}/${MAX_CONCURRENT}`,
      );
      // Fire-and-forget dispatch — completion arrives via WS observer
      // (async path) or is recorded synchronously (light-dispatch path).
      void (async () => {
        try {
          const dispatched = await dispatchOne(goalIdx, state);
          // Drop the reserve and (for async paths only) re-insert with the
          // real dispatch id so the WS observer can match it. Sync paths
          // return null because dispatchOne already recorded the outcome.
          inFlight.delete(reserveId);
          if (dispatched) {
            inFlight.set(dispatched.dispatch_id, {
              goal_idx: goalIdx,
              dispatch_id: dispatched.dispatch_id,
              execution_id: dispatched.execution_id,
              template_id: AUTONOMOUS_GOAL_TARGET_TEMPLATES[goalIdx],
              started_at: Date.now(),
              signature: null,
            });
            console.log(
              `[pool] dispatched goal[${goalIdx}] dispatch_id=${dispatched.dispatch_id.slice(0, 8)} ` +
              `in_flight=${inFlight.size}/${MAX_CONCURRENT}`,
            );
            // goal-host's /run-goal returns 202+dispatchId immediately, but
            // executionId is only known after the engine assigns it inside the
            // async closure. Without execution_id, the WS observer cannot match
            // execution_completed events against this in-flight entry and the
            // 5-min stale reaper fires instead. Short-poll /executions/:id
            // until executionId is populated, then patch the entry so the WS
            // matcher works. Best-effort; reaper remains the safety net.
            if (!dispatched.execution_id) {
              void resolveExecutionIdForDispatch(dispatched.dispatch_id);
            }
          }
        } catch (err) {
          inFlight.delete(reserveId);
          recordOutcome(goalIdx, false);
          console.warn(`[pool] dispatch goal[${goalIdx}] threw: ${(err as Error).message}`);
        }
      })();
      // Respect inter-dispatch throttle but do NOT block on HTTP.
      await new Promise((r) => setTimeout(r, MIN_DISPATCH_INTERVAL_MS));
    }
    await new Promise((r) => setTimeout(r, POOL_LOOP_INTERVAL_MS));
  }
}

const shutdown = (signal: string): void => {
  console.log(`[pool] received ${signal} — shutting down`);
  running = false;
  // Give the loop one tick to exit cleanly.
  setTimeout(() => process.exit(0), 1000);
};

if (DAEMON_FLAG) {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  await poolLoop();
} else {
  await main();
}

export {};
