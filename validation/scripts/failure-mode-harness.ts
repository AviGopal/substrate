#!/usr/bin/env bun
/**
 * failure-mode-harness.ts — lift-validation harness for the 63-mode failure matrix.
 *
 * For each scenario in validation/failure-modes/scenarios/, dispatches the
 * declared goal_text to POST /v2/activities/recommend, then queries
 * activity-api for traces that match the expected emergent activity
 * signature. Scores per-scenario:
 *
 *   - emergence_class: 'reuse' | 'new' | 'gap'
 *   - self_heal_seconds: time from dispatch to matching trace
 *   - detection_signal_present: whether the failure pattern is detectable
 *     from trace data alone, or requires replay / cross-trace witness
 *
 * Usage:
 *   bun run validation/scripts/failure-mode-harness.ts \
 *     [--scenario <file>] \
 *     [--scenarios <dir>] \
 *     [--label "<run label>"] \
 *     [--out <report.json>] \
 *     [--window-seconds <N>]
 *
 * Config: METABOB_ENDPOINT / METABOB_API_KEY env or ~/.metabob/config.json.
 */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Types — mirror schema.json
// ---------------------------------------------------------------------------

type ModeClass = "fm" | "fp";
type Stage =
  | "pre_discovery"
  | "discovery"
  | "recommendation"
  | "binding"
  | "execution"
  | "validation"
  | "composition"
  | "learning";
type OutcomeClass = "TN" | "TP" | "FN" | "FP";
type EmergenceClass = "reuse" | "new" | "gap_accepted" | "gap";
type WitnessKind =
  | "trace_only"
  | "replay"
  | "downstream_correlation"
  | "human_verdict"
  | "cross_vessel_witness";

interface Scenario {
  id: string;
  mode_class: ModeClass;
  stage: Stage;
  outcome_class: OutcomeClass;
  information_state: "known_known" | "known_unknown";
  title: string;
  description: string;
  goal_text: string;
  expected_input_shapes?: string[];
  expected_output_shapes?: string[];
  detection: {
    signal: string;
    witness_required: WitnessKind;
    query_template?: string;
  };
  expected_emergence: {
    class: "reuse" | "new" | "gap_accepted";
    activity_signature: {
      input_shapes_intersect?: string[];
      output_shapes_must_include?: string[];
      tags_pattern?: string;
    };
    minimum_thompson_alpha?: number;
  };
  self_heal_window_seconds: number;
  metadata?: { priority?: string; cost_asymmetry?: string };
}

interface RecommendationEntry {
  id?: string;
  template_id?: string;
  activity_id?: string;
  name?: string;
  tags?: string[];
  input_shapes?: string[];
  output_shapes?: string[];
  selection_metadata?: { alpha?: number; beta?: number };
}

interface ScenarioOutcome {
  scenario_id: string;
  dispatched_at: string;
  recommendations_returned: number;
  matched_existing_activity_id: string | null;
  emergence_class: EmergenceClass;
  emergent_trace_id: string | null;
  self_heal_seconds: number | null;
  detection_signal_present: boolean;
  notes: string[];
}

