/**
 * Analyze Runtime Traces from MiniBob
 *
 * Queries the activity-api backend to analyze runtime traces and generate
 * insights about code usage, performance, and optimization opportunities.
 *
 * Usage:
 *   bun run analyze-runtime-traces.ts --vessel-id minibob-runtime-test-123
 *   bun run analyze-runtime-traces.ts --local ./runtime-traces
 */

interface RuntimeTrace {
  id: string;
  activity_template_id: string;
  vessel_id: string;
  impulse_resolutions: Array<{
    impulse_id: string;
    resolver_id: string;
    resolver_tier: string;
    latency_ms: number;
    cost_usd: number;
  }>;
  duration_ms: number;
  total_cost_usd: number;
  success: boolean;
  metadata?: {
    runtime_trace?: boolean;
    template_id?: string;
    template_name?: string;
    category?: string;
    [key: string]: unknown;
  };
}

interface HotPath {
  activity_template_id: string;
  execution_count: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  total_time_ms: number;
}

interface ResolverPerformance {
  resolver_id: string;
  tier: string;
  call_count: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  total_time_ms: number;
}

/**
 * Load traces from local directory
 */
async function loadLocalTraces(path: string): Promise<RuntimeTrace[]> {
  const traces: RuntimeTrace[] = [];
  const glob = new Bun.Glob("**/*.json");

  for await (const file of glob.scan({ cwd: path })) {
    const filePath = `${path}/${file}`;
    const content = await Bun.file(filePath).text();
    const trace = JSON.parse(content) as RuntimeTrace;

    if (trace.metadata?.runtime_trace) {
      traces.push(trace);
    }
  }

  return traces;
}

/**
 * Query traces from backend API
 */
