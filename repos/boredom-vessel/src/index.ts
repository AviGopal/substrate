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

// Rotating set of topology-discovery goals. Thompson Sampling will learn which
// templates satisfy these goals and rank them over time.
const AUTONOMOUS_GOALS: readonly string[] = [
  "measure the substrate topology and report coverage progress",
  "probe unlearned shapes — find templates that have no execution traces and recommend the best one to run",
  "check substrate health and report on posterior confidence and graph stability",
  "identify shapes in the execution graph that have no known producer and escalate the most critical one",
  "run the full topology discovery chain and emit a coverage report",
];

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

async function main(): Promise<void> {
  console.log("[boredom-vessel] tick start");

  const idle = await isIdle();
  if (!idle) {
    console.log("[boredom-vessel] substrate busy — no autonomous goal dispatched");
    process.exit(0);
  }

  const goalIdx = await nextGoalIndex();
  const goal = AUTONOMOUS_GOALS[goalIdx]!;
  console.log(`[boredom-vessel] submitting goal[${goalIdx}]: "${goal}"`);

  let res: Response;
  try {
    res = await fetch(`${GOAL_HOST_ENDPOINT}/run-goal`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        goal,
        variables: {
          intent_tag: "topology_discovery",
          source: "boredom-vessel",
        },
      }),
    });
  } catch (err) {
    console.error(`[boredom-vessel] goal-host-vessel unreachable: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    console.error(`[boredom-vessel] goal-host-vessel HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const body = await res.json() as { executionId?: string; status?: string; error?: string };
  if (body.error) {
    console.error(`[boredom-vessel] goal dispatch error: ${body.error}`);
    process.exit(1);
  }

  console.log(
    `[boredom-vessel] dispatched — executionId=${body.executionId ?? "?"} status=${body.status ?? "?"}`,
  );
  process.exit(0);
}

await main();

export {};