interface HarnessReport {
  generated_at: string;
  label: string;
  endpoint: string;
  scenarios_run: number;
  scenarios: ScenarioOutcome[];
  summary: {
    reuse: number;
    new: number;
    gap: number;
    avg_self_heal_seconds: number | null;
  };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

async function loadConfig(): Promise<{ endpoint: string; apiKey: string }> {
  const envEndpoint = process.env["METABOB_ENDPOINT"];
  const envKey = process.env["METABOB_API_KEY"];
  const configPath = join(homedir(), ".metabob", "config.json");
  if (existsSync(configPath)) {
    const raw = JSON.parse(await readFile(configPath, "utf8")) as {
      metabob?: { endpoint?: string; apiKey?: string };
    };
    const endpoint =
      envEndpoint ?? raw.metabob?.endpoint ?? "https://activity.metabob.com";
    const apiKey = envKey ?? raw.metabob?.apiKey ?? "";
    if (apiKey) return { endpoint, apiKey };
  }
  if (envEndpoint && envKey) return { endpoint: envEndpoint, apiKey: envKey };
  throw new Error(
    "METABOB_API_KEY not set. Set via env var or ~/.metabob/config.json",
  );
}

// ---------------------------------------------------------------------------
// Scenario loading
// ---------------------------------------------------------------------------

async function loadScenarios(args: {
  scenario?: string;
  scenarios?: string;
}): Promise<Scenario[]> {
  if (args.scenario) {
    const text = await readFile(args.scenario, "utf8");
    return [JSON.parse(text) as Scenario];
  }
  const dir =
    args.scenarios ??
    resolvePath(
      dirname(new URL(import.meta.url).pathname),
      "..",
      "failure-modes",
      "scenarios",
    );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const out: Scenario[] = [];
  for (const f of files) {
    out.push(JSON.parse(await readFile(join(dir, f), "utf8")) as Scenario);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Recommendation + trace queries
// ---------------------------------------------------------------------------

async function recommend(
  endpoint: string,
  apiKey: string,
  scenario: Scenario,
): Promise<RecommendationEntry[]> {
  const body = {
    task_description: scenario.goal_text,
    goal_text: scenario.goal_text,
    expected_output_shapes: scenario.expected_output_shapes ?? [],
    impulse_shapes: scenario.expected_input_shapes ?? [],
    limit: 10,
  };
  const res = await fetch(`${endpoint}/v2/activities/recommend`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `ApiKey ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`recommend ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    recommendations?: RecommendationEntry[];
    activities?: RecommendationEntry[];
    templates?: RecommendationEntry[];
  };
  return json.recommendations ?? json.activities ?? json.templates ?? [];
}

async function discoverByOutputShapes(
  endpoint: string,
  apiKey: string,
  requiredShapes: string[],
): Promise<RecommendationEntry[]> {
  if (requiredShapes.length === 0) return [];
  const res = await fetch(`${endpoint}/v2/activities/discover-by-shapes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `ApiKey ${apiKey}`,
    },
    body: JSON.stringify({
      required_shapes: requiredShapes,
      mode: "forward",
      limit: 20,
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    activities?: Array<{
      variant_id?: string;
      activity_id?: string;
      id?: string;
      variant_name?: string;
      name?: string;
      tags?: string[];
      output_shapes?: string[];
      input_shapes?: string[];
      // discover-by-shapes uses schema sub-objects
      output_schema?: { produces_shapes?: string[] };
      input_schema?: { required_shapes?: string[] };
      selection_metadata?: { alpha?: number; beta?: number };
    }>;
  };
  // Normalize field names: discover-by-shapes uses output_schema.produces_shapes
  // but matchSignature expects output_shapes.
  return (json.activities ?? []).map((a) => ({
    id: a.variant_id ?? a.activity_id ?? a.id,
    template_id: a.variant_id ?? a.activity_id ?? a.id,
    name: a.variant_name ?? a.name,
    tags: a.tags ?? [],
    output_shapes: a.output_shapes ?? a.output_schema?.produces_shapes ?? [],
    input_shapes: a.input_shapes ?? a.input_schema?.required_shapes ?? [],
    selection_metadata: a.selection_metadata,
  }));
}

function matchSignature(
  rec: RecommendationEntry,
  sig: Scenario["expected_emergence"]["activity_signature"],
  opts: { requireTags?: boolean; requireInputIntersect?: boolean } = {},
): boolean {
  const outShapes = rec.output_shapes ?? [];
  const tags = rec.tags ?? [];
  if (sig.output_shapes_must_include) {
    for (const s of sig.output_shapes_must_include) {
      if (!outShapes.includes(s)) return false;
    }
  }
  if (sig.input_shapes_intersect && rec.input_shapes) {
    // Only enforce intersection when the caller opted in (e.g. /recommend results
    // have full input_shapes; discover-by-shapes results may use different naming).
    if (opts.requireInputIntersect) {
      const has = sig.input_shapes_intersect.some((s) =>
        rec.input_shapes!.includes(s),
      );
      if (!has) return false;
    }
  }
  if (sig.tags_pattern) {
    // Skip tags check if tags are absent from the response (e.g. discover-by-shapes
    // does not return tags) and caller did not require them.
    if (tags.length > 0 || opts.requireTags) {
      const re = new RegExp(
        sig.tags_pattern.replace(/\./g, "\\.").replace(/\*/g, ".*"),
      );
      if (!tags.some((t) => re.test(t))) return false;
    }
  }
  return true;
}

async function queryEmergentTrace(
  endpoint: string,
  apiKey: string,
  scenario: Scenario,
  sinceIso: string,
): Promise<{ id: string; created_at: string } | null> {
  // executionTraceList — filter by output_shapes if backend supports it.
  // Falls back to client-side filtering of recent traces.
  const url = new URL(`${endpoint}/v2/activities/execution-traces`);
  url.searchParams.set("limit", "50");
  url.searchParams.set("since", sinceIso);
  const res = await fetch(url.toString(), {
    headers: { authorization: `ApiKey ${apiKey}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    traces?: Array<{ id?: string; created_at?: string; output_shapes?: string[] }>;
    executions?: Array<{ id?: string; created_at?: string; output_shapes?: string[] }>;
  };
  const traces = json.traces ?? json.executions ?? [];
  const need = scenario.expected_emergence.activity_signature
    .output_shapes_must_include ?? [];
  for (const t of traces) {
    const shapes = t.output_shapes ?? [];
    if (need.every((s) => shapes.includes(s)) && t.id && t.created_at) {
      return { id: t.id, created_at: t.created_at };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main per-scenario execution
// ---------------------------------------------------------------------------

async function runScenario(
  endpoint: string,
  apiKey: string,
  scenario: Scenario,
): Promise<ScenarioOutcome> {
  const dispatchedAt = new Date();
  const notes: string[] = [];

  let recs: RecommendationEntry[] = [];
  try {
    recs = await recommend(endpoint, apiKey, scenario);
  } catch (err) {
    notes.push(`recommend failed: ${(err as Error).message}`);
  }

  const match = recs.find((r) =>
    matchSignature(r, scenario.expected_emergence.activity_signature, { requireTags: true, requireInputIntersect: true }),
  );

  let emergence: EmergenceClass;
  let matchedId: string | null = null;
  let traceId: string | null = null;
  let healSeconds: number | null = null;

  if (match) {
    matchedId = match.template_id ?? match.activity_id ?? match.id ?? null;
    const alpha = match.selection_metadata?.alpha ?? 0;
    const min = scenario.expected_emergence.minimum_thompson_alpha;
    if (min != null && alpha < min) {
      emergence = "new";
      notes.push(
        `match found but α=${alpha} < required minimum=${min}; counts as new`,
      );
    } else {
      emergence = "reuse";
    }
  } else {
    // Fallback: discover-by-shapes forward mode finds templates that PRODUCE the
    // required output shapes. New templates aren't in top-N /recommend yet (no
    // execution history), but they ARE discoverable by shape declaration.
    const requiredShapes =
      scenario.expected_emergence.activity_signature.output_shapes_must_include ?? [];
    let discoveredMatch: RecommendationEntry | undefined;
    if (requiredShapes.length > 0) {
      try {
        const discovered = await discoverByOutputShapes(endpoint, apiKey, requiredShapes);
        discoveredMatch = discovered.find((r) =>
          matchSignature(r, scenario.expected_emergence.activity_signature),
        );
      } catch {
        // non-fatal
      }
    }

    if (discoveredMatch) {
      matchedId = discoveredMatch.template_id ?? discoveredMatch.activity_id ?? discoveredMatch.id ?? null;
      emergence = "reuse";
      notes.push(`matched via discover-by-shapes (not yet ranked in /recommend)`);
    } else {
      // No matching recommendation right now. Look for an emergent trace.
      const emergent = await queryEmergentTrace(
        endpoint,
        apiKey,
        scenario,
        dispatchedAt.toISOString(),
      );
      if (emergent) {
        emergence = "new";
        traceId = emergent.id;
        healSeconds =
          (new Date(emergent.created_at).getTime() - dispatchedAt.getTime()) /
          1000;
      } else {
        emergence = "gap";
        notes.push(
          `no matching activity in /recommend or discover-by-shapes; no emergent trace within initial poll window`,
        );
      }
    }
  }

  // detection_signal_present: trace-only detection is the only "fully self-
  // sufficient" case; everything else requires external evidence.
  const detectionPresent = scenario.detection.witness_required === "trace_only";

  return {
    scenario_id: scenario.id,
    dispatched_at: dispatchedAt.toISOString(),
    recommendations_returned: recs.length,
    matched_existing_activity_id: matchedId,
    emergence_class: emergence,
    emergent_trace_id: traceId,
    self_heal_seconds: healSeconds,
    detection_signal_present: detectionPresent,
    notes,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string" },
      scenarios: { type: "string" },
      label: { type: "string", default: "" },
      out: { type: "string" },
    },
  });

  const { endpoint, apiKey } = await loadConfig();
  const scenarios = await loadScenarios({
    scenario: values.scenario,
    scenarios: values.scenarios,
  });

  console.log(
    `failure-mode-harness: ${scenarios.length} scenarios against ${endpoint}`,
  );

  const outcomes: ScenarioOutcome[] = [];
  for (const s of scenarios) {
    process.stdout.write(`  ${s.id} … `);
    const o = await runScenario(endpoint, apiKey, s);
    outcomes.push(o);
    console.log(
      `${o.emergence_class}${o.matched_existing_activity_id ? ` (${o.matched_existing_activity_id})` : ""}`,
    );
  }

  const tally = { reuse: 0, new: 0, gap: 0 };
  let totalHeal = 0;
  let healCount = 0;
  for (const o of outcomes) {
    if (o.emergence_class === "reuse") tally.reuse++;
    else if (o.emergence_class === "new") tally.new++;
    else tally.gap++;
    if (o.self_heal_seconds != null) {
      totalHeal += o.self_heal_seconds;
      healCount++;
    }
  }

  const report: HarnessReport = {
    generated_at: new Date().toISOString(),
    label: values.label ?? "",
    endpoint,
    scenarios_run: outcomes.length,
    scenarios: outcomes,
    summary: {
      reuse: tally.reuse,
      new: tally.new,
      gap: tally.gap,
      avg_self_heal_seconds: healCount > 0 ? totalHeal / healCount : null,
    },
  };

  const outPath =
    values.out ??
    join(
      "validation",
      "results",
      `${new Date().toISOString().slice(0, 10)}-failure-mode-report.json`,
    );
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${outPath}`);
  console.log(
    `  reuse=${tally.reuse}  new=${tally.new}  gap=${tally.gap}  avg_heal=${report.summary.avg_self_heal_seconds}s`,
  );
}

main().catch((err) => {
  console.error("failure-mode-harness fatal:", err);
  process.exit(1);
});
