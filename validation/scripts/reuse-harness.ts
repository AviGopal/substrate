#!/usr/bin/env bun
/**
 * reuse-harness.ts — Phase 18.2 MRR validation harness for activity recommendation quality.
 *
 * Usage:
 *   bun run validation/scripts/reuse-harness.ts [--baseline <date>] [--limit <n>] [--label <text>] [--detailed]
 *
 * Reads METABOB_ENDPOINT and METABOB_API_KEY from environment (or ~/.metabob/config.json).
 * Runs each benchmark entry through POST /v2/activities/recommend and measures MRR.
 * Emits a dated JSON report to validation/results/{ISO_DATE}-reuse-report.json.
 *
 * Cost proxy: aborts after 100 API calls (~$5 budget cap).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenchmarkEntry {
  id: string;
  category: string;
  goal_text: string;
  expected_activity_id: string;
  expected_activity_name?: string;
  search_query?: string;
  tags?: string[];
  seed_impulse_pool: string[];
}

interface SelectionMetadata {
  method?: string;
  score_source?: string;
  alpha?: number;
  beta?: number;
  sample?: number;
  score?: number;
  exploration_slot?: boolean;
  sample_count?: number;
}

interface Recommendation {
  id?: string;
  template_id?: string;
  activity_id?: string;
  name?: string;
  template_name?: string;
  activity_name?: string;
  category?: string;
  tags?: string[];
  input_shapes?: string[];
  output_shapes?: string[];
  selection_metadata?: SelectionMetadata;
}

interface RecommendResponse {
  recommendations?: Recommendation[];
}

interface ExecutionTrace {
  id?: string;
  execution_id?: string;
  activity_id?: string;
  variant_id?: string;
  activity_name?: string;
  success?: boolean;
  goal?: string;
  created_at?: string;
  composition_chain?: string[];
  parent_execution_id?: string;
}

interface FullTaskRecord {
  id?: string;
  resolver_id?: string;
  resolver_tier?: string;
  resolver?: string;
}

interface FullTrace {
  id?: string;
  execution_id?: string;
  activity_id?: string;
  success?: boolean;
  tasks?: FullTaskRecord[];
  composition_chain?: string[];
  parent_execution_id?: string;
}

interface TracesResponse {
  traces?: ExecutionTrace[];
  data?: ExecutionTrace[];
  executions?: ExecutionTrace[];
}

interface FullTraceResponse {
  trace?: FullTrace;
  data?: FullTrace;
  execution?: FullTrace;
}

interface TemplateResponse {
  template?: {
    id?: string;
    output_shapes?: string[];
    tasks?: Array<{ resolver?: string; resolver_tier?: string }>;
  };
  data?: {
    id?: string;
    output_shapes?: string[];
    tasks?: Array<{ resolver?: string; resolver_tier?: string }>;
  };
  id?: string;
  output_shapes?: string[];
  tasks?: Array<{ resolver?: string; resolver_tier?: string }>;
}

interface EntryResult {
  id: string;
  category: string;
  rank: number;
  rr: number;
  found: boolean;
  goal_text?: string;
  expected_activity_id?: string;
  search_rank?: number;
  search_rr?: number;
  search_found?: boolean;
  diagnostic?: "A" | "B" | "C" | "D" | null;
  executability_score?: number;
}

interface ThompsonEntry {
  activity_id: string;
  name: string;
  alpha: number;
  beta: number;
  ev: number;
  total_executions: number;
  ci_width: number;
}

interface TraceStats {
  sample_size: number;
  improvise_count: number;
  improvise_rate: number;
  window_days: number;
}

interface ImproviseHealth {
  total_improvise: number;
  success_rate: number | null;
  ribosome_activation_rate: number | null;
}

interface ResolverCoverage {
  sampled_traces: number;
  llm_tier_rate: number;
  deterministic_rate: number;
  pattern_rate: number;
  top_resolvers: Array<{ resolver_id: string; count: number }>;
}

interface ReuseTrajectory {
  reuse_rate: number;
  composition_depth_distribution: { d0: number; d1: number; d2: number; d3plus: number };
  mean_composition_depth: number;
}

interface DiscriminationReport {
  total_conditional_rows: number;
  total_templates_with_rows: number;
  templates_with_sufficient_obs: number;
  discriminating_templates: number;
  discriminating_fraction: number;
  top_discriminating: Array<{
    template_id: string;
    bucket_a: { context_bucket: string; alpha: number; beta: number; n_obs: number; mean: number };
    bucket_b: { context_bucket: string; alpha: number; beta: number; n_obs: number; mean: number };
    t_stat: number;
    p_value: number;
  }>;
}

// Aggregate audit summary for the test-audit loop (OpenSpec
// 2026-05-18-test-audit-loop Phase G). Populated by the weekly harness post-run
// by fetching test_audit_report rows for the trailing window and bucketing them
// by audit_subtype / caveat / pending-proposal count.
interface AuditSummary {
  /** Total test_audit_report rows fetched for the window. */
  total_audits: number;
  /** Reports that passed in aggregate. */
  passed: number;
  /** Reports that passed but carry one or more caveats (e.g. unregistered, missing_sensitivity_history). */
  passed_with_caveat: number;
  /** Reports that failed, bucketed by `failed_evidence.audit_subtype`. */
  failed_by_subtype: Record<string, number>;
  /** Caveat distribution across passing reports. */
  caveats: Record<string, number>;
  /** Open (non-superseded) code_modification_proposal rows. */
  open_proposals: number;
  /** ISO timestamp of the trailing window start used for the query. */
  window_start: string;
}

interface ReuseReport {
  run_at: string;
  label: string;
  mrr: number;
  recommend_mrr?: number;
  hit_at_1: number;
  hit_at_3: number;
  hit_at_5: number;
  search_mrr?: number;
  search_hit_at_1?: number;
  search_hit_at_3?: number;
  search_hit_at_5?: number;
  quadrant_counts?: { A: number; B: number; C: number; D: number };
  entries: EntryResult[];
  thompson_snapshot: ThompsonEntry[];
  trace_stats: TraceStats;
  improvise_health?: ImproviseHealth;
  resolver_coverage?: ResolverCoverage;
  reuse_trajectory?: ReuseTrajectory;
  discrimination_report?: DiscriminationReport;
  audit_summary?: AuditSummary;
}

// ---------------------------------------------------------------------------
// Config loading (mirrors thompson-compare.ts)
// ---------------------------------------------------------------------------

