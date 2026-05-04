/**
 * Post-run backend probe for Phase 14 (--with-backend mode).
 *
 * After a minibob run completes, this module:
 *   1. Extracts execution IDs from minibob's stdout log.
 *   2. Queries activity-api for each trace + its children.
 *   3. Snapshots impulse-relevance metrics before/after the run.
 *   4. Returns structured data that the orchestrator renders into report section 6.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface TraceRecord {
  execution_id: string;
  activity_id: string;
  variant_id?: string;
  vessel_id?: string;
  vessel_version?: string;
  task_count: number;
  impulse_count: number;
  success?: boolean;
  status?: string;
  duration_ms?: number;
  cost_usd?: number;
  parent_execution_id?: string;
  children?: TraceRecord[];
}

export interface ImpulseResolutionRecord {
  impulse_id: string;
  resolver_id: string;
  resolver_tier?: string;
  vessel_id?: string;
  latency_ms?: number;
  cost_usd?: number;
}

export interface CrossVesselResolver {
  vessel_id: string;
  resolver_id: string;
  count: number;
}

export interface RelevanceSnapshot {
  total: number;
  byShape: Record<string, number>;
  sampleTimestamp: string;
}

export interface BackendProbeResult {
  /** All act_* IDs found in minibob stdout */
  executionIdsFound: string[];
  /** Execution tree rooted at the top-level activity (no parent) */
  executionTree: TraceRecord[];
  /** Activities fired as lifecycle hooks (slot-binding, validator-dispatch, etc.) */
  lifecycleActivities: Array<{ activity_id: string; count: number }>;
  /** Resolver tier breakdown across all traced tasks */
  resolverTiers: Record<string, number>;
  /** Vessels that appeared in traces */
  vesselIds: string[];
  /** Impulse relevance record counts before and after */
  relevanceBefore: RelevanceSnapshot;
  relevanceAfter: RelevanceSnapshot;
  /** Cross-vessel resolver usage: vessels other than the main minibob vessel */
  crossVesselUsage: Array<{ vessel_id: string; activity_id: string }>;
  /** Cross-vessel impulse resolution: resolver vessels from impulse_resolutions[] in fetched traces */
  crossVesselResolvers: CrossVesselResolver[];
  /** Whether we successfully fetched per-trace detail for impulse_resolution analysis */
  traceDetailFetched: boolean;
  /** Log-based detection: "[Impulse] Resolved via vessel discovery" lines from stdout */
  discoveryLogResolutions: Array<{ shape: string; vessel: string }>;
  /** Any errors encountered during probing */
  probeErrors: string[];
}

const LIFECYCLE_ACTIVITIES = new Set([
  "impulse-binding-selection-layer",
  "validators-and-failure-modes",
  "lifecycle-driven template extraction",
  "ribosome-extract",
  "slot-binding",
  "validator-dispatch",
  "create-shape-provider-goal",
]);

export async function snapshotRelevanceBefore(
  endpoint: string,
  apiKey: string,
): Promise<RelevanceSnapshot> {
  return fetchRelevanceSnapshot(endpoint, apiKey, "before");
}

