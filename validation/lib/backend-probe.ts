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
  parent_execution_id?: string; // from metadata if present
  children?: TraceRecord[];
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

export async function runBackendProbe(opts: {
  stdoutLogPath: string;
  metabobEndpoint: string;
  metabobApiKey: string;
  runStartTime: Date;
}): Promise<BackendProbeResult> {
  const errors: string[] = [];

  // Step 1 — extract execution IDs from stdout
  const executionIdsFound = await extractExecutionIds(opts.stdoutLogPath);

  // Step 2 — snapshot relevance before (uses runStartTime as proxy)
  let relevanceBefore: RelevanceSnapshot = emptySnapshot();
  try {
    relevanceBefore = await fetchRelevanceSnapshot(opts.metabobEndpoint, opts.metabobApiKey, "before");
  } catch (e) {
    errors.push(`relevance-before: ${String(e)}`);
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

  // Step 9 — relevance after
  let relevanceAfter: RelevanceSnapshot = emptySnapshot();
  try {
    relevanceAfter = await fetchRelevanceSnapshot(opts.metabobEndpoint, opts.metabobApiKey, "after");
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
    probeErrors: errors,
  };
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
): Promise<RelevanceSnapshot> {
  // Fetch a window large enough to count; total field is not always present.
  // We care about deltas (new records written during the run), so a ceiling of
  // 1000 is sufficient — production has O(thousands) of records.
  const url = `${endpoint}/v2/activities/impulse-relevance?limit=1000&offset=0`;
  const resp = await fetch(url, {
    headers: { Authorization: `ApiKey ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`GET impulse-relevance (${label}): ${resp.status}`);
  const data = (await resp.json()) as { total?: number; metrics?: unknown[] };
  return {
    total: data.total ?? (data.metrics?.length ?? 0),
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

  // Impulse relevance
  lines.push(`### Impulse relevance updates`);
  lines.push("");
  const delta = probe.relevanceAfter.total - probe.relevanceBefore.total;
  lines.push(`| snapshot | total records |`);
  lines.push(`|---|---|`);
  lines.push(`| before | ${probe.relevanceBefore.total} |`);
  lines.push(`| after  | ${probe.relevanceAfter.total} |`);
  lines.push(`| delta  | **${delta >= 0 ? "+" : ""}${delta}** |`);
  lines.push("");
  if (delta > 0) {
    lines.push(`✅ **${delta} new impulse-relevance record(s) written** during this run.`);
  } else if (delta === 0) {
    lines.push(`⚠️ No new impulse-relevance records written. Validator-dispatch may not have fired, or writes were no-ops.`);
  } else {
    lines.push(`⚠️ Relevance count decreased (${delta}) — records may have been pruned.`);
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
