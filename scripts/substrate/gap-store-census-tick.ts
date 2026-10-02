/**
 * gap-store-census-tick.ts — a detector for the SILENT-STORE-COLLAPSE class.
 *
 * Measured 2026-09-09: the gap store served 4,113 gaps at 14:35 and 44 at 22:59,
 * across a development-vessel restart. Nothing reported it. It was recovered only
 * because an operator happened to look, and because ~50 orphaned atomic-write
 * temps (~300MB, themselves a disk leak) still held parseable snapshots. Law 7
 * measures progress as the gap triple — close rate, latency, durability — and for
 * several hours that triple was being computed over a store that had silently
 * lost 97% of its rows.
 *
 * WHY A COUNT AND NOT A WRITE GUARD. The write path is already correct atomic
 * practice: a per-writer unique tmp, an in-process read-modify-write lock, then
 * rename. What that cannot defend against is writing the WRONG CONTENT
 * atomically — a partial load followed by a save replaces a good file with a
 * small one, durably and without error. Refusing such a write is the real repair,
 * but a guard that can reject gap writes is the same shape as the inverted
 * boolean that once discarded every gap write, and the deadlock it creates is
 * unfixable from inside: you cannot file a gap about not being able to file gaps.
 * So this observes and reports; changing write semantics is an operator decision.
 *
 * IT ASKS THE STORE, NOT THE FILESYSTEM. WORKSPACE_ROOT differs between this
 * script's environment and the vessel process's, and there are at least four
 * stale gaps.json copies on the box — one with a fresh mtime over July records.
 * Reading "the" file is how a false two-day-persistence-failure nearly got
 * published. The count therefore comes from the resolver that serves gaps, which
 * is by definition the copy the substrate actually uses.
 *
 * THE BASELINE IS A HIGH-WATER MARK, NOT AN AVERAGE. Closing a gap does not
 * remove its row — closed gaps persist with status "closed" — so this series
 * should be monotonic apart from deliberate pruning. Any prior census is
 * therefore positive evidence that the store DID hold that many, and a drop below
 * it is not variance. Averaging would let a collapse lower the very bar it is
 * later judged against, the same contamination compose-drift-tick avoids by using
 * a median rather than pooled counts.
 *
 * META-GUARD (a detector must be proven to COMPLETE, not merely to exist): with
 * no usable census history it says so and abstains rather than reporting health,
 * and it records every reading so the first real collapse has something to be
 * measured against.
 *
 * Strictly read-only except its own census file and substrateGap emission.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DEV = process.env.DEV_VESSEL_ENDPOINT || process.env.DEVELOPMENT_VESSEL_URL || "http://127.0.0.1:8090";
/** The census lives outside the gap store: a store that loses itself must not
 *  also lose the record proving it did. */
const CENSUS_PATH =
  process.env.GAP_CENSUS_PATH || join(process.env.SUBSTRATE_STATE_DIR || "/workspace/substrate/state", "gap-store-census.jsonl");
/** Readings older than this do not constrain today's expectation. */
const HISTORY_DAYS = 14;
/** Below this the store is too small for a proportional test to mean anything. */
const MIN_HIGH_WATER = 100;
/** A drop past this fraction of the high-water mark is a collapse, not attrition. */
const COLLAPSE_FRACTION = 0.5;

type Census = { at: string; count: number };

async function gapCount(): Promise<number | null> {
  try {
    const resp = await fetch(`${DEV}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `total` in the response reflects the RETURNED PAGE, not the store, so it
      // cannot be used as a count. The rows themselves must be counted.
      //
      // AND NOT falsifier_coverage EITHER, though it is tempting: it IS computed
      // store-wide (identical at limit 1 and limit 100000, verified 2026-09-10),
      // which would make this check nearly free. But it covers only the OPEN
      // population, and closing a gap moves it out of that population — so the
      // series would not be monotonic, and an ordinary closing sweep would read
      // as a collapse. The whole basis of the high-water comparison below is that
      // rows do not leave. Paying for the full row count is what buys that.
      body: JSON.stringify({ impulse: { type: "substrateGap", limit: 1_000_000 } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { body?: { gaps?: unknown[] } };
    const gaps = json.body?.gaps;
    return Array.isArray(gaps) ? gaps.length : null;
  } catch {
    return null;
  }
}

function readCensus(): Census[] {
  if (!existsSync(CENSUS_PATH)) return [];
  const cutoff = Date.now() - HISTORY_DAYS * 86400_000;
  const out: Census[] = [];
  for (const line of readFileSync(CENSUS_PATH, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Census;
      if (typeof r.count === "number" && Date.parse(r.at) >= cutoff) out.push(r);
    } catch {
      /* a truncated line is not a reason to lose the rest of the history */
    }
  }
  return out;
}

function appendCensus(count: number): void {
  try {
    mkdirSync(dirname(CENSUS_PATH), { recursive: true });
    appendFileSync(CENSUS_PATH, JSON.stringify({ at: new Date().toISOString(), count }) + "\n");
  } catch (e) {
    console.warn(`[gap-census] could not record reading: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function emitGap(id: string, summary: string, meta: Record<string, unknown>): Promise<void> {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      impulse: {
        type: "substrateGap_write",
        gap: { id, status: "open", category: "instrumentation_gap", source: "substrate_detected", summary, classification_metadata: meta },
      },
    }),
  }).catch(() => undefined);
}