export async function runBackendProbe(opts: {
  stdoutLogPath: string;
  metabobEndpoint: string;
  metabobApiKey: string;
  runStartTime: Date;
  /** Pre-run snapshot taken before the agent started; avoids before==after problem */
  relevanceBefore?: RelevanceSnapshot;
}): Promise<BackendProbeResult> {
  const errors: string[] = [];

  // Step 1 — extract execution IDs from stdout
  const executionIdsFound = await extractExecutionIds(opts.stdoutLogPath);

  // Step 1b — extract log-based cross-vessel resolution evidence from stderr
  // (minibob logger writes all levels to console.error → stderr.log; log.warn is visible at default verbosity)
  const stderrLogPath = opts.stdoutLogPath.replace(/stdout\.log$/, "stderr.log");
  const discoveryLogResolutions = await extractDiscoveryLogResolutions(stderrLogPath);

  // Step 2 — use provided pre-run snapshot, or fall back to a fresh query
  let relevanceBefore: RelevanceSnapshot = opts.relevanceBefore ?? emptySnapshot();
  if (!opts.relevanceBefore) {
    try {
      relevanceBefore = await fetchRelevanceSnapshot(opts.metabobEndpoint, opts.metabobApiKey, "before");
    } catch (e) {
      errors.push(`relevance-before: ${String(e)}`);
    }
  }

  // Step 3 — fetch all traces created during the run window
  const allTraces: TraceRecord[] = [];
  if (executionIdsFound.length > 0) {
    try {
      const fetched = await fetchTracesForRun(
        opts.metabobEndpoint,
        opts.metabobApiKey,
        opts.runStartTime,
      );
      allTraces.push(...fetched);
    } catch (e) {
      errors.push(`fetch-traces: ${String(e)}`);
    }
  }

  // Step 4 — build execution tree (find roots = no parent_execution_id in our set)
  // Deduplicate by execution_id; prefer the record with vessel_id or task_count set.
  const seenIds = new Map<string, TraceRecord>();
  for (const t of allTraces) {
    const existing = seenIds.get(t.execution_id);
    if (!existing || (!existing.vessel_id && t.vessel_id) || (existing.task_count === 0 && t.task_count > 0)) {
      seenIds.set(t.execution_id, t);
    }
  }
  const dedupedTraces = [...seenIds.values()];
  const byId = new Map(dedupedTraces.map((t) => [t.execution_id, t]));
  const childrenByParent = new Map<string, TraceRecord[]>();
  for (const t of dedupedTraces) {
    if (t.parent_execution_id) {
      const list = childrenByParent.get(t.parent_execution_id) ?? [];
      list.push(t);
      childrenByParent.set(t.parent_execution_id, list);
    }
  }
  const roots = dedupedTraces.filter(
    (t) => !t.parent_execution_id || !byId.has(t.parent_execution_id),
  );
  const attachChildren = (node: TraceRecord): TraceRecord => ({
    ...node,
    children: (childrenByParent.get(node.execution_id) ?? []).map(attachChildren),
  });
  const executionTree = roots.map(attachChildren);

  // Step 5 — lifecycle hook summary
  const lifecycleCounts = new Map<string, number>();
  for (const t of dedupedTraces) {
    const aid = t.activity_id ?? "";
    const isLifecycle =
      LIFECYCLE_ACTIVITIES.has(aid) ||
      aid.includes("slot-binding") ||
      aid.includes("validator") ||
      aid.includes("ribosome");
    if (isLifecycle) {
      lifecycleCounts.set(aid, (lifecycleCounts.get(aid) ?? 0) + 1);
    }
  }
  const lifecycleActivities = [...lifecycleCounts.entries()]
    .map(([activity_id, count]) => ({ activity_id, count }))
    .sort((a, b) => b.count - a.count);

  // Step 6 — resolver tier breakdown (from task_count proxy — exact breakdown needs
  // the full task records which the list endpoint doesn't include; flag what we can)
  const resolverTiers: Record<string, number> = {};
  // We infer from activity names: deterministic activities have known ids
  for (const t of dedupedTraces) {
    const aid = t.activity_id ?? "";
    const tier =
      aid.includes("slot-binding") || aid.includes("validator-dispatch") || aid.includes("ribosome")
        ? "deterministic"
        : t.task_count > 0
        ? "llm"
        : "unknown";
    resolverTiers[tier] = (resolverTiers[tier] ?? 0) + (t.task_count || 1);
  }

  // Step 7 — vessel diversity
  const vesselSet = new Set(dedupedTraces.map((t) => t.vessel_id).filter(Boolean) as string[]);
  const vesselIds = [...vesselSet];

  // Step 8 — cross-vessel usage (any vessel_id that appears in traces but isn't the main one)
  // The main vessel is the one with the most traces
  const vesselTraceCounts = new Map<string, number>();
  for (const t of dedupedTraces) {
    if (t.vessel_id) vesselTraceCounts.set(t.vessel_id, (vesselTraceCounts.get(t.vessel_id) ?? 0) + 1);
  }
  const mainVessel = [...vesselTraceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const crossVesselUsage = dedupedTraces
    .filter((t) => t.vessel_id && t.vessel_id !== mainVessel)
    .map((t) => ({ vessel_id: t.vessel_id!, activity_id: t.activity_id }));

  // Step 8b — fetch per-trace detail for cross-vessel impulse_resolutions analysis.
  // Sample top 5 non-lifecycle traces with task_count > 0 to avoid spamming the API.
  const crossVesselResolvers: CrossVesselResolver[] = [];
  let traceDetailFetched = false;
  const tracesToSample = dedupedTraces
    .filter((t) => t.task_count > 0)
    .slice(0, 5);
  if (tracesToSample.length > 0) {
    const resolverCounts = new Map<string, CrossVesselResolver>();
    for (const trace of tracesToSample) {
      try {
        const detail = await fetchTraceDetail(opts.metabobEndpoint, opts.metabobApiKey, trace.execution_id);
        if (detail) {
          traceDetailFetched = true;
          for (const r of detail.impulse_resolutions ?? []) {
            // Only record if the vessel is not the executor vessel (cross-vessel)
            if (r.vessel_id && r.vessel_id !== trace.vessel_id) {
              const key = `${r.vessel_id}::${r.resolver_id}`;
              const existing = resolverCounts.get(key);
              if (existing) {
                existing.count++;
              } else {
                resolverCounts.set(key, { vessel_id: r.vessel_id, resolver_id: r.resolver_id, count: 1 });
              }
            }
          }
        }
      } catch {
        // non-fatal; probeErrors already tracked
      }
    }
    crossVesselResolvers.push(...resolverCounts.values());
  }

  // Step 9 — relevance after: count only records created since run started.
  // This avoids the before==after problem (both fetched post-run) by using
  // created_at filtering instead of a total-count delta.
  let relevanceAfter: RelevanceSnapshot = emptySnapshot();
  try {
    relevanceAfter = await fetchRelevanceSnapshot(
      opts.metabobEndpoint,
      opts.metabobApiKey,
      "after",
      opts.runStartTime,
    );
  } catch (e) {
    errors.push(`relevance-after: ${String(e)}`);
  }

  return {
    executionIdsFound,
    executionTree,
    lifecycleActivities,
    resolverTiers,
    vesselIds,
    relevanceBefore,
    relevanceAfter,
    crossVesselUsage,
    crossVesselResolvers,
    traceDetailFetched,
    discoveryLogResolutions,
    probeErrors: errors,
  };
}

async function extractDiscoveryLogResolutions(
  stderrLogPath: string,
): Promise<Array<{ shape: string; vessel: string }>> {
  if (!existsSync(stderrLogPath)) return [];
  const text = await readFile(stderrLogPath, "utf8");
  const results: Array<{ shape: string; vessel: string }> = [];
  // Match: [Impulse] Resolved via vessel discovery: <type> (shape: <shape>, vessel: <name>)
  for (const m of text.matchAll(
    /\[Impulse\] Resolved via vessel discovery: (\S+) \(shape: (\S+), vessel: ([^)]+)\)/g,
  )) {
    results.push({ shape: m[2] ?? m[1] ?? "unknown", vessel: m[3] ?? "unknown" });
  }
  return results;
}

