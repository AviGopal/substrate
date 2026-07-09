#!/usr/bin/env bun
/**
 * watchdog-tick.ts — degraded-mode watchdog for a demoted timer unit.
 * (openspec 2026-07-09-restore-contiguous-shape-flow, design §4)
 *
 * The event-driven drain (GapDrainObserver on development-vessel) is the PRIMARY
 * selection pathway; this tick only restarts flow when the event path has
 * demonstrably stalled. Semantics:
 *
 *   open relevant intents exist AND no corresponding flow activity for
 *   WATCHDOG_STALL_MIN minutes  ->  fire the flow's resolver ONCE (loud,
 *                                   one trace, information_yield=watchdog_restart)
 *   otherwise                   ->  exit 0 SILENTLY: no trace, no gap write,
 *                                   no resolve call, no store read beyond the
 *                                   local standing-pool file.
 *
 * Per-unit config via environment (set in the unit's run-dir/watchdog drop-in):
 *   WATCHDOG_FLOW            label for logs (e.g. "gap-compose")
 *   WATCHDOG_RESTART_IMPULSE resolver type fired on stall (e.g. "gap_to_feature")
 *   WATCHDOG_RESTART_EXEC    alternative to RESTART_IMPULSE: a script path run
 *                            once via bun on stall (for flows with no single
 *                            resolver, e.g. the boredom selector pass)
 *   WATCHDOG_RELEVANT_SHAPE  standing-pool shape that makes this flow relevant
 *                            (default "substrateGap")
 *   WATCHDOG_ROUTE_FILTER    "composable" -> relevant entries are those whose
 *                            body.route is not "dispatchable" (the event drain
 *                            owns dispatchable); "any" (default) -> any open entry
 *   WATCHDOG_STALL_MIN       minutes of no-activity that count as a stall (default 15)
 *   WATCHDOG_ACTIVITY_PATHS  colon-separated files/dirs whose mtime counts as flow
 *                            activity (default drain log + compose lessons)
 */
import { existsSync, readFileSync, statSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE = process.env.WORKSPACE_ROOT ?? "/workspace";
const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const FLOW = process.env.WATCHDOG_FLOW ?? "unnamed-flow";
const RESTART_IMPULSE = process.env.WATCHDOG_RESTART_IMPULSE ?? "";
const RESTART_EXEC = process.env.WATCHDOG_RESTART_EXEC ?? "";
const RELEVANT_SHAPE = process.env.WATCHDOG_RELEVANT_SHAPE ?? "substrateGap";
const ROUTE_FILTER = process.env.WATCHDOG_ROUTE_FILTER ?? "any";
const STALL_MIN = Number(process.env.WATCHDOG_STALL_MIN ?? "15");
const ACTIVITY_PATHS = (
  process.env.WATCHDOG_ACTIVITY_PATHS ??
  `${WORKSPACE}/pool/drain-log.jsonl:${WORKSPACE}/proposals/compose-lessons.jsonl`
).split(":").filter(Boolean);
const WATCHDOG_LOG = join(WORKSPACE, "pool", "watchdog-log.jsonl");

interface StandingImpulse {
  id: string; shape: string; body: unknown; source: string;
  status: string; injected_at: string; updated_at: string;
}

function openRelevantIntents(): StandingImpulse[] {
  const poolFile = join(WORKSPACE, "pool", "standing.json");
  if (!existsSync(poolFile)) return [];
  let all: StandingImpulse[];
  try { all = JSON.parse(readFileSync(poolFile, "utf8")); } catch { return []; }
  if (!Array.isArray(all)) return [];
  return all.filter((e) => {
    if (e.status !== "open" || e.shape !== RELEVANT_SHAPE) return false;
    if (ROUTE_FILTER === "composable") {
      const route = (e.body as Record<string, unknown> | null)?.["route"];
      return route !== "dispatchable";
    }
    return true;
  });
}

function newestActivityMs(): number {
  let newest = 0;
  for (const p of ACTIVITY_PATHS) {
    try {
      const st = statSync(p);
      let m = st.mtimeMs;
      if (st.isDirectory()) {
        for (const f of readdirSync(p)) {
          try { m = Math.max(m, statSync(join(p, f)).mtimeMs); } catch { /* skip */ }
        }
      }
      newest = Math.max(newest, m);
    } catch { /* path absent = no activity signal from it */ }
  }
  return newest;
}

async function leaseHeld(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "maintenanceLease", name } }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return false;
    const body = (await res.json())?.body ?? {};
    return body.held === true;
  } catch { return false; } // lease surface down -> fail open (watchdog may act)
}

async function main(): Promise<void> {
  const intents = openRelevantIntents();
  if (intents.length === 0) return; // silent: nothing to service

  const lastActivity = newestActivityMs();
  const stalledForMs = Date.now() - lastActivity;
  if (lastActivity > 0 && stalledForMs < STALL_MIN * 60_000) return; // silent: flow alive

  // Pausable citizen: defer while maintenance or a change-set is in flight.
  if ((await leaseHeld("trace_store")) || (await leaseHeld("change_window"))) {
    appendFileSync(WATCHDOG_LOG, JSON.stringify({
      at: new Date().toISOString(), flow: FLOW, action: "deferred_lease_held",
    }) + "\n");
    return;
  }

  const record: Record<string, unknown> = {
    at: new Date().toISOString(), flow: FLOW,
    action: "watchdog_restart", information_yield: "watchdog_restart",
    open_intents: intents.length,
    stalled_min: lastActivity > 0 ? Math.round(stalledForMs / 60_000) : null,
    restart_impulse: RESTART_IMPULSE || null,
  };
  if (RESTART_EXEC) {
    record["restart_exec"] = RESTART_EXEC;
    try {
      const proc = Bun.spawn(["/root/.bun/bin/bun", RESTART_EXEC], {
        stdout: "inherit", stderr: "inherit",
      });
      record["ok"] = (await proc.exited) === 0;
    } catch (e) {
      record["ok"] = false; record["error"] = e instanceof Error ? e.message : String(e);
    }
  } else if (!RESTART_IMPULSE) {
    record["ok"] = false; record["error"] = "no WATCHDOG_RESTART_IMPULSE or WATCHDOG_RESTART_EXEC configured";
  } else {
    try {
      const res = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impulse: { type: RESTART_IMPULSE, triggered_by: "watchdog", flow: FLOW } }),
        signal: AbortSignal.timeout(240_000),
      });
      record["ok"] = res.ok; record["http"] = res.status;
    } catch (e) {
      record["ok"] = false; record["error"] = e instanceof Error ? e.message : String(e);
    }
  }
  appendFileSync(WATCHDOG_LOG, JSON.stringify(record) + "\n");
  console.log(JSON.stringify(record)); // one loud journal line on restart only
}

await main();