async function loadConfig(): Promise<{ endpoint: string; apiKey: string }> {
  const envEndpoint = process.env.METABOB_ENDPOINT;
  const envKey = process.env.METABOB_API_KEY;

  const configPath = join(homedir(), ".metabob", "config.json");
  if (existsSync(configPath)) {
    const raw = JSON.parse(await readFile(configPath, "utf8")) as {
      metabob?: { endpoint?: string; apiKey?: string };
    };
    const endpoint = envEndpoint ?? raw.metabob?.endpoint;
    const apiKey = envKey ?? raw.metabob?.apiKey ?? "";
    if (!endpoint) throw new Error("endpoint not set. Set METABOB_ENDPOINT env or metabob.endpoint in ~/.metabob/config.json");
    if (apiKey) return { endpoint, apiKey };
  }
  if (envEndpoint && envKey) return { endpoint: envEndpoint, apiKey: envKey };
  if (envEndpoint && !envKey) throw new Error("METABOB_API_KEY not set. Set via env var or ~/.metabob/config.json");
  throw new Error("endpoint not set. Set METABOB_ENDPOINT env or metabob.endpoint in ~/.metabob/config.json");
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

/**
 * CI width for a Beta(α,β) distribution using normal approximation:
 * ci_width = 2 * 1.96 * sqrt(α*β / ((α+β)^2 * (α+β+1)))
 */
function betaCiWidth(alpha: number, beta: number): number {
  const ab = alpha + beta;
  if (ab <= 0) return 1.0;
  const variance = (alpha * beta) / (ab * ab * (ab + 1));
  return 2 * 1.96 * Math.sqrt(variance);
}

function betaMean(alpha: number, beta: number): number {
  const ab = alpha + beta;
  if (ab <= 0) return 0.5;
  return alpha / ab;
}

function totalExecutions(alpha: number, beta: number): number {
  // Alpha starts at 1 (prior), increments on success. Beta starts at 1, increments on failure.
  // Total real executions ≈ (alpha - 1) + (beta - 1)
  return Math.max(0, (alpha - 1) + (beta - 1));
}

// ---------------------------------------------------------------------------
// Normalise recommendation id (handle both id / template_id / activity_id fields)
// ---------------------------------------------------------------------------

function recId(r: Recommendation): string {
  return r.id ?? r.template_id ?? r.activity_id ?? "";
}

// Normalize doubled-prefix IDs: activity:⟨activity:⟨slug⟩⟩ → activity:⟨slug⟩
// Also handles: activity:⟨activity:improvise⟩ → activity:improvise
// These doubled-prefix forms accumulate from legacy UPSERT paths and the
// canonical benchmark IDs use the unwrapped form.
function normalizeId(id: string): string {
  const m = id.match(/^activity:⟨(activity:[^⟩]*)⟩$/);
  return m ? m[1] : id;
}

function recName(r: Recommendation): string {
  return r.name ?? r.template_name ?? r.activity_name ?? "(unknown)";
}

function isImproviseId(id: string): boolean {
  return id.toLowerCase().includes("improvise");
}

// ---------------------------------------------------------------------------
// API helpers with call-count budget
// ---------------------------------------------------------------------------

let apiCallCount = 0;
const API_CALL_LIMIT = 100;

async function apiPost(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<unknown> {
  if (apiCallCount >= API_CALL_LIMIT) {
    throw new Error(`API call budget exhausted (${API_CALL_LIMIT} calls). Aborting to stay within $5 cost cap.`);
  }
  apiCallCount++;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`POST ${url}: ${resp.status} ${resp.statusText}\n${text.slice(0, 400)}`);
  }
  return resp.json();
}