async function extractExecutionIds(stdoutLogPath: string): Promise<string[]> {
  if (!existsSync(stdoutLogPath)) return [];
  const text = await readFile(stdoutLogPath, "utf8");
  const ids = new Set<string>();
  // Pattern: "[TRACE DEBUG] Storing trace act_XXXX"
  for (const m of text.matchAll(/\[TRACE DEBUG\] Storing trace (act_\w+)/g)) {
    ids.add(m[1]);
  }
  // Also pick up any act_ IDs mentioned in the tree summary at the end
  for (const m of text.matchAll(/\b(act_[a-z0-9_]+)\b/g)) {
    ids.add(m[1]);
  }
  return [...ids];
}

async function fetchTraceDetail(
  endpoint: string,
  apiKey: string,
  executionId: string,
): Promise<{ impulse_resolutions: ImpulseResolutionRecord[] } | null> {
  const url = `${endpoint}/v2/activities/execution-traces/${encodeURIComponent(executionId)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `ApiKey ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    impulse_resolutions?: Array<{
      impulse_id: string;
      resolver_id: string;
      resolver_tier?: string;
      vessel_id?: string;
      latency_ms?: number;
      cost_usd?: number;
    }>;
  };
  return {
    impulse_resolutions: (data.impulse_resolutions ?? []).map((r) => ({
      impulse_id: r.impulse_id,
      resolver_id: r.resolver_id,
      resolver_tier: r.resolver_tier,
      vessel_id: r.vessel_id,
      latency_ms: r.latency_ms,
      cost_usd: r.cost_usd,
    })),
  };
}