async function main(): Promise<void> {
  const count = await gapCount();
  if (count === null) {
    // Do NOT emit a gap here: the store is exactly what is unreachable, so the
    // emission would be lost too. Fail loudly to the journal instead.
    console.error("[gap-census] gap store unreachable or returned an unusable shape — no reading taken");
    process.exit(1);
  }

  const history = readCensus();
  appendCensus(count);

  if (history.length === 0) {
    console.log(`[gap-census] first reading: ${count} gap(s) — no history to judge against yet, recorded for next time`);
    return;
  }

  const highWater = Math.max(...history.map((h) => h.count));
  const peak = history.find((h) => h.count === highWater)!;

  if (highWater < MIN_HIGH_WATER || count >= highWater * COLLAPSE_FRACTION) {
    console.log(`[gap-census] OK — ${count} gap(s) against a ${HISTORY_DAYS}d high-water mark of ${highWater} (${history.length} reading(s))`);
    return;
  }

  await emitGap(
    "gap-store-collapsed-against-its-own-high-water-mark",
    `The gap store now serves ${count} gap(s). Within the last ${HISTORY_DAYS} days it served ${highWater} (recorded ${peak.at}), so it has lost roughly ${Math.round((1 - count / highWater) * 100)}% of its rows.\n\n` +
      `THIS IS NOT ATTRITION. Closing a gap does not remove its row — closed gaps persist with status "closed" — so this series is expected to be monotonic apart from deliberate pruning. A drop of this size means rows that existed are no longer being served.\n\n` +
      `PRECEDENT (2026-09-09): the store served 4,113 gaps at 14:35 and 44 at 22:59 across a development-vessel restart, and nothing reported it. The write path is correct atomic practice — unique per-writer tmp, in-process read-modify-write lock, then rename — so the likely mechanism is not a torn rename but a PARTIAL LOAD followed by a save, which atomically replaces a good file with a small one. Recovery that day came from orphaned atomic-write temps (gaps.json.<pid>.<n>.tmp) that had never been renamed, plus a pre-merge backup.\n\n` +
      `FIRST DIAGNOSTIC STEPS, in order: (1) do NOT write to the store until this is resolved — a save now will make the small state canonical; (2) read WORKSPACE_ROOT from the VESSEL process (/proc/<MainPID>/environ), because several stale gaps.json copies exist on the box and one carries a fresh mtime over months-old records; (3) look for unrenamed .tmp siblings of the live gaps.json, newest parseable first; (4) re-read the store immediately before any repair write — a store mid-recovery is indistinguishable from one that lost data, and a merge computed against the wrong snapshot restores nothing.\n\n` +
      `CONSEQUENCE FOR LAW 7: the gap triple (close rate, latency, durability) is computed over this store. Any closure statistic spanning the loss window is measuring a store that changed size underneath it.`,
    {
      detector: "gap-store-census-tick",
      count,
      high_water: highWater,
      high_water_at: peak.at,
      readings: history.length,
      falsifier: "class2",
      evidence_resolve: { shape: "substrateGap" },
      measurement: `count of rows served by the substrateGap resolver falls below ${COLLAPSE_FRACTION} of the highest count observed in the preceding ${HISTORY_DAYS} days, with that high-water mark at least ${MIN_HIGH_WATER}`,
    },
  );
  console.log(`[gap-census] COLLAPSE ${count} vs high-water ${highWater} (${peak.at})`);
}

main().catch((e) => {
  console.error("[gap-census] failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