async function apiGet(url: string, headers: Record<string, string>): Promise<unknown> {
  if (apiCallCount >= API_CALL_LIMIT) {
    throw new Error(`API call budget exhausted (${API_CALL_LIMIT} calls). Aborting to stay within $5 cost cap.`);
  }
  apiCallCount++;
  const resp = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GET ${url}: ${resp.status} ${resp.statusText}\n${text.slice(0, 400)}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Benchmark evaluation
// ---------------------------------------------------------------------------

async function evaluateBenchmark(
  entries: BenchmarkEntry[],
  endpoint: string,
  authHeaders: Record<string, string>,
  limit: number
): Promise<EntryResult[]> {
  const results: EntryResult[] = [];

  for (const entry of entries) {
    process.stdout.write(`  [${entry.id}] "${entry.goal_text.slice(0, 60)}..." `);

    let recommendations: Recommendation[] = [];
    try {
      const data = await apiPost(
        `${endpoint}/v2/activities/recommend`,
        authHeaders,
        { task_description: entry.goal_text, limit }
      ) as RecommendResponse;
      recommendations = data.recommendations ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("budget exhausted")) throw err;
      console.log(`ERROR: ${msg.slice(0, 80)}`);
      results.push({ id: entry.id, category: entry.category, rank: 0, rr: 0, found: false });
      continue;
    }

    // Find rank of expected activity (1-indexed)
    let rank = 0;
    for (let i = 0; i < recommendations.length; i++) {
      if (normalizeId(recId(recommendations[i])) === normalizeId(entry.expected_activity_id)) {
        rank = i + 1;
        break;
      }
    }

    const rr = rank > 0 ? 1 / rank : 0;
    const found = rank > 0;

    if (found) {
      process.stdout.write(`rank=${rank} rr=${rr.toFixed(3)}\n`);
    } else {
      process.stdout.write(`not found in top-${limit}\n`);
    }

    results.push({ id: entry.id, category: entry.category, rank, rr, found });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Search benchmark evaluation — pure FTS via GET /v2/activities/templates?q=
// ---------------------------------------------------------------------------

interface SearchTemplate {
  id?: string;
  name?: string;
}

interface SearchResponse {
  templates?: SearchTemplate[];
  data?: SearchTemplate[];
}

async function evaluateSearchBenchmark(
  entries: BenchmarkEntry[],
  endpoint: string,
  authHeaders: Record<string, string>,
  limit: number
): Promise<EntryResult[]> {
  const results: EntryResult[] = [];

  for (const entry of entries) {
    if (!entry.search_query) {
      results.push({ id: entry.id, category: entry.category, rank: 0, rr: 0, found: false,
        search_rank: 0, search_rr: 0, search_found: false });
      continue;
    }

    process.stdout.write(`  [${entry.id}] search "${entry.search_query}" ... `);

    let templates: SearchTemplate[] = [];
    try {
      const url = `${endpoint}/v2/activities/templates?q=${encodeURIComponent(entry.search_query)}&limit=${limit}`;
      const data = await apiGet(url, authHeaders) as SearchResponse;
      templates = data.templates ?? data.data ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("budget exhausted")) throw err;
      console.log(`ERROR: ${msg.slice(0, 80)}`);
      results.push({ id: entry.id, category: entry.category, rank: 0, rr: 0, found: false,
        search_rank: 0, search_rr: 0, search_found: false });
      continue;
    }

    let search_rank = 0;
    for (let i = 0; i < templates.length; i++) {
      if (normalizeId(templates[i].id ?? "") === normalizeId(entry.expected_activity_id)) {
        search_rank = i + 1;
        break;
      }
    }

    const search_rr = search_rank > 0 ? 1 / search_rank : 0;
    const search_found = search_rank > 0;

    if (search_found) {
      process.stdout.write(`rank=${search_rank} rr=${search_rr.toFixed(3)}\n`);
    } else {
      process.stdout.write(`not found in top-${limit}\n`);
    }

    results.push({ id: entry.id, category: entry.category, rank: 0, rr: 0, found: false,
      search_rank, search_rr, search_found });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Thompson snapshot: broad query for top-50
// ---------------------------------------------------------------------------

async function captureThompsonSnapshot(
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<ThompsonEntry[]> {
  const broadQueries = [
    "fix bug",
    "add feature",
    "refactor code",
    "audit activity templates",
    "verify system health",
  ];

  const seen = new Map<string, ThompsonEntry>();

  for (const q of broadQueries) {
    if (seen.size >= 50) break;
    let data: RecommendResponse;
    try {
      data = await apiPost(
        `${endpoint}/v2/activities/recommend`,
        authHeaders,
        { task_description: q, limit: 20 }
      ) as RecommendResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("budget exhausted")) throw err;
      console.warn(`  Thompson snapshot query failed for "${q}": ${msg.slice(0, 80)}`);
      continue;
    }

    for (const r of data.recommendations ?? []) {
      const id = recId(r);
      if (!id || seen.has(id)) continue;
      const sm = r.selection_metadata ?? {};
      const alpha = sm.alpha ?? 1;
      const beta = sm.beta ?? 1;
      seen.set(id, {
        activity_id: id,
        name: recName(r),
        alpha,
        beta,
        ev: betaMean(alpha, beta),
        total_executions: sm.sample_count ?? totalExecutions(alpha, beta),
        ci_width: betaCiWidth(alpha, beta),
      });
    }
  }

  // Sort by EV descending
  return Array.from(seen.values())
    .sort((a, b) => b.ev - a.ev)
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// Trace stats: 7-day improvise share
// ---------------------------------------------------------------------------

async function captureTraceStats(
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<{ stats: TraceStats; rawTraces: ExecutionTrace[] }> {
  let traces: ExecutionTrace[] = [];
  try {
    const data = await apiGet(
      `${endpoint}/v2/activities/execution-traces?limit=200`,
      authHeaders
    ) as TracesResponse;
    traces = data.traces ?? data.data ?? data.executions ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) throw err;
    console.warn(`  Trace stats query failed: ${msg.slice(0, 80)}`);
    return {
      stats: { sample_size: 0, improvise_count: 0, improvise_rate: 0, window_days: 7 },
      rawTraces: [],
    };
  }

  // Filter to last 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = traces.filter((t) => {
    if (!t.created_at) return true; // include if no date
    return new Date(t.created_at) >= cutoff;
  });

  const improviseCount = recent.filter((t) => {
    const id = (t.activity_id ?? "").toLowerCase();
    const name = (t.activity_name ?? "").toLowerCase();
    return id.includes("improvise") || name.includes("improvise");
  }).length;

  return {
    stats: {
      sample_size: recent.length,
      improvise_count: improviseCount,
      improvise_rate: recent.length > 0 ? improviseCount / recent.length : 0,
      window_days: 7,
    },
    rawTraces: recent,
  };
}

// ---------------------------------------------------------------------------
// T4.1: Improvise health
// ---------------------------------------------------------------------------

async function captureImproviseHealth(
  endpoint: string,
  authHeaders: Record<string, string>,
  windowTraces: ExecutionTrace[]
): Promise<ImproviseHealth> {
  const improviseTraces = windowTraces.filter((t) => {
    const aid = (t.activity_id ?? "").toLowerCase();
    const vid = (t.variant_id ?? "").toLowerCase();
    return aid.includes("improvise") || vid.includes("improvise");
  });

  if (improviseTraces.length === 0) {
    return { total_improvise: 0, success_rate: null, ribosome_activation_rate: null };
  }

  const successCount = improviseTraces.filter((t) => t.success === true).length;
  const success_rate = successCount / improviseTraces.length;

  // Check if any trace has parent_execution_id pointing to an improvise trace AND
  // its own activity_id contains "ribosome" or "extract". Batch: check up to 5 improvise
  // execution_ids by scanning windowTraces first (free), then fall back to extra API calls.
  const improviseExecIds = new Set(
    improviseTraces
      .map((t) => t.execution_id ?? t.id)
      .filter((id): id is string => !!id)
  );

  // Scan window traces for ribosome/extract children — zero extra calls if present
  let ribosomeActivations = windowTraces.filter((t) => {
    const parentId = t.parent_execution_id;
    if (!parentId || !improviseExecIds.has(parentId)) return false;
    const aid = (t.activity_id ?? "").toLowerCase();
    return aid.includes("ribosome") || aid.includes("extract");
  }).length;

  // Up to 5 extra API calls: fetch neighbouring pages to find ribosome children not in window
  const checkedIds = new Set<string>();
  let extraCalls = 0;
  for (const execId of improviseExecIds) {
    if (extraCalls >= 5 || apiCallCount >= API_CALL_LIMIT - 20) break;
    checkedIds.add(execId);
    try {
      const data = await apiGet(
        `${endpoint}/v2/activities/execution-traces?parent_execution_id=${encodeURIComponent(execId)}&limit=10`,
        authHeaders
      ) as TracesResponse;
      extraCalls++;
      const children = data.traces ?? data.data ?? data.executions ?? [];
      const hasRibosome = children.some((c) => {
        const aid = (c.activity_id ?? "").toLowerCase();
        return aid.includes("ribosome") || aid.includes("extract");
      });
      if (hasRibosome) ribosomeActivations++;
    } catch {
      // non-fatal; partial result is still useful
    }
  }

  const ribosome_activation_rate = ribosomeActivations / improviseTraces.length;

  return {
    total_improvise: improviseTraces.length,
    success_rate,
    ribosome_activation_rate,
  };
}

// ---------------------------------------------------------------------------
// T4.2: Resolver coverage — sample up to 10 full traces
// ---------------------------------------------------------------------------

async function captureResolverCoverage(
  endpoint: string,
  authHeaders: Record<string, string>,
  windowTraces: ExecutionTrace[]
): Promise<ResolverCoverage> {
  const toSample = windowTraces.slice(0, 10);
  const allTasks: FullTaskRecord[] = [];
  let sampledTraces = 0;

  for (const t of toSample) {
    const traceId = t.execution_id ?? t.id;
    if (!traceId) continue;
    if (apiCallCount >= API_CALL_LIMIT - 25) break;

    try {
      const raw = await apiGet(
        `${endpoint}/v2/activities/execution-traces/${encodeURIComponent(traceId)}`,
        authHeaders
      ) as FullTraceResponse;
      const full: FullTrace | undefined = raw.trace ?? raw.data ?? (raw as unknown as FullTrace);
      if (full?.tasks) {
        allTasks.push(...full.tasks);
        sampledTraces++;
      }
    } catch {
      // non-fatal
    }
  }

  if (allTasks.length === 0) {
    return { sampled_traces: sampledTraces, llm_tier_rate: 0, deterministic_rate: 0, pattern_rate: 0, top_resolvers: [] };
  }

  const total = allTasks.length;
  let llmCount = 0;
  let detCount = 0;
  let patCount = 0;
  const resolverFreq = new Map<string, number>();

  for (const task of allTasks) {
    const tier = (task.resolver_tier ?? "").toLowerCase();
    const resolverId = task.resolver_id ?? task.resolver ?? "unknown";

    if (tier === "llm" || resolverId === "llm") {
      llmCount++;
    } else if (tier === "deterministic" || tier === "det") {
      detCount++;
    } else if (tier === "pattern") {
      patCount++;
    } else {
      // resolver field without tier: treat non-llm named resolvers as deterministic
      if (resolverId !== "llm" && resolverId !== "unknown") detCount++;
    }

    resolverFreq.set(resolverId, (resolverFreq.get(resolverId) ?? 0) + 1);
  }

  const top_resolvers = Array.from(resolverFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([resolver_id, count]) => ({ resolver_id, count }));

  return {
    sampled_traces: sampledTraces,
    llm_tier_rate: llmCount / total,
    deterministic_rate: detCount / total,
    pattern_rate: patCount / total,
    top_resolvers,
  };
}

// ---------------------------------------------------------------------------
// T4.3: Reuse trajectory — no extra API calls
// ---------------------------------------------------------------------------

function computeReuseTrajectory(
  windowTraces: ExecutionTrace[],
  thompsonSnapshot: ThompsonEntry[]
): ReuseTrajectory {
  if (windowTraces.length === 0) {
    return {
      reuse_rate: 0,
      composition_depth_distribution: { d0: 0, d1: 0, d2: 0, d3plus: 0 },
      mean_composition_depth: 0,
    };
  }

  const snapshotIds = new Set(thompsonSnapshot.map((t) => normalizeId(t.activity_id)));

  const reuseCount = windowTraces.filter((t) => {
    const aid = normalizeId(t.activity_id ?? "");
    return snapshotIds.has(aid) && !isImproviseId(aid);
  }).length;

  const reuse_rate = reuseCount / windowTraces.length;

  const dist = { d0: 0, d1: 0, d2: 0, d3plus: 0 };
  let depthSum = 0;

  for (const t of windowTraces) {
    const depth = (t.composition_chain ?? []).length;
    depthSum += depth;
    if (depth === 0) dist.d0++;
    else if (depth === 1) dist.d1++;
    else if (depth === 2) dist.d2++;
    else dist.d3plus++;
  }

  return {
    reuse_rate,
    composition_depth_distribution: dist,
    mean_composition_depth: depthSum / windowTraces.length,
  };
}

// ---------------------------------------------------------------------------
// §6.2: Discrimination stat — Welch t-test across signature buckets
// ---------------------------------------------------------------------------

function normalCDF(z: number): number {
  // Abramowitz & Stegun rational approximation (max error 7.5e-8)
  const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const k = 1 / (1 + 0.2316419 * Math.abs(z));
  let poly = 0;
  let kpow = k;
  for (const ai of a) { poly += ai * kpow; kpow *= k; }
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const upper = 1 - pdf * poly;
  return z >= 0 ? upper : 1 - upper;
}

function welchTTest(
  alpha1: number, beta1: number, n1: number,
  alpha2: number, beta2: number, n2: number,
): { t_stat: number; df: number; p_value: number } {
  if (n1 < 2 || n2 < 2) return { t_stat: 0, df: 0, p_value: 1 };
  const m1 = alpha1 / (alpha1 + beta1);
  const m2 = alpha2 / (alpha2 + beta2);
  const v1 = (alpha1 * beta1) / (Math.pow(alpha1 + beta1, 2) * (alpha1 + beta1 + 1));
  const v2 = (alpha2 * beta2) / (Math.pow(alpha2 + beta2, 2) * (alpha2 + beta2 + 1));
  const se2 = v1 / n1 + v2 / n2;
  if (se2 === 0) return { t_stat: 0, df: 0, p_value: 1 };
  const t = (m1 - m2) / Math.sqrt(se2);
  // Welch-Satterthwaite df
  const df = Math.pow(se2, 2) / (Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1));
  // p-value: two-tailed, using normal approximation (accurate for df > 30)
  const p = 2 * (1 - normalCDF(Math.abs(t)));
  return { t_stat: t, df, p_value: p };
}

async function computeDiscriminationStat(
  endpoint: string,
  authHeaders: Record<string, string>,
): Promise<DiscriminationReport> {
  const SUFFICIENT_OBS = 50;

  const resp = await apiPost(`${endpoint}/v2/impulses/resolve`, authHeaders, {
    pointer: { type: 'contextThompsonScores', signatureVersion: 1, limit: 500 },
  }) as { success?: boolean; content?: string };

  if (!resp.success || !resp.content) {
    return {
      total_conditional_rows: 0,
      total_templates_with_rows: 0,
      templates_with_sufficient_obs: 0,
      discriminating_templates: 0,
      discriminating_fraction: 0,
      top_discriminating: [],
    };
  }

  const parsed = JSON.parse(resp.content) as {
    entries: Array<{
      template_id: string;
      context_bucket: string;
      alpha: number;
      beta: number;
      n_observations: number;
    }>;
  };

  const rows = parsed.entries ?? [];

  // Group rows by template_id
  const byTemplate = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = byTemplate.get(row.template_id) ?? [];
    bucket.push(row);
    byTemplate.set(row.template_id, bucket);
  }

  let sufficientCount = 0;
  let discriminatingCount = 0;
  const topDiscriminating: DiscriminationReport['top_discriminating'] = [];

  for (const [templateId, buckets] of byTemplate) {
    const totalObs = buckets.reduce((s, r) => s + r.n_observations, 0);
    if (totalObs < SUFFICIENT_OBS) continue;
    sufficientCount++;

    // Take top-2 buckets by n_observations
    const sorted = [...buckets].sort((a, b) => b.n_observations - a.n_observations);
    const a = sorted[0];
    const b = sorted[1];
    if (!b) continue;

    const { t_stat, df, p_value } = welchTTest(
      a.alpha, a.beta, a.n_observations,
      b.alpha, b.beta, b.n_observations,
    );

    if (p_value < 0.05) {
      discriminatingCount++;
      topDiscriminating.push({
        template_id: templateId,
        bucket_a: { context_bucket: a.context_bucket, alpha: a.alpha, beta: a.beta, n_obs: a.n_observations, mean: a.alpha / (a.alpha + a.beta) },
        bucket_b: { context_bucket: b.context_bucket, alpha: b.alpha, beta: b.beta, n_obs: b.n_observations, mean: b.alpha / (b.alpha + b.beta) },
        t_stat,
        p_value,
      });
    }
  }

  topDiscriminating.sort((a, b) => a.p_value - b.p_value);

  return {
    total_conditional_rows: rows.length,
    total_templates_with_rows: byTemplate.size,
    templates_with_sufficient_obs: sufficientCount,
    discriminating_templates: discriminatingCount,
    discriminating_fraction: sufficientCount > 0 ? discriminatingCount / sufficientCount : 0,
    top_discriminating: topDiscriminating.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// T4.4: Recommendation executability (--detailed flag)
// ---------------------------------------------------------------------------

async function computeExecutabilityScores(
  entries: EntryResult[],
  thompsonSnapshot: ThompsonEntry[],
  endpoint: string,
  authHeaders: Record<string, string>,
  detailed: boolean
): Promise<EntryResult[]> {
  if (!detailed) {
    // Default: attach mean_ev from snapshot as executability_score proxy
    const snapshotById = new Map(thompsonSnapshot.map((t) => [normalizeId(t.activity_id), t]));
    return entries.map((e) => {
      const top = e.expected_activity_id ? snapshotById.get(normalizeId(e.expected_activity_id)) : undefined;
      return top ? { ...e, executability_score: top.ev } : e;
    });
  }

  const result: EntryResult[] = [];
  let extraCalls = 0;

  for (const entry of entries) {
    if (!entry.found || !entry.expected_activity_id || extraCalls >= 20 || apiCallCount >= API_CALL_LIMIT - 5) {
      result.push(entry);
      continue;
    }

    let templateData: TemplateResponse | null = null;
    try {
      const raw = await apiGet(
        `${endpoint}/v2/activities/templates/${encodeURIComponent(entry.expected_activity_id)}`,
        authHeaders
      ) as TemplateResponse;
      templateData = raw;
      extraCalls++;
    } catch {
      result.push(entry);
      continue;
    }

    const tpl = templateData.template ?? templateData.data ?? (templateData as { output_shapes?: string[]; tasks?: Array<{ resolver?: string; resolver_tier?: string }> });
    const outputShapes = tpl?.output_shapes ?? [];
    const tasks = tpl?.tasks ?? [];

    // ev from Thompson snapshot
    const snapshotEntry = thompsonSnapshot.find((t) => normalizeId(t.activity_id) === normalizeId(entry.expected_activity_id ?? ""));
    const ev = snapshotEntry?.ev ?? 0.5;

    const has_output_shapes = outputShapes.length > 0;
    const has_det_task = tasks.some((t) => {
      const tier = (t.resolver_tier ?? "").toLowerCase();
      const res = (t.resolver ?? "").toLowerCase();
      return tier !== "llm" && res !== "llm" && (tier !== "" || res !== "");
    });

    const executability_score = ev * 0.5 + (has_output_shapes ? 0.3 : 0) + (has_det_task ? 0.2 : 0);
    result.push({ ...entry, executability_score });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Compute aggregate metrics
// ---------------------------------------------------------------------------

function computeMetrics(entries: EntryResult[]): {
  mrr: number;
  hit_at_1: number;
  hit_at_3: number;
  hit_at_5: number;
} {
  if (entries.length === 0) return { mrr: 0, hit_at_1: 0, hit_at_3: 0, hit_at_5: 0 };
  const n = entries.length;
  const mrr = entries.reduce((sum, e) => sum + e.rr, 0) / n;
  const hit_at_1 = entries.filter((e) => e.rank === 1).length / n;
  const hit_at_3 = entries.filter((e) => e.rank > 0 && e.rank <= 3).length / n;
  const hit_at_5 = entries.filter((e) => e.rank > 0 && e.rank <= 5).length / n;
  return { mrr, hit_at_1, hit_at_3, hit_at_5 };
}

// ---------------------------------------------------------------------------
// Print summary table
// ---------------------------------------------------------------------------

function printSummary(
  report: ReuseReport,
  baseline: ReuseReport | null,
  benchmarkEntries: BenchmarkEntry[]
): void {
  const sep = "=".repeat(88);
  console.log(`\n${sep}`);
  console.log(`Activity Reuse Benchmark — MRR Report${report.label ? ` [${report.label}]` : ""}`);
  console.log(`Run at: ${report.run_at}`);
  console.log(sep);

  const fmt = (n: number) => n.toFixed(4);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const delta = (curr: number, prev: number | undefined) =>
    prev === undefined ? "" : ` (${curr >= prev ? "+" : ""}${((curr - prev) * 100).toFixed(1)}pp)`;

  console.log(`\nMetrics:`);
  console.log(
    `  MRR      : ${fmt(report.mrr)}${baseline ? delta(report.mrr, baseline.mrr) : ""}`
  );
  console.log(
    `  Hit@1    : ${pct(report.hit_at_1)}${baseline ? delta(report.hit_at_1, baseline.hit_at_1) : ""}`
  );
  console.log(
    `  Hit@3    : ${pct(report.hit_at_3)}${baseline ? delta(report.hit_at_3, baseline.hit_at_3) : ""}`
  );
  console.log(
    `  Hit@5    : ${pct(report.hit_at_5)}${baseline ? delta(report.hit_at_5, baseline.hit_at_5) : ""}`
  );

  const foundCount = report.entries.filter((e) => e.found).length;
  console.log(`  Found    : ${foundCount}/${report.entries.length} entries`);

  if (report.search_mrr !== undefined) {
    const sMrr = report.search_mrr;
    const gap = sMrr - report.mrr;
    console.log(`\nSearch MRR (FTS-only, no Thompson):`);
    console.log(`  search_mrr   : ${fmt(sMrr)}  (recommend_mrr gap: ${gap >= 0 ? "+" : ""}${(gap * 100).toFixed(1)}pp)`);
    console.log(`  search_Hit@1 : ${pct(report.search_hit_at_1 ?? 0)}`);
    console.log(`  search_Hit@3 : ${pct(report.search_hit_at_3 ?? 0)}`);
    console.log(`  search_Hit@5 : ${pct(report.search_hit_at_5 ?? 0)}`);
    const searchFound = report.entries.filter((e) => e.search_found).length;
    console.log(`  search_found : ${searchFound}/${report.entries.length} entries`);
    if (gap > 0.05) {
      console.log(`  ⚠  FTS finds templates that recommend misses — Thompson overriding good text matches`);
    } else if (gap < -0.05) {
      console.log(`  ⚠  recommend outperforms FTS — Thompson adding signal beyond text match`);
    }
    if (report.quadrant_counts) {
      const q = report.quadrant_counts;
      console.log(`\nDiagnostic quadrants:`);
      console.log(`  A (search✓ recommend✓): ${q.A}  — FTS good, Thompson good`);
      console.log(`  B (search✓ recommend✗): ${q.B}  — FTS good, Thompson suppressing`);
      console.log(`  C (search✗ recommend✓): ${q.C}  — FTS miss, Thompson recovering`);
      console.log(`  D (search✗ recommend✗): ${q.D}  — FTS miss, not recoverable`);
    }
  }

  console.log(`\nTrace stats (7-day window):`);
  const ts = report.trace_stats;
  console.log(`  Sample   : ${ts.sample_size} traces`);
  console.log(`  Improvise: ${ts.improvise_count} (${pct(ts.improvise_rate)})`);

  // T4.5: Behavioral health block
  console.log(`\nBehavioral health:`);

  const ih = report.improvise_health;
  if (!ih || ih.total_improvise === 0) {
    console.log(`  Improvise health  : null (no improvise traces in window)`);
  } else {
    const successStr = ih.success_rate !== null ? `${pct(ih.success_rate)} success` : "null";
    const ribosomeStr = ih.ribosome_activation_rate !== null ? `${pct(ih.ribosome_activation_rate)} ribosome` : "null";
    console.log(`  Improvise health  : ${ih.total_improvise} traces (${successStr}, ${ribosomeStr})`);
  }

  const rc = report.resolver_coverage;
  if (!rc || rc.sampled_traces === 0) {
    console.log(`  Resolver coverage : no traces sampled`);
  } else {
    const topNames = rc.top_resolvers.slice(0, 3).map((r) => r.resolver_id).join(", ");
    console.log(
      `  Resolver coverage : llm=${pct(rc.llm_tier_rate)}, det=${pct(rc.deterministic_rate)}, pat=${pct(rc.pattern_rate)}  (top: ${topNames || "none"})  [llm ↓ is good]`
    );
  }

  const rt = report.reuse_trajectory;
  if (!rt) {
    console.log(`  Reuse trajectory  : unavailable`);
    console.log(`  LLM tier rate     : unavailable`);
  } else {
    console.log(
      `  Reuse trajectory  : reuse_rate=${pct(rt.reuse_rate)}  (mean_depth=${rt.mean_composition_depth.toFixed(1)})  [↑ is good]`
    );
    const llmRate = rc ? rc.llm_tier_rate : null;
    if (llmRate !== null) {
      console.log(`  LLM tier rate     : ${pct(llmRate)}  [↓ is good]`);
    }
  }

  console.log(`\nPer-entry breakdown:`);
  const COL_ID = 12;
  const COL_CAT = 14;
  const COL_GOAL = 44;
  console.log(
    `${"id".padEnd(COL_ID)}${"category".padEnd(COL_CAT)}${"goal (truncated)".padEnd(COL_GOAL)}  rank  RR`
  );
  console.log("-".repeat(COL_ID + COL_CAT + COL_GOAL + 14));

  for (const e of report.entries) {
    const bEntry = benchmarkEntries.find((b) => b.id === e.id);
    const goalText = (bEntry?.goal_text ?? "").slice(0, COL_GOAL - 2);
    console.log(
      `${e.id.padEnd(COL_ID)}${e.category.padEnd(COL_CAT)}${goalText.padEnd(COL_GOAL)}  ${
        e.found ? String(e.rank).padStart(4) : "  NF"
      }  ${e.rr.toFixed(3)}`
    );
  }

  console.log(`\nThompson snapshot (top-10 by EV):`);
  const top10 = report.thompson_snapshot.slice(0, 10);
  console.log(
    `${"activity".padEnd(48)}  ${"α".padStart(7)}  ${"β".padStart(7)}  ${"EV".padStart(7)}  ${"CI±".padStart(8)}  executions`
  );
  console.log("-".repeat(100));
  for (const t of top10) {
    const name = t.activity_id.slice(0, 47).padEnd(48);
    console.log(
      `${name}  ${t.alpha.toFixed(1).padStart(7)}  ${t.beta.toFixed(1).padStart(7)}  ${t.ev.toFixed(4).padStart(7)}  ${t.ci_width.toFixed(4).padStart(8)}  ${t.total_executions}`
    );
  }

  console.log(`\nAPI calls used: ${apiCallCount}/${API_CALL_LIMIT}`);
  console.log(sep);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Aggregate test_audit_report rows over a trailing 30-day window and bucket
 * them by status / subtype / caveat. Used by the harness's Phase G audit
 * summary (OpenSpec 2026-05-18-test-audit-loop §G.1.2).
 *
 * Returns undefined when the activity-api refuses the read (e.g. write resolver
 * not yet live on the deploy under test) — callers must tolerate the absence.
 */
async function fetchAuditSummary(
  endpoint: string,
  authHeaders: Record<string, string>,
): Promise<AuditSummary | undefined> {
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch up to 500 audit reports in the window (covers a typical weekly volume
  // with headroom; the 10-minute SLA in spec R2 keeps per-test cardinality low).
  const auditResp = await fetch(`${endpoint}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      pointer: { type: "test_audit_report", limit: 500 },
    }),
  });
  if (!auditResp.ok) return undefined;
  const auditBody = (await auditResp.json()) as { content?: string; success?: boolean };
  if (!auditBody.success || !auditBody.content) return undefined;
  const auditContent = JSON.parse(auditBody.content) as { entries?: Array<Record<string, unknown>> };
  const entries = auditContent.entries ?? [];

  let passed = 0;
  let passedWithCaveat = 0;
  const failedBySubtype: Record<string, number> = {};
  const caveats: Record<string, number> = {};
  for (const entry of entries) {
    const entryPassed = entry.passed === true;
    const entryCaveats = Array.isArray(entry.caveats) ? (entry.caveats as string[]) : [];
    for (const cv of entryCaveats) {
      caveats[cv] = (caveats[cv] ?? 0) + 1;
    }
    if (entryPassed) {
      passed++;
      if (entryCaveats.length > 0) passedWithCaveat++;
    } else {
      const failedEvidence = entry.failed_evidence as { audit_subtype?: string } | undefined;
      const subtype = failedEvidence?.audit_subtype ?? "unspecified";
      failedBySubtype[subtype] = (failedBySubtype[subtype] ?? 0) + 1;
    }
  }

  // Count open (non-superseded) proposals. A proposal is "open" iff no other
  // proposal lists its id in its supersedes[] array.
  let openProposals = 0;
  try {
    const propResp = await fetch(`${endpoint}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        pointer: { type: "code_modification_proposal", limit: 500 },
      }),
    });
    if (propResp.ok) {
      const propBody = (await propResp.json()) as { content?: string; success?: boolean };
      if (propBody.success && propBody.content) {
        const propContent = JSON.parse(propBody.content) as { entries?: Array<Record<string, unknown>> };
        const props = propContent.entries ?? [];
        const supersededIds = new Set<string>();
        for (const p of props) {
          const sup = Array.isArray(p.supersedes) ? (p.supersedes as string[]) : [];
          for (const id of sup) supersededIds.add(id);
        }
        for (const p of props) {
          if (typeof p.id === "string" && !supersededIds.has(p.id)) openProposals++;
        }
      }
    }
  } catch { /* leave openProposals = 0 */ }

  return {
    total_audits: entries.length,
    passed,
    passed_with_caveat: passedWithCaveat,
    failed_by_subtype: failedBySubtype,
    caveats,
    open_proposals: openProposals,
    window_start: windowStart,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      baseline: { type: "string", default: "" },
      limit: { type: "string", short: "n", default: "20" },
      label: { type: "string", default: "" },
      benchmark: { type: "string", default: "" },
      detailed: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const { endpoint, apiKey } = await loadConfig();
  const limit = parseInt(values.limit ?? "20", 10);
  const label = values.label ?? "";
  const baselineDate = values.baseline ?? "";
  const benchmarkArg = values.benchmark ?? "";
  const detailed = values.detailed ?? false;

  const authHeaders = { Authorization: `ApiKey ${apiKey}` };

  // Locate benchmark file: --benchmark accepts a file path OR the legacy "v1"/"v2" shortcuts.
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(scriptDir, "..", "..");
  const resultsDir = join(repoRoot, "validation", "results");

  let benchmarkPath: string;
  let benchmarkVersion: string;
  if (!benchmarkArg || benchmarkArg === "v1") {
    benchmarkPath = join(repoRoot, "validation", "activity-reuse-benchmark.json");
    benchmarkVersion = "v1";
  } else if (benchmarkArg === "v2") {
    benchmarkPath = join(repoRoot, "validation", "activity-reuse-benchmark-v2.json");
    benchmarkVersion = "v2";
  } else {
    // Treat as explicit file path (absolute or relative to CWD)
    benchmarkPath = resolve(benchmarkArg);
    benchmarkVersion = "custom";
  }

  if (!existsSync(benchmarkPath)) {
    throw new Error(`Benchmark file not found: ${benchmarkPath}`);
  }

  const benchmarkEntries = JSON.parse(await readFile(benchmarkPath, "utf8")) as BenchmarkEntry[];
  console.log(`\nBenchmark: ${benchmarkVersion} (${benchmarkPath})`);
  console.log(`\nLoaded ${benchmarkEntries.length} benchmark entries from ${benchmarkPath}`);

  // Load baseline for comparison
  let baseline: ReuseReport | null = null;
  if (baselineDate) {
    const basePath = join(resultsDir, `${baselineDate}-reuse-report.json`);
    if (existsSync(basePath)) {
      baseline = JSON.parse(await readFile(basePath, "utf8")) as ReuseReport;
      console.log(`Loaded baseline from: ${basePath}`);
    } else {
      console.warn(`Baseline not found: ${basePath}`);
    }
  }

  // Step 1: Evaluate benchmark entries
  console.log(`\nEvaluating ${benchmarkEntries.length} entries (limit=${limit})...`);
  let entryResults: EntryResult[];
  try {
    entryResults = await evaluateBenchmark(benchmarkEntries, endpoint, authHeaders, limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) {
      console.error(`\nABORTED: ${msg}`);
      // Emit partial report with what we have
      entryResults = [];
    } else {
      throw err;
    }
  }

  const { mrr, hit_at_1, hit_at_3, hit_at_5 } = computeMetrics(entryResults);

  // Step 2: Thompson snapshot
  console.log(`\nCapturing Thompson snapshot (broad queries)...`);
  let thompsonSnapshot: ThompsonEntry[] = [];
  try {
    thompsonSnapshot = await captureThompsonSnapshot(endpoint, authHeaders);
    console.log(`  Captured ${thompsonSnapshot.length} template posteriors`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) {
      console.warn(`  Thompson snapshot aborted: ${msg}`);
    } else {
      console.warn(`  Thompson snapshot error: ${msg}`);
    }
  }

  // Step 3: Trace stats (returns raw traces for downstream behavioral metrics)
  console.log(`\nCapturing trace stats...`);
  let traceStats: TraceStats = { sample_size: 0, improvise_count: 0, improvise_rate: 0, window_days: 7 };
  let windowTraces: ExecutionTrace[] = [];
  try {
    const result = await captureTraceStats(endpoint, authHeaders);
    traceStats = result.stats;
    windowTraces = result.rawTraces;
    console.log(`  Sampled ${traceStats.sample_size} traces, improvise_rate=${(traceStats.improvise_rate * 100).toFixed(1)}%`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) {
      console.warn(`  Trace stats aborted: ${msg}`);
    } else {
      console.warn(`  Trace stats error: ${msg}`);
    }
  }

  // Step 4 (v2 only): Search evaluation via FTS templates endpoint
  let searchResults: EntryResult[] = [];
  const hasSearchQuery = benchmarkEntries.some((e) => e.search_query);
  if (hasSearchQuery) {
    console.log(`\nEvaluating search MRR via GET /v2/activities/templates?q=...`);
    try {
      searchResults = await evaluateSearchBenchmark(benchmarkEntries, endpoint, authHeaders, limit);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("budget exhausted")) {
        console.warn(`  Search evaluation aborted: ${msg}`);
      } else {
        console.warn(`  Search evaluation error: ${msg}`);
      }
    }
  }

  const searchMetrics = searchResults.length > 0 ? computeMetrics(
    searchResults.map((e) => ({ ...e, rank: e.search_rank ?? 0, rr: e.search_rr ?? 0, found: e.search_found ?? false }))
  ) : null;

  // Merge search results into entryResults, assign diagnostic quadrant
  const mergedResults = entryResults.map((e) => {
    const s = searchResults.find((r) => r.id === e.id);
    const merged = s ? { ...e, search_rank: s.search_rank, search_rr: s.search_rr, search_found: s.search_found } : e;
    const hasSearchQuery = benchmarkEntries.find((b) => b.id === e.id)?.search_query;
    if (hasSearchQuery) {
      const sf = merged.search_found ?? false;
      const rf = merged.found;
      merged.diagnostic = sf && rf ? "A" : sf && !rf ? "B" : !sf && rf ? "C" : "D";
    } else {
      merged.diagnostic = null;
    }
    return merged;
  });

  const quadrantCounts = mergedResults.reduce((acc, e) => {
    if (e.diagnostic && e.diagnostic !== null) acc[e.diagnostic as "A"|"B"|"C"|"D"]++;
    return acc;
  }, { A: 0, B: 0, C: 0, D: 0 });

  // Step 5: T4.1 — Improvise health
  console.log(`\nCapturing improvise health...`);
  let improviseHealth: ImproviseHealth | undefined;
  try {
    improviseHealth = await captureImproviseHealth(endpoint, authHeaders, windowTraces);
    console.log(`  Improvise traces: ${improviseHealth.total_improvise}, success_rate=${improviseHealth.success_rate !== null ? (improviseHealth.success_rate * 100).toFixed(1) + "%" : "null"}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) {
      console.warn(`  Improvise health aborted: ${msg}`);
    } else {
      console.warn(`  Improvise health error: ${msg}`);
    }
  }

  // Step 6: T4.2 — Resolver coverage
  console.log(`\nCapturing resolver coverage (sampling up to 10 full traces)...`);
  let resolverCoverage: ResolverCoverage | undefined;
  try {
    resolverCoverage = await captureResolverCoverage(endpoint, authHeaders, windowTraces);
    console.log(`  Sampled ${resolverCoverage.sampled_traces} full traces, llm_tier_rate=${(resolverCoverage.llm_tier_rate * 100).toFixed(1)}%`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) {
      console.warn(`  Resolver coverage aborted: ${msg}`);
    } else {
      console.warn(`  Resolver coverage error: ${msg}`);
    }
  }

  // Step 7: T4.3 — Reuse trajectory (no extra API calls)
  const reuseTrajectory = computeReuseTrajectory(windowTraces, thompsonSnapshot);
  console.log(`\nReuse trajectory: reuse_rate=${(reuseTrajectory.reuse_rate * 100).toFixed(1)}%, mean_depth=${reuseTrajectory.mean_composition_depth.toFixed(2)}`);

  // Step 8: §6.2 — Discrimination stat (conditional Thompson buckets)
  let discriminationReport: DiscriminationReport | undefined;
  try {
    discriminationReport = await computeDiscriminationStat(endpoint, authHeaders);
    console.log(`\nDiscrimination stat: ${discriminationReport.total_conditional_rows} conditional rows, ` +
      `${discriminationReport.discriminating_templates}/${discriminationReport.templates_with_sufficient_obs} discriminating ` +
      `(${(discriminationReport.discriminating_fraction * 100).toFixed(1)}%)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) {
      console.warn(`  Discrimination stat aborted: ${msg}`);
    } else {
      console.warn(`  Discrimination stat unavailable: ${msg}`);
    }
  }

  // Step 9: T4.4 — Executability scores (--detailed triggers template fetches)
  let enrichedResults = mergedResults;
  try {
    enrichedResults = await computeExecutabilityScores(
      mergedResults,
      thompsonSnapshot,
      endpoint,
      authHeaders,
      detailed
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) {
      console.warn(`  Executability scoring aborted: ${msg}`);
    } else {
      console.warn(`  Executability scoring error: ${msg}`);
    }
  }

  // Aggregate audit-summary (OpenSpec 2026-05-18-test-audit-loop Phase G).
  // Best-effort: failure here MUST NOT block the harness from writing the
  // primary recommend/search MRR report.
  let auditSummary: AuditSummary | undefined;
  try {
    auditSummary = await fetchAuditSummary(endpoint, authHeaders);
  } catch (err) {
    console.warn(`  Audit summary fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Build report
  const runAt = new Date().toISOString();
  const report: ReuseReport = {
    run_at: runAt,
    label,
    mrr,
    // recommend_mrr is an alias for mrr (v2 nomenclature; old key preserved for compare-reports.ts compat)
    recommend_mrr: mrr,
    hit_at_1,
    hit_at_3,
    hit_at_5,
    ...(searchMetrics ? {
      search_mrr: searchMetrics.mrr,
      search_hit_at_1: searchMetrics.hit_at_1,
      search_hit_at_3: searchMetrics.hit_at_3,
      search_hit_at_5: searchMetrics.hit_at_5,
      quadrant_counts: quadrantCounts,
    } : {}),
    entries: enrichedResults.map((e) => {
      const b = benchmarkEntries.find((b) => b.id === e.id);
      return {
        ...e,
        goal_text: b?.goal_text,
        expected_activity_id: b?.expected_activity_id,
      };
    }),
    thompson_snapshot: thompsonSnapshot,
    trace_stats: traceStats,
    improvise_health: improviseHealth,
    resolver_coverage: resolverCoverage,
    reuse_trajectory: reuseTrajectory,
    discrimination_report: discriminationReport,
    audit_summary: auditSummary,
  };

  // Print summary
  printSummary(report, baseline, benchmarkEntries);

  // Write report
  await mkdir(resultsDir, { recursive: true });
  const isoDate = runAt.slice(0, 10);
  const labelSlug = report.label ? `-${report.label.replace(/[^a-z0-9]+/gi, '-')}` : '';
  const benchSlug = benchmarkVersion !== "v1" ? `-${benchmarkVersion}` : '';
  const outputPath = join(resultsDir, `${isoDate}${labelSlug}${benchSlug}-reuse-report.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nReport written to: ${outputPath}\n`);

  // Test-audit loop integration (OpenSpec 2026-05-18-test-audit-loop Phase G.1).
  // Register reuse-harness as a test (idempotent) and emit a test_report
  // carrying the MRR + audit-summary as the structural outcome the audit loop
  // consumes. The report id is appended to the on-disk JSON for downstream
  // traceability per spec Requirement R1.
  try {
    const { ensureTestRegistration, emitTestReport } = await import("./_test-audit-loop");
    const harnessTestId = "validation/scripts/reuse-harness";
    await ensureTestRegistration({
      test_id: harnessTestId,
      inputs_schema: { benchmark_path: "string", limit: "int", baseline: "string?" },
      perturbation_schedule: [],
      goal_alignment: [
        {
          criterion: "#4-improved-activities",
          discrimination_claim:
            "Tracks whether activity-recommend quality (MRR + hit@k) improves after each Phase 18+ change. A regression in Thompson posterior writes, dense-search ranking, or impulse-relevance updates flips the MRR signal.",
        },
        {
          criterion: "#6-reuse-up-improvise-down",
          discrimination_claim:
            "Reuse trajectory + improvise-rate metrics directly measure the system's bias toward reusing known activities over improvising.",
        },
      ],
      discrimination_claim:
        "Harness regression is detectable as Δ recommend_mrr or Δ search_mrr beyond the gate thresholds in run-weekly-harness.sh.",
      witness_types: ["validator_consensus", "differential_solve"],
    });
    await emitTestReport({
      test_id: harnessTestId,
      run_id: `harness-${runAt}`,
      passed: true, // the harness itself ran to completion; quality gate is in run-weekly-harness.sh
      witnesses: [
        { type: "validator_consensus", validator_id: "reuse-harness.mrr-gate", recommend_mrr: mrr },
      ],
      caveats: auditSummary ? [] : ["audit_summary_unavailable"],
      duration_ms: Date.now() - new Date(runAt).getTime(),
      details: {
        report_path: outputPath,
        recommend_mrr: mrr,
        search_mrr: searchMetrics?.mrr,
        benchmark_version: benchmarkVersion,
        audit_summary: auditSummary,
      },
    });
  } catch (e) {
    console.warn(`[audit-loop] harness test_report emission failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