async function queryBackendTraces(vesselId: string): Promise<RuntimeTrace[]> {
  const endpoint =
    process.env.METABOB_ENDPOINT || "https://activity.metabob.com";
  const apiKey = process.env.METABOB_API_KEY;

  if (!apiKey) {
    throw new Error("METABOB_API_KEY not set");
  }

  const response = await fetch(
    `${endpoint}/v2/activities/execution-traces?vessel_id=${vesselId}&runtime_trace=true&limit=1000`,
    {
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Backend query failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.traces || [];
}

/**
 * Calculate hot paths (most frequently executed activities)
 */
function analyzeHotPaths(traces: RuntimeTrace[]): HotPath[] {
  const activityStats = new Map<
    string,
    { count: number; durations: number[] }
  >();

  for (const trace of traces) {
    const templateId = trace.activity_template_id;
    const stats = activityStats.get(templateId) || {
      count: 0,
      durations: [],
    };

    stats.count++;
    stats.durations.push(trace.duration_ms);

    activityStats.set(templateId, stats);
  }

  const hotPaths: HotPath[] = [];

  for (const [templateId, stats] of activityStats.entries()) {
    const durations = stats.durations.sort((a, b) => a - b);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[p95Index] || durations[durations.length - 1];

    hotPaths.push({
      activity_template_id: templateId,
      execution_count: stats.count,
      avg_duration_ms: avg,
      p95_duration_ms: p95,
      total_time_ms: durations.reduce((sum, d) => sum + d, 0),
    });
  }

  return hotPaths.sort((a, b) => b.total_time_ms - a.total_time_ms);
}

/**
 * Calculate resolver performance metrics
 */
function analyzeResolverPerformance(
  traces: RuntimeTrace[],
): ResolverPerformance[] {
  const resolverStats = new Map<
    string,
    { tier: string; count: number; latencies: number[] }
  >();

  for (const trace of traces) {
    for (const resolution of trace.impulse_resolutions || []) {
      const stats = resolverStats.get(resolution.resolver_id) || {
        tier: resolution.resolver_tier,
        count: 0,
        latencies: [],
      };

      stats.count++;
      stats.latencies.push(resolution.latency_ms);

      resolverStats.set(resolution.resolver_id, stats);
    }
  }

  const performance: ResolverPerformance[] = [];

  for (const [resolverId, stats] of resolverStats.entries()) {
    const latencies = stats.latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95 = latencies[p95Index] || latencies[latencies.length - 1];

    performance.push({
      resolver_id: resolverId,
      tier: stats.tier,
      call_count: stats.count,
      avg_latency_ms: avg,
      p95_latency_ms: p95,
      total_time_ms: latencies.reduce((sum, l) => sum + l, 0),
    });
  }

  return performance.sort((a, b) => b.total_time_ms - a.total_time_ms);
}

/**
 * Generate report
 */
function generateReport(traces: RuntimeTrace[]) {
  console.log("=============================================");
  console.log("MiniBob Runtime Tracing Analysis");
  console.log("=============================================");
  console.log();

  console.log(`Total traces analyzed: ${traces.length}`);
  console.log(
    `Success rate: ${(traces.filter((t) => t.success).length / traces.length * 100).toFixed(1)}%`,
  );
  console.log();

  // Hot Paths
  console.log("HOT PATHS (Most Frequently Executed)");
  console.log("---------------------------------------------");
  const hotPaths = analyzeHotPaths(traces).slice(0, 10);

  for (const path of hotPaths) {
    console.log(`\n${path.activity_template_id}`);
    console.log(`  Executions: ${path.execution_count}`);
    console.log(`  Avg Duration: ${path.avg_duration_ms.toFixed(0)}ms`);
    console.log(`  P95 Duration: ${path.p95_duration_ms.toFixed(0)}ms`);
    console.log(
      `  Total Time: ${(path.total_time_ms / 1000).toFixed(1)}s`,
    );
  }

  console.log();
  console.log();

  // Resolver Performance
  console.log("RESOLVER PERFORMANCE (Ordered by Total Time)");
  console.log("---------------------------------------------");
  const resolverPerf = analyzeResolverPerformance(traces).slice(0, 15);

  for (const resolver of resolverPerf) {
    console.log(`\n${resolver.resolver_id} (${resolver.tier})`);
    console.log(`  Calls: ${resolver.call_count}`);
    console.log(`  Avg Latency: ${resolver.avg_latency_ms.toFixed(0)}ms`);
    console.log(`  P95 Latency: ${resolver.p95_latency_ms.toFixed(0)}ms`);
    console.log(
      `  Total Time: ${(resolver.total_time_ms / 1000).toFixed(1)}s`,
    );
  }

  console.log();
  console.log();

  // Insights
  console.log("KEY INSIGHTS");
  console.log("---------------------------------------------");

  // Find bottlenecks (high latency + high frequency)
  const bottlenecks = resolverPerf
    .filter((r) => r.call_count > 5 && r.avg_latency_ms > 100)
    .slice(0, 3);

  if (bottlenecks.length > 0) {
    console.log("\n🔴 BOTTLENECKS DETECTED:");
    for (const b of bottlenecks) {
      console.log(
        `  - ${b.resolver_id}: Called ${b.call_count}x, avg ${b.avg_latency_ms.toFixed(0)}ms`,
      );
      console.log(
        `    → Optimization potential: ${(b.total_time_ms / 1000).toFixed(1)}s saved if improved`,
      );
    }
  }

  // Find unused or rarely used code
  const rareActivities = analyzeHotPaths(traces).filter(
    (p) => p.execution_count === 1,
  );

  if (rareActivities.length > 0) {
    console.log(`\n⚠️  RARELY USED ACTIVITIES: ${rareActivities.length}`);
    console.log(
      `  Consider: Are these needed? Could they be consolidated?`,
    );
  }

  // Cost analysis
  const totalCost = traces.reduce(
    (sum, t) => sum + (t.total_cost_usd || 0),
    0,
  );
  if (totalCost > 0) {
    console.log(`\n💰 TOTAL COST: $${totalCost.toFixed(4)}`);
    console.log(
      `  Avg per execution: $${(totalCost / traces.length).toFixed(4)}`,
    );
  }

  console.log();
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);

  let traces: RuntimeTrace[] = [];

  if (args.includes("--local")) {
    const pathIndex = args.indexOf("--local") + 1;
    const path = args[pathIndex] || "./runtime-traces";
    console.log(`Loading traces from: ${path}`);
    traces = await loadLocalTraces(path);
  } else if (args.includes("--vessel-id")) {
    const vesselIdIndex = args.indexOf("--vessel-id") + 1;
    const vesselId = args[vesselIdIndex];
    if (!vesselId) {
      console.error("Error: --vessel-id requires a value");
      process.exit(1);
    }
    console.log(`Querying backend for vessel: ${vesselId}`);
    traces = await queryBackendTraces(vesselId);
  } else {
    console.error("Usage:");
    console.error("  bun run analyze-runtime-traces.ts --local ./traces");
    console.error(
      "  bun run analyze-runtime-traces.ts --vessel-id minibob-123",
    );
    process.exit(1);
  }

  if (traces.length === 0) {
    console.log("No runtime traces found.");
    process.exit(0);
  }

  generateReport(traces);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
