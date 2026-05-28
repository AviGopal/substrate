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
const API_KEY = process.env.METABOB_API_KEY ?? "";
const IDLE_WINDOW_SECONDS = parseInt(process.env.BOREDOM_IDLE_WINDOW_SECONDS ?? "300", 10);
const GOAL_INDEX_FILE = process.env.BOREDOM_GOAL_INDEX_FILE ?? "/tmp/boredom-goal-index";

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
  "run the probe-reachable-unlearned activity to find templates with zero execution traces and emit a reachableUnlearnedReport",
  "run the harness-check-scenario activity to validate a failure-mode scenario from the harness matrix",
  // gap-closing / self-healing
  "identify shapes in the execution graph that have no known producer and escalate the most critical one",
  // S2 harness loop — run the full scenario matrix against the live registry and emit a failureModeReport
  "run the harness-run-matrix activity to score all failure-mode scenarios against the live activity registry and emit a failureModeReport",
  // exploration — exercises n=0 templates to build Thompson priors; async dispatch now handles >5min runs
  "run the probe-untraversed-edge activity to find unreachable execution graph edges and emit a topologyGapReport",
  // substrate-authoring — draft-gap-closing-activity reads a failure-mode scenario and produces an
  // activityTemplateVariant via activity_create_variant resolver. This is the lift path: substrate
  // authors templates from observed failure modes. Re-added after b259e028 removed it; scenarios are
  // now seeded in /workspace/validation/failure-modes/scenarios/ so the input gap is closed.
  // Per operator directive 2026-05-28: minimum substrate self-bootstrap requires this dispatch.
  "draft a gap-closing activity variant from a recent failure-mode scenario, producing an activityTemplateVariant",
];

// targetTemplateId per goal — bypasses recommend() entirely for goals that name a specific template.
// undefined means use Thompson Sampling freely (only for goals that don't name a template).
const AUTONOMOUS_GOAL_TARGET_TEMPLATES: readonly (string | undefined)[] = [
  "development-vessel:coverage-tick",              // goal[0]
  "development-vessel:substrate-health-tick",      // goal[1]
  "development-vessel:probe-reachable-unlearned",  // goal[2]
  "development-vessel:harness-check-scenario",     // goal[3]
  undefined,                                       // goal[4] — open-ended, let Thompson choose
  "development-vessel:harness-run-matrix",         // goal[5]
  "development-vessel:probe-untraversed-edge",     // goal[6]
  "development-vessel:draft-gap-closing-activity", // goal[7] — substrate-authoring path
];

// Per-goal extra variables passed to goal-host-vessel /run-goal. Most goals need only the
// default `source` variable; goal[7] (draft-gap-closing-activity) needs explicit paths.
// Scenarios rotate via SCENARIO_ROTATION below to spread learning across failure modes.
const SCENARIO_ROTATION: readonly string[] = [
  "fm-17-resolver-budget-noncompliance",
  "fm-43-cascade-attribution-error",
  "fm-44-silent-trace-loss",
  "fp-11-silent-semantic-failure",
  "fp-12-partial-success-recorded-as-total",
  "fp-15-missing-producer-stale-registration",
];

function extraVariablesForGoal(goalIdx: number): Record<string, unknown> {
  if (goalIdx === 7) {
    // draft-gap-closing-activity reads {{report_path}} and {{scenarios_dir}}/{{scenario_id}}.json.
    // Rotate scenario_id across the 6 seeded scenarios so different failure modes get drafted over time.
    const rotIdx = Math.floor(Date.now() / (30 * 60 * 1000)) % SCENARIO_ROTATION.length;
    return {
      scenarios_dir: "/workspace/validation/failure-modes/scenarios",
      scenario_id: SCENARIO_ROTATION[rotIdx]!,
      // report_path points to the most-recent harness-run-matrix output — goal[5] writes here.
      // If the file is missing, fs_read fails fast and the gap-drafting skips (graceful).
      report_path: "/workspace/validation/results/latest-failure-mode-report.json",
    };
  }
  return {};
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

/** Read and increment the rotating goal index so successive runs cycle goals. */
async function nextGoalIndex(): Promise<number> {
  let idx = 0;
  try {
    const file = Bun.file(GOAL_INDEX_FILE);
    if (await file.exists()) {
      const raw = parseInt(await file.text(), 10);
      if (!isNaN(raw)) idx = raw;
    }
  } catch {}
  const next = (idx + 1) % AUTONOMOUS_GOALS.length;
  try {
    await Bun.write(GOAL_INDEX_FILE, String(next));
  } catch {}
  return idx;
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
        body: JSON.stringify({}),
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

  const goalIdx = await nextGoalIndex();
  const goal = AUTONOMOUS_GOALS[goalIdx]!;
  const targetTemplateId = AUTONOMOUS_GOAL_TARGET_TEMPLATES[goalIdx];
  console.log(`[boredom-vessel] submitting goal[${goalIdx}]: "${goal}"${targetTemplateId ? ` (targetTemplateId=${targetTemplateId})` : ""}`);

  let res: Response;
  try {
    // Async dispatch: POST /run-goal returns 202+dispatchId immediately (no 300s block).
    // We then poll GET /executions/:dispatchId until done or systemd kills us (TimeoutStartSec=600).
    // targetTemplateId bypasses Thompson Sampling — goal-host-vessel skips recommend() and
    // executes the named template directly. Only set for goals that name a specific template.
    const requestBody: Record<string, unknown> = {
      goal,
      tags: ["intent:topology_discovery", BOREDOM_TAG],
      variables: {
        source: "boredom-vessel",
        ...extraVariablesForGoal(goalIdx),
      },
    };
    if (targetTemplateId) {
      requestBody.targetTemplateId = targetTemplateId;
    }
    res = await fetch(`${GOAL_HOST_ENDPOINT}/run-goal`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error(`[boredom-vessel] goal-host-vessel unreachable: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!res.ok && res.status !== 202) {
    const text = await res.text().catch(() => "(no body)");
    console.error(`[boredom-vessel] goal-host-vessel HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const dispatch = await res.json() as { dispatchId?: string; executionId?: string; status?: string; error?: string };
  if (dispatch.error) {
    console.error(`[boredom-vessel] goal dispatch error: ${dispatch.error}`);
    process.exit(1);
  }

  // If synchronous response (legacy / no dispatchId), log and exit.
  if (!dispatch.dispatchId) {
    console.log(
      `[boredom-vessel] dispatched — executionId=${dispatch.executionId ?? "?"} status=${dispatch.status ?? "?"}`,
    );
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
      process.exit(poll.status === "failed" ? 1 : 0);
    }
  }
  // Systemd will kill us at TimeoutStartSec=600; goal continues async.
  console.log(`[boredom-vessel] poll budget exhausted — goal continuing async, dispatchId=${dispatchId}`);
  process.exit(0);
}

await main();

export {};