async function fetchTracesForRun(
  endpoint: string,
  apiKey: string,
  since: Date,
): Promise<TraceRecord[]> {
  // Query traces created in the last 2 hours (covers any reasonable run duration)
  // and filter by timestamp in the consumer
  const url = `${endpoint}/v2/activities/execution-traces?limit=100&offset=0`;
  const resp = await fetch(url, {
    headers: { Authorization: `ApiKey ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`GET execution-traces: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as {
    executions: Array<{
      execution_id: string;
      activity_id: string;
      variant_id?: string;
      vessel_id?: string;
      vessel_version?: string;
      task_count: number;
      impulse_count: number;
      success?: boolean;
      status?: string;
      duration_ms?: number;
      cost_usd?: number;
      executed_at?: string;
      metadata?: { parent_execution_id?: string; child_execution_id?: string };
    }>;
  };

  const sinceMs = since.getTime();
  return data.executions
    .filter((e) => {
      const t = e.executed_at ? new Date(e.executed_at).getTime() : Date.now();
      return t >= sinceMs;
    })
    .map((e) => ({
      execution_id: e.execution_id,
      activity_id: e.activity_id,
      variant_id: e.variant_id,
      vessel_id: e.vessel_id,
      vessel_version: e.vessel_version,
      task_count: e.task_count ?? 0,
      impulse_count: e.impulse_count ?? 0,
      success: e.success,
      status: e.status,
      duration_ms: e.duration_ms,
      cost_usd: e.cost_usd,
      parent_execution_id: e.metadata?.parent_execution_id,
    }));
}

async function fetchRelevanceSnapshot(
  endpoint: string,
  apiKey: string,
  label: string,
  since?: Date,
): Promise<RelevanceSnapshot> {
  // activity-api bug: the `total` field always returns 1 regardless of actual
  // record count. Paginate through metrics[] to get the real total.
  // Cap at 5 pages (5000 records) — we care about deltas, not exact large counts.
  let total = 0;
  let sinceCount = 0;
  let offset = 0;
  const limit = 1000;
  const sinceMs = since?.getTime() ?? 0;
  while (offset < 5000) {
    const url = `${endpoint}/v2/activities/impulse-relevance?limit=${limit}&offset=${offset}`;
    const resp = await fetch(url, {
      headers: { Authorization: `ApiKey ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`GET impulse-relevance (${label}): ${resp.status}`);
    const data = (await resp.json()) as { metrics?: Array<{ created_at?: string }> };
    const batch = data.metrics?.length ?? 0;
    total += batch;
    if (since) {
      for (const r of data.metrics ?? []) {
        if (r.created_at && new Date(r.created_at).getTime() >= sinceMs) {
          sinceCount++;
        }
      }
    }
    if (batch < limit) break;
    offset += limit;
  }
  return {
    total: since ? sinceCount : total,
    byShape: {},
    sampleTimestamp: new Date().toISOString(),
  };
}

function emptySnapshot(): RelevanceSnapshot {
  return { total: 0, byShape: {}, sampleTimestamp: new Date().toISOString() };
}

export function renderBackendSection(probe: BackendProbeResult): string {
  const lines: string[] = [];
  lines.push(`## 6. Backend observations (--with-backend)`);
  lines.push("");

  // Execution IDs found
  lines.push(`### Execution IDs`);
  lines.push("");
  lines.push(`Found **${probe.executionIdsFound.length}** execution ID(s) in stdout.`);
  if (probe.executionIdsFound.length > 0) {
    lines.push("");
    for (const id of probe.executionIdsFound.slice(0, 10)) {
      lines.push(`- \`${id}\``);
    }
    if (probe.executionIdsFound.length > 10) {
      lines.push(`- _...${probe.executionIdsFound.length - 10} more_`);
    }
  }
  lines.push("");

  // Execution tree
  lines.push(`### Execution tree`);
  lines.push("");
  if (probe.executionTree.length === 0) {
    lines.push(`_No execution traces found in activity-api for this run window._`);
  } else {
    lines.push(`\`\`\``);
    for (const root of probe.executionTree) {
      renderNode(root, "", lines);
    }
    lines.push(`\`\`\``);
  }
  lines.push("");

  // Lifecycle hooks
  lines.push(`### Lifecycle hooks fired`);
  lines.push("");
  if (probe.lifecycleActivities.length === 0) {
    lines.push(`_None detected._`);
  } else {
    lines.push(`| activity | count |`);
    lines.push(`|---|---|`);
    for (const lc of probe.lifecycleActivities) {
      lines.push(`| \`${lc.activity_id}\` | ${lc.count} |`);
    }
  }
  lines.push("");

  // Vessels involved
  lines.push(`### Vessels`);
  lines.push("");
  if (probe.vesselIds.length === 0) {
    lines.push(`_No vessel IDs found in traces._`);
  } else {
    for (const v of probe.vesselIds) {
      lines.push(`- \`${v}\``);
    }
    if (probe.crossVesselUsage.length > 0) {
      lines.push("");
      lines.push(`**Cross-vessel executions:**`);
      const grouped = new Map<string, string[]>();
      for (const c of probe.crossVesselUsage) {
        const list = grouped.get(c.vessel_id) ?? [];
        list.push(c.activity_id);
        grouped.set(c.vessel_id, list);
      }
      for (const [vid, acts] of grouped) {
        lines.push(`- \`${vid}\`: ${[...new Set(acts)].join(", ")}`);
      }
    } else {
      lines.push("");
      lines.push(`_All executions from a single vessel — no cross-vessel resolver usage detected._`);
    }
  }
  lines.push("");

  // Cross-vessel impulse resolution (from per-trace detail)
  lines.push(`### Cross-vessel impulse resolution`);
  lines.push("");
  if (!probe.traceDetailFetched) {
    lines.push(`_Trace detail not fetched (no tasks in sampled traces or fetch failed)._`);
  } else if (probe.crossVesselResolvers.length === 0) {
    if (probe.discoveryLogResolutions.length > 0) {
      lines.push(`✅ **Cross-vessel impulse resolution confirmed via execution logs.** Trace metadata did not record resolver vessel IDs (F-V19), but stdout logs show vessel-discovery routing:`);
      lines.push("");
      lines.push(`| shape | resolved by vessel |`);
      lines.push(`|---|---|`);
      for (const r of probe.discoveryLogResolutions) {
        lines.push(`| \`${r.shape}\` | \`${r.vessel}\` |`);
      }
    } else {
      lines.push(`⚠️ **No cross-vessel impulse resolution detected.** All impulses in sampled traces were resolved by the executing vessel itself.`);
      lines.push("");
      lines.push(`This means minibob did not route any impulse through discovery to an external vessel (e.g. activity-api, concept-db) during this run. To trigger cross-vessel resolution, the task must require a shape that minibob cannot resolve locally (e.g. \`executionTraceList\`, \`activityTemplate\`, \`conceptGraph\`).`);
    }
  } else {
    lines.push(`✅ **Cross-vessel impulse resolution confirmed.** The following external vessels resolved impulses during this run:`);
    lines.push("");
    lines.push(`| resolver vessel | resolver_id | count |`);
    lines.push(`|---|---|---|`);
    for (const r of probe.crossVesselResolvers.sort((a, b) => b.count - a.count)) {
      lines.push(`| \`${r.vessel_id}\` | \`${r.resolver_id}\` | ${r.count} |`);
    }
  }
  lines.push("");

  // Impulse relevance
  lines.push(`### Impulse relevance updates`);
  lines.push("");
  // relevanceBefore = total at run start (pre-run snapshot from orchestrator)
  // relevanceAfter = records with created_at >= runStartTime (new during run)
  const newDuringRun = probe.relevanceAfter.total;
  lines.push(`| metric | value |`);
  lines.push(`|---|---|`);
  lines.push(`| total records at run start | ${probe.relevanceBefore.total} |`);
  lines.push(`| new records written during run | **${newDuringRun}** |`);
  lines.push("");
  if (newDuringRun > 0) {
    lines.push(`✅ **${newDuringRun} new impulse-relevance record(s) written** during this run.`);
  } else {
    lines.push(`⚠️ No new impulse-relevance records written during this run window. Existing records may have been updated (alpha/beta increments) without creating new rows.`);
  }
  lines.push("");

  // Errors
  if (probe.probeErrors.length > 0) {
    lines.push(`### Probe errors`);
    lines.push("");
    for (const e of probe.probeErrors) {
      lines.push(`- ${e}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderNode(node: TraceRecord, prefix: string, lines: string[]) {
  const status = node.success === true ? "✓" : node.success === false ? "✗" : "?";
  const tasks = node.task_count > 0 ? ` [${node.task_count}t/${node.impulse_count}i]` : "";
  const cost = node.cost_usd ? ` $${node.cost_usd.toFixed(4)}` : "";
  lines.push(`${prefix}${status} ${node.activity_id ?? node.execution_id}${tasks}${cost} (${node.vessel_id ?? "?"})`);
  for (const child of node.children ?? []) {
    renderNode(child, prefix + "  ", lines);
  }
}
