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
import { outputsAgree, diffOutputs } from "./lib/output-normalizers.ts";
import { computeContaminationDelta } from "./lib/contamination-delta.ts";

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
  // G6.3.2: fraction of goals with 2+ traces where witness comparison disagreed
  witness_disagreement: number | null;
  // G6.5.1: fraction of successful traces where validator-dispatch returned passed=false
  validator_false_negative_rate: number | null;
  // G6.4.1: fraction of oracle goals where harness success disagrees with oracle verdict
  oracle_disagreement_rate: number | null;
  // 25.6.1: unified multi-witness disagreement rate across all arms (diff-solve + trace + oracle)
  multi_witness_disagreement_rate: number | null;
  floor_pass: boolean;
  floor_status?: string;
  // Recommendation-quality sub-metrics (from recommend calls)
  recommend_coverage: number | null;  // fraction of goals with ≥1 recommended activity
  recommend_shape_match: number | null; // fraction of recommendations covering expected_output_shapes
}

interface CoverageMatrix {
  [cellId: string]: CellMetrics;
}

// G6.3.2: witness entry comparing two trace outputs for the same goal.
interface WitnessEntry {
  trace_a_id: string;
  trace_b_id: string;
  shape: string;      // "output_shapes" or a specific shape name
  agreed: boolean;
  diff: Record<string, unknown> | null;
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
  authHeaders: Record<string, string>,
  excludeVariant?: string
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
        ...(excludeVariant ? { exclude_variant: excludeVariant } : {}),
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
// G6.4.1: Oracle label fetch
// ---------------------------------------------------------------------------

interface OracleLabel {
  id: string;
  goal: string;
  execution_id: string;
  activity_id: string;
  verdict: "pass" | "fail" | string;
  confidence: number;
  notes?: string;
}

async function fetchOracleLabel(
  labelId: string,
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<OracleLabel | null> {
  try {
    const resp = await fetch(
      `${endpoint}/v2/impulses/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          pointer: { type: "preValidationResult", id: labelId },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!resp.ok) return null;
    const body = await resp.json() as { data?: OracleLabel; result?: OracleLabel };
    return body.data ?? body.result ?? null;
  } catch {
    return null;
  }
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
  // G6.5.1: true if trace succeeded but a validator-dispatch task produced passed=false
  validator_false_negative: boolean;
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

// G6.5.1: detect validator_false_negative — trace succeeded but validator task
// recorded a failure_mode (meaning validator-dispatch found issues post-hoc).
function detectValidatorFalseNegative(trace: ExecutionTrace): boolean {
  const success = trace.status === "success" || trace.status === "completed";
  if (!success) return false;
  const tasks = trace.tasks ?? [];
  return tasks.some(
    (t) =>
      (t.resolver_id?.includes("validator") || t.activity_id?.includes("validator")) &&
      t.failure_mode != null
  );
}

function scoreTrace(trace: ExecutionTrace, thompsonPoolIds: Set<string>): TraceScores {
  const success = trace.status === "success" || trace.status === "completed";
  const cost_usd = typeof trace.cost_usd === "number" ? trace.cost_usd : null;
  const taskScores = scoreTasks(trace.tasks ?? [], thompsonPoolIds, trace);
  const validator_false_negative = detectValidatorFalseNegative(trace);
  return { success, cost_usd, ...taskScores, validator_false_negative };
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
    validator_false_negative_rate: null,
    oracle_disagreement_rate: null,
    multi_witness_disagreement_rate: null,
    floor_pass: false,
    recommend_coverage: null,
    recommend_shape_match: null,
  };
}

// Per-cell floor thresholds (from design §B)
const FLOORS = {
  success_rate: 0.30,
  reuse_efficiency: 0.40,           // only when sample_count ≥ 3 and depth ≥ 1
  decision_record_completeness: 0.90,
  witness_disagreement_max: 0.15,
  multi_witness_disagreement_max: 0.10, // 25.6.x: A/B scenarios only
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

  // 25.6.x: multi-witness disagreement floor for A/B scenarios only (not C/D gap cells)
  const isScenarioAB = !cellId.includes("C∪D") && !cellId.includes("gapD");
  if (isScenarioAB && cell.multi_witness_disagreement_rate !== null &&
    cell.multi_witness_disagreement_rate > FLOORS.multi_witness_disagreement_max) return false;

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
// G7.1.1: Extracted goal-loop for held-out + rolling-pool dual execution
// ---------------------------------------------------------------------------

type MatrixOutput = Record<string, Omit<CellMetrics, "cost_usd_samples" | "reuse_efficiency_samples" | "improvise_share_samples" | "decision_record_completeness_samples">>;

function stripSampleArrays(matrix: CoverageMatrix): MatrixOutput {
  const out: MatrixOutput = {};
  for (const [cellId, cell] of Object.entries(matrix)) {
    const { cost_usd_samples, reuse_efficiency_samples, improvise_share_samples, decision_record_completeness_samples, ...rest } = cell;
    out[cellId] = rest;
  }
  return out;
}


// G6.2.1: differential-solve witness — compares top-rec from primary run vs alt run.
interface DifferentialWitness {
  primary_top_id: string;     // top rec from first call (no exclusion)
  alt_top_id: string | null;  // top rec from second call (primary excluded)
  diverged: boolean;          // alt_top_id !== primary_top_id
}

interface PerGoalResult {
  goal_id: string;
  cell_id: string;
  recommend_count: number;
  recommend_shape_match: boolean;
  trace_count: number;
  scores: TraceScores[];
  witnesses: WitnessEntry[];
  differential?: DifferentialWitness;     // G6.2.1: present for goals with ≥1 recommendation
  oracle_disagree?: boolean;              // G6.4.1: present only for oracle goals
  oracle_label_id?: string;
  oracle_verdict?: "pass" | "fail";
  // 25.6.1: multi-witness aggregates
  witness_pair_count: number;             // total witness pairs evaluated (diff + trace + oracle)
  witness_disagree_count: number;         // pairs that disagreed
  low_confidence_success: boolean;        // any witness disagreement on a goal that scored success
}

interface LoopResult {
  matrix: CoverageMatrix;
  rawCellCosts: Record<string, number[]>;
  perGoalResults: PerGoalResult[];
  refinementEvents: RefinementEvent[];
  optimalityRatios: Record<string, number | null>;
  apiCallCount: number;
  universality_pass: boolean | null;
}

async function runGoalLoop(
  goals: GeneratedGoal[],
  opts: {
    endpoint: string;
    authHeaders: Record<string, string>;
    priorReport: PriorReport | null;
    thompsonPoolIds: Set<string>;
    shortestPaths: ShortestPathCache;
    budgetCap?: number;
  }
): Promise<LoopResult> {
  const { endpoint, authHeaders, priorReport, thompsonPoolIds, shortestPaths } = opts;
  const BUDGET_CAP = opts.budgetCap ?? 200;

  const matrix: CoverageMatrix = {};
  const rawCellCosts: Record<string, number[]> = {};
  const perGoalResults: PerGoalResult[] = [];
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
          const chain = trace.composition_chain ?? (trace.activity_id ? [trace.activity_id] : []);
          updateShortestPathCache(shortestPaths, cellId, score.cost_usd, chain);
        }
      }
      if (score.reuse_efficiency !== null) cell.reuse_efficiency_samples.push(score.reuse_efficiency);
      if (score.improvise_share !== null) cell.improvise_share_samples.push(score.improvise_share);
      if (score.decision_record_completeness !== null)
        cell.decision_record_completeness_samples.push(score.decision_record_completeness);
    }

    // Scenario D gating
    if (cellId.includes("C∪D") || goal.scenario === "C∪D" || goal.topology_gap_band === "D") {
      cell.floor_status = "gated_on_phase_22";
    }

    // G6.3.2: witness comparison
    const witnesses: WitnessEntry[] = [];
    if (traces.length >= 2) {
      const ta = traces[0];
      const tb = traces[1];
      const shapesA = [...(ta.output_shapes ?? [])].sort();
      const shapesB = [...(tb.output_shapes ?? [])].sort();
      const agreed = outputsAgree("output_shapes", shapesA, shapesB);
      witnesses.push({
        trace_a_id: ta.id ?? "unknown",
        trace_b_id: tb.id ?? "unknown",
        shape: "output_shapes",
        agreed,
        diff: agreed ? null : (diffOutputs("output_shapes", shapesA, shapesB) ?? null),
      });
    }

    // G6.2.1 / 25.6.1: differential-solve — run for ALL goals with ≥1 recommendation.
    // Re-runs recommend with the primary top choice excluded to surface next-best divergence.
    let differential: DifferentialWitness | undefined;
    if (recs.length > 0) {
      const primaryTopId = recs[0].id ?? recs[0].template_id ?? recs[0].activity_id ?? "";
      if (primaryTopId) {
        const altRecs = await runRecommendation(goal, endpoint, authHeaders, primaryTopId);
        apiCallCount++;
        const altTopId = altRecs[0]?.id ?? altRecs[0]?.template_id ?? altRecs[0]?.activity_id ?? null;
        differential = {
          primary_top_id: primaryTopId,
          alt_top_id: altTopId,
          diverged: altTopId !== null && altTopId !== primaryTopId,
        };
      }
    }

    // G6.4.1: oracle arm — compare harness success assessment vs oracle verdict
    let oracleFields: Pick<PerGoalResult, "oracle_disagree" | "oracle_label_id" | "oracle_verdict"> = {};
    const oracleLabelId = (goal as GeneratedGoal).oracle_label_id;
    const embeddedVerdict = (goal as GeneratedGoal).oracle_verdict;
    if (oracleLabelId) {
      let verdict: "pass" | "fail" | null = embeddedVerdict ?? null;
      if (!verdict) {
        // Attempt API fetch when no embedded verdict
        const oracleLabel = await fetchOracleLabel(oracleLabelId, endpoint, authHeaders);
        apiCallCount++;
        verdict = (oracleLabel?.verdict as "pass" | "fail") ?? null;
      }
      if (verdict) {
        const harnessPass = traceScores.some((s) => s.success);
        const oraclePass = verdict === "pass";
        oracleFields = {
          oracle_label_id: oracleLabelId,
          oracle_verdict: verdict,
          oracle_disagree: harnessPass !== oraclePass,
        };
      }
    }

    // 25.6.1: compute per-goal multi-witness pair totals
    let witnessPairCount = 0;
    let witnessDisagreeCount = 0;
    if (differential) {
      witnessPairCount++;
      if (differential.diverged) witnessDisagreeCount++;
    }
    if (witnesses.length > 0) {
      witnessPairCount += witnesses.length;
      witnessDisagreeCount += witnesses.filter((w) => !w.agreed).length;
    }
    if (oracleFields.oracle_disagree !== undefined) {
      witnessPairCount++;
      if (oracleFields.oracle_disagree) witnessDisagreeCount++;
    }
    // validator FN counts as a disagreement pair if any successful trace had validator flag it
    const validatorFalseNeg = traceScores.some((s) => s.validator_false_negative);
    if (traceScores.some((s) => s.success)) {
      witnessPairCount++;
      if (validatorFalseNeg) witnessDisagreeCount++;
    }
    const goalHarnessSuccess = traceScores.some((s) => s.success);
    const lowConfidenceSuccess = goalHarnessSuccess && witnessDisagreeCount > 0;

    perGoalResults.push({
      goal_id: goal.id,
      cell_id: cellId,
      recommend_count: recs.length,
      recommend_shape_match: hasShapeMatch,
      trace_count: traces.length,
      scores: traceScores,
      witnesses,
      ...(differential ? { differential } : {}),
      ...oracleFields,
      witness_pair_count: witnessPairCount,
      witness_disagree_count: witnessDisagreeCount,
      low_confidence_success: lowConfidenceSuccess,
    });

    process.stdout.write(
      `recs=${recs.length} shape_match=${hasShapeMatch ? "✓" : "✗"} traces=${traces.length}\n`
    );
  }

  // Finalize cells
  for (const [cellId, cell] of Object.entries(matrix)) {
    const goalResults = perGoalResults.filter((r) => r.cell_id === cellId);
    cell.recommend_coverage =
      goalResults.length > 0
        ? goalResults.filter((r) => r.recommend_count > 0).length / goalResults.length
        : null;
    cell.recommend_shape_match =
      goalResults.length > 0
        ? goalResults.filter((r) => r.recommend_shape_match).length / goalResults.length
        : null;
    const goalsWithWitnesses = goalResults.filter((r) => r.witnesses.length > 0);
    cell.witness_disagreement =
      goalsWithWitnesses.length > 0
        ? goalsWithWitnesses.filter((r) => r.witnesses.some((w) => !w.agreed)).length /
          goalsWithWitnesses.length
        : null;
    // G6.5.1: validator false-negative rate — successful traces with validator passed=false
    const successScores = goalResults.flatMap((r) => r.scores.filter((s) => s.success));
    cell.validator_false_negative_rate =
      successScores.length > 0
        ? successScores.filter((s) => s.validator_false_negative).length / successScores.length
        : null;
    // G6.4.1: oracle disagreement rate
    const oracleGoals = goalResults.filter((r) => r.oracle_disagree !== undefined);
    cell.oracle_disagreement_rate =
      oracleGoals.length > 0
        ? oracleGoals.filter((r) => r.oracle_disagree).length / oracleGoals.length
        : null;
    // 25.6.1: multi-witness disagreement rate — aggregate across all arms
    const totalPairs = goalResults.reduce((s, r) => s + r.witness_pair_count, 0);
    const totalDisagree = goalResults.reduce((s, r) => s + r.witness_disagree_count, 0);
    cell.multi_witness_disagreement_rate = totalPairs > 0 ? totalDisagree / totalPairs : null;
    finalizeCell(cell, cellId);
  }

  const refinementEvents = detectRefinementEvents(matrix, priorReport);
  const optimalityRatios = computeOptimalityRatios(rawCellCosts, shortestPaths);

  const passableCells = Object.entries(matrix).filter(
    ([, c]) => c.sample_count >= 3 && c.floor_status !== "gated_on_phase_22"
  );
  const universality_pass =
    passableCells.length === 0
      ? null
      : passableCells.every(([, c]) => c.floor_pass);

  return { matrix, rawCellCosts, perGoalResults, refinementEvents, optimalityRatios, apiCallCount, universality_pass };
}

// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      goals: { type: "string" },
      "held-out": { type: "boolean", default: false },
      baseline: { type: "string", default: "" },
      label: { type: "string", default: "" },
      detailed: { type: "boolean", default: false },
      // G6.4.1: path to oracle seeds JSON file (array of GeneratedGoal with oracle_label_id + oracle_verdict)
      "oracle-seeds": { type: "string", default: "" },
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
  let goals: GeneratedGoal[] = goalsFile.goals;

  // G6.4.1: append oracle seeds if provided
  if (values["oracle-seeds"]) {
    const seedsPath = resolvePath(values["oracle-seeds"]);
    if (existsSync(seedsPath)) {
      const oracleSeeds = JSON.parse(await readFile(seedsPath, "utf8")) as GeneratedGoal[];
      goals = [...goals, ...oracleSeeds];
      console.log(`  oracle seeds: ${oracleSeeds.length} goals appended from ${seedsPath}`);
    } else {
      console.warn(`  oracle seeds file not found: ${seedsPath} (skipping)`);
    }
  }

  console.log(`\nStratified Harness — Phase 25.6`);
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

  const loopOpts = { endpoint, authHeaders, priorReport, thompsonPoolIds, shortestPaths };

  // G7.1.1: If --held-out, run held-out suite first and emit held-out report.
  const isHeldOut = values["held-out"] === true;
  let heldOutLoopResult: LoopResult | null = null;

  if (isHeldOut) {
    // Auto-detect held-out goals file: most recent *-held-out-goals.json in generated/
    const generatedDir = join(repoRoot, "validation", "generated");
    const { readdir } = await import("node:fs/promises");
    const allFiles = (await readdir(generatedDir).catch(() => [])) as string[];
    const heldOutFiles = allFiles
      .filter((f) => f.endsWith("-held-out-goals.json"))
      .sort()
      .reverse();
    if (heldOutFiles.length === 0) {
      console.warn("  --held-out: no held-out goals file found in validation/generated/. Run goal-generator --held-out first.");
    } else {
      const heldOutPath = join(generatedDir, heldOutFiles[0]);
      console.log(`\n  Held-out suite: ${heldOutPath}`);
      const heldOutFile = JSON.parse(await readFile(heldOutPath, "utf8")) as GeneratedGoalsFile;
      const heldOutGoals = heldOutFile.goals;

      heldOutLoopResult = await runGoalLoop(heldOutGoals, loopOpts);

      // Build held-out report (G7.1.2)
      const heldOutMatrixOutput = stripSampleArrays(heldOutLoopResult.matrix);
      const heldOutReport = {
        harness_version: "25.6",
        suite: "held_out",
        run_at: new Date().toISOString(),
        label: values["label"] || undefined,
        goals_file: heldOutPath,
        generator_seed: heldOutFile.generator_seed,
        shape_registry_snapshot_hash: heldOutFile.shape_registry_snapshot_hash,
        endpoint,
        thompson_pool_size: thompsonPoolIds.size,
        goals_processed: heldOutLoopResult.perGoalResults.length,
        api_call_count: heldOutLoopResult.apiCallCount,
        universality_pass: heldOutLoopResult.universality_pass,
        cell_count: Object.keys(heldOutLoopResult.matrix).length,
        coverage_matrix: heldOutMatrixOutput,
        optimality_ratios: heldOutLoopResult.optimalityRatios,
        refinement_event_count: heldOutLoopResult.refinementEvents.length,
        refinement_event_density:
          heldOutLoopResult.perGoalResults.length > 0
            ? heldOutLoopResult.refinementEvents.length / heldOutLoopResult.perGoalResults.length
            : 0,
        // G6.2.1 / 25.6.1: differential-solve + multi-witness summary for held-out suite
        differential_witness_count: heldOutLoopResult.perGoalResults.filter((r) => r.differential).length,
        multi_witness_total_pairs: heldOutLoopResult.perGoalResults.reduce((s, r) => s + r.witness_pair_count, 0),
        multi_witness_disagree_count: heldOutLoopResult.perGoalResults.reduce((s, r) => s + r.witness_disagree_count, 0),
        multi_witness_disagreement_rate: (() => {
          const pairs = heldOutLoopResult.perGoalResults.reduce((s, r) => s + r.witness_pair_count, 0);
          const dis = heldOutLoopResult.perGoalResults.reduce((s, r) => s + r.witness_disagree_count, 0);
          return pairs > 0 ? dis / pairs : null;
        })(),
        low_confidence_success_count: heldOutLoopResult.perGoalResults.filter((r) => r.low_confidence_success).length,
        ...(values["detailed"] ? { per_goal_results: heldOutLoopResult.perGoalResults } : {}),
      };
      const resultsDir = join(repoRoot, "validation", "results");
      await mkdir(resultsDir, { recursive: true });
      const dateStr = new Date().toISOString().slice(0, 10);
      const heldOutReportPath = join(resultsDir, `${dateStr}-held-out-report.json`);
      await writeFile(heldOutReportPath, JSON.stringify(heldOutReport, null, 2), "utf8");
      console.log(`  Held-out report written to: ${heldOutReportPath}`);
    }
  }

  // Main (rolling-pool) suite
  const loopResult = await runGoalLoop(goals, loopOpts);
  const { matrix, rawCellCosts, perGoalResults, refinementEvents, optimalityRatios, apiCallCount, universality_pass } = loopResult;

  // Save shortest-path cache
  await saveShortestPathCache(statePath, shortestPaths);

  // Build report
  const matrixOutput = stripSampleArrays(matrix);
  const passableCells = Object.entries(matrix).filter(
    ([, c]) => c.sample_count >= 3 && c.floor_status !== "gated_on_phase_22"
  );
  const report = {
    harness_version: "25.6",
    suite: "rolling_pool",
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
    // G6.2.1: differential-solve summary
    differential_witness_count: perGoalResults.filter((r) => r.differential).length,
    differential_diverge_rate: (() => {
      const withDiff = perGoalResults.filter((r) => r.differential);
      return withDiff.length > 0
        ? withDiff.filter((r) => r.differential!.diverged).length / withDiff.length
        : null;
    })(),
    // G6.4.1: oracle arm summary
    oracle_goal_count: perGoalResults.filter((r) => r.oracle_disagree !== undefined).length,
    oracle_disagreement_rate: (() => {
      const withOracle = perGoalResults.filter((r) => r.oracle_disagree !== undefined);
      return withOracle.length > 0
        ? withOracle.filter((r) => r.oracle_disagree).length / withOracle.length
        : null;
    })(),
    // 25.6.1: multi-witness disagreement — aggregated across all arms
    multi_witness_total_pairs: perGoalResults.reduce((s, r) => s + r.witness_pair_count, 0),
    multi_witness_disagree_count: perGoalResults.reduce((s, r) => s + r.witness_disagree_count, 0),
    multi_witness_disagreement_rate: (() => {
      const pairs = perGoalResults.reduce((s, r) => s + r.witness_pair_count, 0);
      const dis = perGoalResults.reduce((s, r) => s + r.witness_disagree_count, 0);
      return pairs > 0 ? dis / pairs : null;
    })(),
    low_confidence_success_count: perGoalResults.filter((r) => r.low_confidence_success).length,
    // G7.2.1/G7.2.2: contamination check (only when held-out suite was run)
    ...(heldOutLoopResult
      ? computeContaminationDelta(matrix, heldOutLoopResult.matrix)
      : {}),
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
  const diffCount = perGoalResults.filter((r) => r.differential).length;
  const diffDiverged = perGoalResults.filter((r) => r.differential?.diverged).length;
  const totalPairsAll = perGoalResults.reduce((s, r) => s + r.witness_pair_count, 0);
  const totalDisagreeAll = perGoalResults.reduce((s, r) => s + r.witness_disagree_count, 0);
  const mwdr = totalPairsAll > 0 ? (totalDisagreeAll / totalPairsAll).toFixed(3) : "n/a";
  const lcCount = perGoalResults.filter((r) => r.low_confidence_success).length;
  console.log(`  Cells populated   : ${Object.keys(matrix).length}`);
  console.log(`  Passable cells    : ${passableCells.length}`);
  console.log(`  Universality pass : ${universality_pass === null ? "N/A (no cells w/ n≥3)" : universality_pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Refinement events : ${refinementEvents.length}`);
  console.log(`  Diff-solve pairs  : ${diffCount} (${diffDiverged} diverged)`);
  console.log(`  Multi-witness     : ${totalPairsAll} pairs, ${totalDisagreeAll} disagree, rate=${mwdr} (goal: <0.10)`);
  console.log(`  Low-conf success  : ${lcCount} goals`);
  console.log(`  API calls         : ${apiCallCount}`);
  console.log(`\nPer-cell summary:`);
  for (const [cellId, cell] of Object.entries(matrixOutput)) {
    const sr = cell.success_rate !== null ? `sr=${cell.success_rate.toFixed(2)}` : "sr=?";
    const re = cell.reuse_efficiency !== null ? ` re=${cell.reuse_efficiency.toFixed(2)}` : "";
    const is_ = cell.improvise_share !== null ? ` imp=${cell.improvise_share.toFixed(2)}` : "";
    const drc = cell.decision_record_completeness !== null ? ` drc=${cell.decision_record_completeness.toFixed(2)}` : "";
    const rc = cell.recommend_coverage !== null ? ` rcov=${cell.recommend_coverage.toFixed(2)}` : "";
    const mw = cell.multi_witness_disagreement_rate !== null ? ` mw=${cell.multi_witness_disagreement_rate.toFixed(2)}` : "";
    const fp = cell.floor_status === "gated_on_phase_22" ? " [gated]" : (cell.floor_pass ? " ✅" : cell.sample_count >= 3 ? " ❌" : " (n<3)");
    console.log(`  ${cellId.padEnd(22)} n=${cell.sample_count} ${sr}${re}${is_}${drc}${rc}${mw}${fp}`);
  }
  console.log(`\nReport written to: ${reportPath}`);
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
