#!/usr/bin/env bun
/**
 * stratified-harness.ts — Phase 25.2 coverage matrix driver.
 *
 * Consumes a generated goals file (from goal-generator.ts), runs recommendations
 * and queries matching traces from activity-api, then emits a 24-cell coverage
 * matrix report.
 *
 * Usage:
 *   bun run validation/scripts/stratified-harness.ts \
 *     --goals validation/generated/<seed>-<date>.json \
 *     [--baseline validation/results/<prior>-stratified-report.json] \
 *     [--label "run label"] \
 *     [--detailed]
 *
 * Config: reads METABOB_ENDPOINT / METABOB_API_KEY or ~/.metabob/config.json.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  scoreDecisionRecordCompleteness,
  POSTERIOR_KEYS,
  BINDING_KEYS,
} from "./lib/decision-record-completeness.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

async function loadConfig(): Promise<{ endpoint: string; apiKey: string }> {
  const envEndpoint = process.env.METABOB_ENDPOINT;
  const envKey = process.env.METABOB_API_KEY;
  const configPath = join(homedir(), ".metabob", "config.json");
  if (existsSync(configPath)) {
    const raw = JSON.parse(await readFile(configPath, "utf8")) as {
      metabob?: { endpoint?: string; apiKey?: string };
    };
    const endpoint = envEndpoint ?? raw.metabob?.endpoint ?? "https://activity.metabob.com";
    const apiKey = envKey ?? raw.metabob?.apiKey ?? "";
    if (apiKey) return { endpoint, apiKey };
  }
  if (envEndpoint && envKey) return { endpoint: envEndpoint, apiKey: envKey };
  throw new Error("METABOB_API_KEY not set. Set via env var or ~/.metabob/config.json");
}

// ---------------------------------------------------------------------------
// Types from goal-generator output
// ---------------------------------------------------------------------------

interface GeneratedGoal {
  id: string;
  cell_id: string;
  shape_signature: { input_shapes: string[]; output_shapes: string[] };
  goal_text: string;
  expected_output_shapes: string[];
  seed_impulse_pool: string[];
  adversarial: boolean;
  oracle_label_id: string | null;
  generator_seed: string;
  shape_registry_snapshot_hash: string;
  novelty: string;
  depth: string;
  scenario: string;
  topology_gap_band?: string;
}

interface GeneratedGoalsFile {
  generator_version: string;
  generated_at: string;
  generator_seed: string;
  count: number;
  shape_registry_snapshot_hash: string;
  goals: GeneratedGoal[];
}

// ---------------------------------------------------------------------------
// Activity recommendation types
// ---------------------------------------------------------------------------

interface RecommendationEntry {
  id?: string;
  template_id?: string;
  activity_id?: string;
  name?: string;
  tags?: string[];
  input_shapes?: string[];
  output_shapes?: string[];
  total_executions?: number;
  selection_metadata?: {
    method?: string;
    score_source?: string;
    alpha?: number;
    beta?: number;
    sample?: number;
    exploration_slot?: boolean;
  };
}

interface RecommendResponse {
  recommendations?: RecommendationEntry[];
  activities?: RecommendationEntry[];
  templates?: RecommendationEntry[];
}

// ---------------------------------------------------------------------------
// Trace types
// ---------------------------------------------------------------------------

interface TaskRecord {
  id?: string;
  status?: string;
  resolver_id?: string;
  resolver_tier?: string;
  cost_usd?: number;
  activity_id?: string;
  input_impulse_ids?: string[];
  output_impulse_ids?: string[];
  decision_record?: Record<string, unknown>;
  failure_mode?: { type?: string; reason?: string } | null;
}

interface ExecutionTrace {
  id?: string;
  status?: string;
  cost_usd?: number;
  duration_ms?: number;
  activity_id?: string;
  template_id?: string;
  output_shapes?: string[];
  tasks?: TaskRecord[];
  composition_chain?: string[];
  created_at?: string;
  failure_mode?: { type?: string } | null;
}

interface TraceListResponse {
  traces?: ExecutionTrace[];
  data?: ExecutionTrace[];
  executions?: ExecutionTrace[];
}

// ---------------------------------------------------------------------------
// Coverage matrix cell metrics
// ---------------------------------------------------------------------------

interface CellMetrics {
  sample_count: number;
  success_count: number;
  success_rate: number | null;
  cost_usd_samples: number[];
  cost_p50_usd: number | null;
  reuse_efficiency_samples: number[];
  reuse_efficiency: number | null;
  improvise_share_samples: number[];
  improvise_share: number | null;
  decision_record_completeness_samples: number[];
  decision_record_completeness: number | null;
  // Phase 25.6: witness_disagreement deferred
  witness_disagreement: null;
  floor_pass: boolean;
  floor_status?: string;
  // Recommendation-quality sub-metrics (from recommend calls)
  recommend_coverage: number | null;  // fraction of goals with ≥1 recommended activity
  recommend_shape_match: number | null; // fraction of recommendations covering expected_output_shapes
}

interface CoverageMatrix {
  [cellId: string]: CellMetrics;
}

// ---------------------------------------------------------------------------
// Shortest-path cache (Phase 25.3 optimality gap)
// ---------------------------------------------------------------------------

interface ShortestPathEntry {
  shortest_cost_usd: number;
  shortest_chain: string[];
  shortest_observed_at: string;
  observation_count: number;
}

type ShortestPathCache = Record<string, ShortestPathEntry>;

async function loadShortestPathCache(statePath: string): Promise<ShortestPathCache> {
  if (!existsSync(statePath)) return {};
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as ShortestPathCache;
  } catch {
    return {};
  }
}

async function saveShortestPathCache(statePath: string, cache: ShortestPathCache): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(cache, null, 2), "utf8");
}

function updateShortestPathCache(
  cache: ShortestPathCache,
  cellId: string,
  costUsd: number,
  chain: string[]
): void {
  const now = new Date().toISOString();
  if (!(cellId in cache)) {
    cache[cellId] = {
      shortest_cost_usd: costUsd,
      shortest_chain: chain,
      shortest_observed_at: now,
      observation_count: 1,
    };
  } else if (costUsd < cache[cellId].shortest_cost_usd) {
    cache[cellId].shortest_cost_usd = costUsd;
    cache[cellId].shortest_chain = chain;
    cache[cellId].shortest_observed_at = now;
    cache[cellId].observation_count += 1;
  } else {
    cache[cellId].observation_count += 1;
  }
}

function evictStaleEntries(cache: ShortestPathCache): void {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const key of Object.keys(cache)) {
    const entry = cache[key];
    const age = new Date(entry.shortest_observed_at).getTime();
    if (age < cutoff && entry.observation_count < 3) {
      delete cache[key];
    }
  }
}

// ---------------------------------------------------------------------------
// Recommendation runner
// ---------------------------------------------------------------------------

async function runRecommendation(
  goal: GeneratedGoal,
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<RecommendationEntry[]> {
  try {
    const resp = await fetch(`${endpoint}/v2/activities/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        goal_description: goal.goal_text,
        expected_output_shapes: goal.expected_output_shapes,
        impulse_pool: goal.seed_impulse_pool.map((s) => ({ type: s })),
        limit: 5,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) return [];
    const body = (await resp.json()) as RecommendResponse;
    return body.recommendations ?? body.activities ?? body.templates ?? [];
  } catch {
    return [];
  }
}

function recommendationCoversOutputShapes(
  rec: RecommendationEntry,
  expectedOutputShapes: string[]
): boolean {
  if (!rec.output_shapes?.length) return false;
  return expectedOutputShapes.every((s) => rec.output_shapes!.includes(s));
}

// ---------------------------------------------------------------------------
// Trace query: find recent traces matching output shapes
// ---------------------------------------------------------------------------

async function queryMatchingTraces(
  outputShapes: string[],
  endpoint: string,
  authHeaders: Record<string, string>,
  limit = 10
): Promise<ExecutionTrace[]> {
  if (!outputShapes.length) return [];
  try {
    // Query traces by output shape (using executionTraceList with shape filter)
    const resp = await fetch(
      `${endpoint}/v2/activities/execution-traces?` +
        new URLSearchParams({
          output_shapes: outputShapes.join(","),
          limit: String(limit),
          order: "desc",
        }),
      {
        headers: authHeaders,
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!resp.ok) {
      // Fallback: try POST body form
      const resp2 = await fetch(`${endpoint}/v2/activities/execution-traces`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ output_shapes: outputShapes, limit }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!resp2.ok) return [];
      const body2 = (await resp2.json()) as TraceListResponse;
      return body2.traces ?? body2.data ?? body2.executions ?? [];
    }
    const body = (await resp.json()) as TraceListResponse;
    return body.traces ?? body.data ?? body.executions ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Per-trace scoring
// ---------------------------------------------------------------------------

function p50<T extends number>(arr: T[]): T | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function mean(arr: number[]): number | null {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

interface TraceScores {
  success: boolean;
  cost_usd: number | null;
  reuse_efficiency: number | null;
  improvise_share: number | null;
  decision_record_completeness: number | null;
}

// POSTERIOR_KEYS and BINDING_KEYS imported from lib/decision-record-completeness.ts

function scoreTasks(
  tasks: TaskRecord[],
  thompsonPoolIds: Set<string>,
  trace: ExecutionTrace
): {
  reuse_efficiency: number | null;
  improvise_share: number | null;
  decision_record_completeness: number | null;
} {
  if (!tasks.length) return { reuse_efficiency: null, improvise_share: null, decision_record_completeness: null };

  const taskCosts = tasks.map((t) => t.cost_usd ?? 0);
  const totalCost = taskCosts.reduce((s, v) => s + v, 0);

  // Reuse efficiency: cost of tasks using known-warm templates / total
  let reusedCost = 0;
  for (const t of tasks) {
    const actId = t.activity_id ?? "";
    const isReused =
      thompsonPoolIds.has(actId) &&
      !actId.includes("improvise") &&
      (t.cost_usd ?? 0) > 0;
    if (isReused) reusedCost += t.cost_usd ?? 0;
  }
  const reuse_efficiency = totalCost > 0 ? reusedCost / totalCost : 0;

  // Improvise share: fraction of tasks with improvise in activity_id
  const impCount = tasks.filter((t) => (t.activity_id ?? "").includes("improvise")).length;
  const improvise_share = impCount / tasks.length;

  // Decision record completeness delegated to lib/decision-record-completeness.ts
  const drcScores = scoreDecisionRecordCompleteness(tasks, trace);
  const decision_record_completeness = drcScores?.completeness ?? null;

  return { reuse_efficiency, improvise_share, decision_record_completeness };
}

function scoreTrace(trace: ExecutionTrace, thompsonPoolIds: Set<string>): TraceScores {
  const success = trace.status === "success" || trace.status === "completed";
  const cost_usd = typeof trace.cost_usd === "number" ? trace.cost_usd : null;
  const taskScores = scoreTasks(trace.tasks ?? [], thompsonPoolIds, trace);
  return { success, cost_usd, ...taskScores };
}

// ---------------------------------------------------------------------------
// Thompson pool snapshot (mirrors reuse-harness.ts)
// ---------------------------------------------------------------------------

interface ThompsonEntry {
  template_id?: string;
  id?: string;
  activity_id?: string;
  total_executions?: number;
  alpha?: number;
  beta?: number;
}

async function captureThompsonSnapshot(
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const resp = await fetch(`${endpoint}/v2/activities/templates?limit=200`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) return ids;
    const body = await resp.json() as { templates?: ThompsonEntry[]; data?: ThompsonEntry[] };
    const templates = body.templates ?? body.data ?? [];
    for (const t of templates) {
      const id = t.template_id ?? t.id ?? t.activity_id;
      const executions = t.total_executions ?? 0;
      if (id && executions > 0) ids.add(id);
    }
  } catch {
    // Non-fatal
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Cell metrics initialization
// ---------------------------------------------------------------------------

function emptyCell(): CellMetrics {
  return {
    sample_count: 0,
    success_count: 0,
    success_rate: null,
    cost_usd_samples: [],
    cost_p50_usd: null,
    reuse_efficiency_samples: [],
    reuse_efficiency: null,
    improvise_share_samples: [],
    improvise_share: null,
    decision_record_completeness_samples: [],
    decision_record_completeness: null,
    witness_disagreement: null,
    floor_pass: false,
    recommend_coverage: null,
    recommend_shape_match: null,
  };
}

// Per-cell floor thresholds (from design §B)
const FLOORS = {
  success_rate: 0.30,
  reuse_efficiency: 0.40,     // only when sample_count ≥ 3 and depth ≥ 1
  decision_record_completeness: 0.90,
  witness_disagreement_max: 0.15,
};

function computeFloorPass(cell: CellMetrics, cellId: string): boolean {
  if (cell.sample_count < 3) return false;
  if (cell.floor_status === "gated_on_phase_22") return false;

  if (cell.success_rate !== null && cell.success_rate < FLOORS.success_rate) return false;
  if (cell.decision_record_completeness !== null &&
    cell.decision_record_completeness < FLOORS.decision_record_completeness) return false;

  // reuse_efficiency floor only for depth ≥ 1 cells
  const hasDepth = cellId.includes("depth1") || cellId.includes("depth2+");
  if (hasDepth && cell.reuse_efficiency !== null &&
    cell.reuse_efficiency < FLOORS.reuse_efficiency) return false;

  return true;
}

function finalizeCell(cell: CellMetrics, cellId: string): void {
  const n = cell.sample_count;
  if (n === 0) return;

  cell.success_rate = n > 0 ? cell.success_count / n : null;
  cell.cost_p50_usd = p50(cell.cost_usd_samples.filter((v): v is number => v !== null));
  cell.reuse_efficiency = mean(cell.reuse_efficiency_samples);
  cell.improvise_share = mean(cell.improvise_share_samples);
  cell.decision_record_completeness = mean(cell.decision_record_completeness_samples);
  cell.floor_pass = computeFloorPass(cell, cellId);
}

// ---------------------------------------------------------------------------
// Refinement event detection (Phase 25.4 — minimal E.1 implementation)
// ---------------------------------------------------------------------------

interface RefinementEvent {
  type: "compression" | "tier_descent" | "ci_narrowing";
  cell_id: string;
  description: string;
  prior_value: number | null;
  current_value: number | null;
}

interface PriorReport {
  coverage_matrix?: Record<string, { success_rate?: number | null; sample_count?: number }>;
}

function detectRefinementEvents(
  currentMatrix: CoverageMatrix,
  priorReport: PriorReport | null
): RefinementEvent[] {
  if (!priorReport?.coverage_matrix) return [];
  const events: RefinementEvent[] = [];

  for (const [cellId, current] of Object.entries(currentMatrix)) {
    const prior = priorReport.coverage_matrix[cellId];
    if (!prior || !current.success_rate || !prior.success_rate) continue;

    // Compression event: success_rate improved by ≥ 0.10 and sample_count grew
    const successDelta = current.success_rate - (prior.success_rate ?? 0);
    if (successDelta >= 0.10 && current.sample_count > (prior.sample_count ?? 0)) {
      events.push({
        type: "compression",
        cell_id: cellId,
        description: `success_rate improved from ${prior.success_rate?.toFixed(3)} to ${current.success_rate.toFixed(3)}`,
        prior_value: prior.success_rate ?? null,
        current_value: current.success_rate,
      });
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Optimality ratio per cell
// ---------------------------------------------------------------------------

function computeOptimalityRatios(
  rawCellCosts: Record<string, number[]>,
  cache: ShortestPathCache
): Record<string, number | null> {
  const ratios: Record<string, number | null> = {};
  for (const [cellId, costs] of Object.entries(rawCellCosts)) {
    const entry = cache[cellId];
    if (!entry || !costs.length) {
      ratios[cellId] = null;
      continue;
    }
    const meanCost = costs.reduce((s, v) => s + v, 0) / costs.length;
    ratios[cellId] = meanCost / entry.shortest_cost_usd;
  }
  return ratios;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      goals: { type: "string" },
      baseline: { type: "string", default: "" },
      label: { type: "string", default: "" },
      detailed: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values["goals"]) {
    console.error("Usage: stratified-harness.ts --goals <path-to-goals.json> [--baseline <prior-report>]");
    process.exit(1);
  }

  const { endpoint, apiKey } = await loadConfig();
  const authHeaders = { Authorization: `ApiKey ${apiKey}` };

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(scriptDir, "..", "..");

  // Load generated goals
  const goalsPath = resolvePath(values["goals"]!);
  if (!existsSync(goalsPath)) {
    console.error(`Goals file not found: ${goalsPath}`);
    process.exit(1);
  }
  const goalsFile = JSON.parse(await readFile(goalsPath, "utf8")) as GeneratedGoalsFile;
  const goals = goalsFile.goals;

  console.log(`\nStratified Harness — Phase 25.2`);
  console.log(`  goals file  : ${goalsPath}`);
  console.log(`  goal count  : ${goals.length}`);
  console.log(`  endpoint    : ${endpoint}`);
  console.log(`  label       : ${values["label"] || "(none)"}`);

  // Load prior report for refinement detection
  let priorReport: PriorReport | null = null;
  if (values["baseline"]) {
    const baselinePath = resolvePath(values["baseline"]!);
    if (existsSync(baselinePath)) {
      priorReport = JSON.parse(await readFile(baselinePath, "utf8")) as PriorReport;
      console.log(`  baseline    : ${baselinePath}`);
    }
  }

  // Load state
  const statePath = join(repoRoot, "validation", "state", "shortest-paths.json");
  const shortestPaths = await loadShortestPathCache(statePath);
  evictStaleEntries(shortestPaths);

  // Capture Thompson pool snapshot
  console.log("\n  Capturing Thompson snapshot...");
  const thompsonPoolIds = await captureThompsonSnapshot(endpoint, authHeaders);
  console.log(`  Thompson pool: ${thompsonPoolIds.size} templates`);

  // Initialize coverage matrix
  const matrix: CoverageMatrix = {};
  const rawCellCosts: Record<string, number[]> = {};
  const perGoalResults: Array<{
    goal_id: string;
    cell_id: string;
    recommend_count: number;
    recommend_shape_match: boolean;
    trace_count: number;
    scores: TraceScores[];
  }> = [];

  const BUDGET_CAP = 200;
  let apiCallCount = 0;

  console.log(`\n  Processing ${goals.length} goals...\n`);

  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const cellId = goal.cell_id;

    if (!matrix[cellId]) {
      matrix[cellId] = emptyCell();
      rawCellCosts[cellId] = [];
    }

    const cell = matrix[cellId];

    if (apiCallCount >= BUDGET_CAP) {
      console.log(`  Budget cap (${BUDGET_CAP} API calls) reached — stopping early`);
      break;
    }

    process.stdout.write(`  [${i + 1}/${goals.length}] cell=${cellId} `);

    // 1. Run recommendation
    const recs = await runRecommendation(goal, endpoint, authHeaders);
    apiCallCount++;

    const hasAnyRec = recs.length > 0;
    const hasShapeMatch = recs.some((r) =>
      recommendationCoversOutputShapes(r, goal.expected_output_shapes)
    );

    // 2. Query matching traces
    const traces = await queryMatchingTraces(
      goal.expected_output_shapes,
      endpoint,
      authHeaders,
      5
    );
    apiCallCount++;

    // 3. Score traces
    const traceScores: TraceScores[] = [];
    for (const trace of traces) {
      const score = scoreTrace(trace, thompsonPoolIds);
      traceScores.push(score);

      cell.sample_count++;
      if (score.success) {
        cell.success_count++;
        if (score.cost_usd !== null) {
          cell.cost_usd_samples.push(score.cost_usd);
          rawCellCosts[cellId].push(score.cost_usd);
          // Update shortest-path cache
          const chain = trace.composition_chain ?? (trace.activity_id ? [trace.activity_id] : []);
          updateShortestPathCache(shortestPaths, cellId, score.cost_usd, chain);
        }
      }
      if (score.reuse_efficiency !== null) cell.reuse_efficiency_samples.push(score.reuse_efficiency);
      if (score.improvise_share !== null) cell.improvise_share_samples.push(score.improvise_share);
      if (score.decision_record_completeness !== null)
        cell.decision_record_completeness_samples.push(score.decision_record_completeness);
    }

    // Scenario D gating — parse from cell_id since goal.scenario may be null
    if (cellId.includes("C∪D") || goal.scenario === "C∪D" || goal.topology_gap_band === "D") {
      cell.floor_status = "gated_on_phase_22";
    }

    perGoalResults.push({
      goal_id: goal.id,
      cell_id: cellId,
      recommend_count: recs.length,
      recommend_shape_match: hasShapeMatch,
      trace_count: traces.length,
      scores: traceScores,
    });

    process.stdout.write(
      `recs=${recs.length} shape_match=${hasShapeMatch ? "✓" : "✗"} traces=${traces.length}\n`
    );
  }

  // Finalize cells
  for (const [cellId, cell] of Object.entries(matrix)) {
    // Compute recommend_coverage / recommend_shape_match from per-goal results in this cell
    const goalResults = perGoalResults.filter((r) => r.cell_id === cellId);
    cell.recommend_coverage =
      goalResults.length > 0
        ? goalResults.filter((r) => r.recommend_count > 0).length / goalResults.length
        : null;
    cell.recommend_shape_match =
      goalResults.length > 0
        ? goalResults.filter((r) => r.recommend_shape_match).length / goalResults.length
        : null;
    finalizeCell(cell, cellId);
  }

  // Detect refinement events
  const refinementEvents = detectRefinementEvents(matrix, priorReport);

  // Compute optimality ratios
  const optimalityRatios = computeOptimalityRatios(rawCellCosts, shortestPaths);

  // Save shortest-path cache
  await saveShortestPathCache(statePath, shortestPaths);

  // Top-level pass/fail
  const passableCells = Object.entries(matrix).filter(
    ([, c]) => c.sample_count >= 3 && c.floor_status !== "gated_on_phase_22"
  );
  const universality_pass =
    passableCells.length === 0
      ? null
      : passableCells.every(([, c]) => c.floor_pass);

  // Strip internal sample arrays before output
  const matrixOutput: Record<string, Omit<CellMetrics, "cost_usd_samples" | "reuse_efficiency_samples" | "improvise_share_samples" | "decision_record_completeness_samples">> = {};
  for (const [cellId, cell] of Object.entries(matrix)) {
    const { cost_usd_samples, reuse_efficiency_samples, improvise_share_samples, decision_record_completeness_samples, ...rest } = cell;
    matrixOutput[cellId] = rest;
  }

  // Build report
  const report = {
    harness_version: "25.2",
    run_at: new Date().toISOString(),
    label: values["label"] || undefined,
    goals_file: goalsPath,
    generator_seed: goalsFile.generator_seed,
    shape_registry_snapshot_hash: goalsFile.shape_registry_snapshot_hash,
    endpoint,
    thompson_pool_size: thompsonPoolIds.size,
    goals_processed: perGoalResults.length,
    api_call_count: apiCallCount,
    universality_pass,
    cell_count: Object.keys(matrix).length,
    passable_cell_count: passableCells.length,
    coverage_matrix: matrixOutput,
    optimality_ratios: optimalityRatios,
    refinement_event_count: refinementEvents.length,
    refinement_event_density:
      perGoalResults.length > 0 ? refinementEvents.length / perGoalResults.length : 0,
    refinement_events: refinementEvents,
    ...(values["detailed"] ? { per_goal_results: perGoalResults } : {}),
  };

  // Write report
  const resultsDir = join(repoRoot, "validation", "results");
  await mkdir(resultsDir, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const reportPath = join(resultsDir, `${dateStr}-stratified-report.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  // Summary output
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Stratified Coverage Matrix`);
  console.log(`${"─".repeat(60)}`);
  console.log(`  Cells populated   : ${Object.keys(matrix).length}`);
  console.log(`  Passable cells    : ${passableCells.length}`);
  console.log(`  Universality pass : ${universality_pass === null ? "N/A (no cells w/ n≥3)" : universality_pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Refinement events : ${refinementEvents.length}`);
  console.log(`  API calls         : ${apiCallCount}`);
  console.log(`\nPer-cell summary:`);
  for (const [cellId, cell] of Object.entries(matrixOutput)) {
    const sr = cell.success_rate !== null ? `sr=${cell.success_rate.toFixed(2)}` : "sr=?";
    const re = cell.reuse_efficiency !== null ? ` re=${cell.reuse_efficiency.toFixed(2)}` : "";
    const is_ = cell.improvise_share !== null ? ` imp=${cell.improvise_share.toFixed(2)}` : "";
    const drc = cell.decision_record_completeness !== null ? ` drc=${cell.decision_record_completeness.toFixed(2)}` : "";
    const rc = cell.recommend_coverage !== null ? ` rcov=${cell.recommend_coverage.toFixed(2)}` : "";
    const fp = cell.floor_status === "gated_on_phase_22" ? " [gated]" : (cell.floor_pass ? " ✅" : cell.sample_count >= 3 ? " ❌" : " (n<3)");
    console.log(`  ${cellId.padEnd(22)} n=${cell.sample_count} ${sr}${re}${is_}${drc}${rc}${fp}`);
  }
  console.log(`\nReport written to: ${reportPath}`);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
