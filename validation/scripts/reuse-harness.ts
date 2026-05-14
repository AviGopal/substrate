#!/usr/bin/env bun
/**
 * reuse-harness.ts — Phase 18.2 MRR validation harness for activity recommendation quality.
 *
 * Usage:
 *   bun run validation/scripts/reuse-harness.ts [--baseline <date>] [--limit <n>] [--label <text>]
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
  activity_id?: string;
  activity_name?: string;
  success?: boolean;
  goal?: string;
  created_at?: string;
}

interface TracesResponse {
  traces?: ExecutionTrace[];
  data?: ExecutionTrace[];
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
    const endpoint = envEndpoint ?? raw.metabob?.endpoint ?? "https://activity.metabob.com";
    const apiKey = envKey ?? raw.metabob?.apiKey ?? "";
    if (apiKey) return { endpoint, apiKey };
  }
  if (envEndpoint && envKey) return { endpoint: envEndpoint, apiKey: envKey };
  throw new Error("METABOB_API_KEY not set. Set via env var or ~/.metabob/config.json");
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

function recName(r: Recommendation): string {
  return r.name ?? r.template_name ?? r.activity_name ?? "(unknown)";
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
      if (recId(recommendations[i]) === entry.expected_activity_id) {
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
      if (templates[i].id === entry.expected_activity_id) {
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
): Promise<TraceStats> {
  let traces: ExecutionTrace[] = [];
  try {
    const data = await apiGet(
      `${endpoint}/v2/activities/execution-traces?limit=200`,
      authHeaders
    ) as TracesResponse;
    traces = data.traces ?? data.data ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("budget exhausted")) throw err;
    console.warn(`  Trace stats query failed: ${msg.slice(0, 80)}`);
    return { sample_size: 0, improvise_count: 0, improvise_rate: 0, window_days: 7 };
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
    sample_size: recent.length,
    improvise_count: improviseCount,
    improvise_rate: recent.length > 0 ? improviseCount / recent.length : 0,
    window_days: 7,
  };
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

async function main() {
  const { values } = parseArgs({
    options: {
      baseline: { type: "string", default: "" },
      limit: { type: "string", short: "n", default: "20" },
      label: { type: "string", default: "" },
      benchmark: { type: "string", default: "" },
    },
    allowPositionals: false,
  });

  const { endpoint, apiKey } = await loadConfig();
  const limit = parseInt(values.limit ?? "20", 10);
  const label = values.label ?? "";
  const baselineDate = values.baseline ?? "";
  const benchmarkArg = values.benchmark ?? "";

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

  // Step 3: Trace stats
  console.log(`\nCapturing trace stats...`);
  let traceStats: TraceStats = { sample_size: 0, improvise_count: 0, improvise_rate: 0, window_days: 7 };
  try {
    traceStats = await captureTraceStats(endpoint, authHeaders);
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
    entries: mergedResults.map((e) => {
      const b = benchmarkEntries.find((b) => b.id === e.id);
      return {
        ...e,
        goal_text: b?.goal_text,
        expected_activity_id: b?.expected_activity_id,
      };
    }),
    thompson_snapshot: thompsonSnapshot,
    trace_stats: traceStats,
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
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
