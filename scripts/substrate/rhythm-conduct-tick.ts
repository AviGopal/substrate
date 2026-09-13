/**
 * rhythm-conduct-tick.ts — run the rhythm conductor from the bootstrap tier.
 *
 * WHY THIS EXISTS. `rhythm_conductor_tick` is the component that reads the rhythm
 * registry, scores each family's due-ness and enqueues what is due. It was registered
 * only as `satisfier:rhythm_conductor_tick` — a Thompson-selected activity — so it ran
 * when selection happened to pick it: **11 executions ever**, the last 53 hours before
 * this file was written. Cadence therefore depended on the selection drift it exists to
 * correct, and when it stopped it emitted silence, which reads as health.
 *
 * CLAUDE.md already states the principle, as its reason for exempting the liveness
 * watchdogs from the script-retention rule: "a check cannot be scheduled by the mechanism
 * it exists to recover." A SCHEDULER cannot be scheduled by the thing it schedules. This
 * is that stated bootstrap-tier exception, not a new carve-out.
 *
 * IT PRINTS THE COUNTS, DELIBERATELY. The conductor can decline every rhythm and return
 * `considered: 11, enqueued: [], skipped: []` — from outside, "nothing was due",
 * "everything was unaffordable" and "it crashed" are indistinguishable. Putting
 * considered/enqueued/skipped/bucket_load in the journal makes an idle tick legible as
 * idle rather than as absent.
 *
 * Read-only with respect to source; its only effects are the conductor's own enqueues.
 */

const DEV = process.env["DEV_VESSEL_ENDPOINT"] || process.env["DEVELOPMENT_VESSEL_URL"] || "http://127.0.0.1:8090";
const RESOLVE = DEV.replace(/\/$/, "") + "/v2/impulses/resolve";

/**
 * THE AFFORDABILITY GATE WAS MEASURING THE WRONG THING, AND IT HAD CLOSED PERMANENTLY.
 *
 * `bucketLoadFromProc` in the conductor buckets the RAW 1-minute load average:
 * `<1 -> 0, <3 -> 1, <8 -> 2, else 3`. Those thresholds are absolute — they do not know
 * how many cores the host has. Affordability is `budget <= 1 - bucketLoad/3`, so at
 * bucket 3 the ceiling is exactly 0 and NO family with a positive budget can ever be
 * selected. The whole cadence layer stops.
 *
 * Measured on this host: 16 cores, load 9.61 — about 60% utilised, entirely healthy — and
 * `rhythm_conductor_tick` returned `bucket_load: 3, enqueued: []`. The federation
 * verification family fired ONCE in 33 hours, and every other family showed the same
 * starvation. A load of 8 is "maximum congestion" on a 16-core box, which is half its
 * capacity.
 *
 * So the sensor is normalised here, in the bootstrap-tier caller, and passed through the
 * `bucket_load` pointer field the conductor already accepts for exactly this purpose.
 * THE GUARD IS NOT REMOVED — a genuinely saturated host still buckets to 3 and still
 * prices families out. What changes is that "saturated" now means per-core saturation
 * rather than a constant that happens to be true of a 4-core VM and permanently true of
 * a workstation. Same thresholds, divided by cores.
 *
 * This is the same shape as two other defects found in this subsystem: a guard that never
 * opens is not conservative, it is inert; and a discriminator that measures the wrong
 * quantity is worse than a missing one, because it reports confidently.
 */
function normalisedBucketLoad(): { bucket: number; load: number; cores: number } {
  try {
    const load = parseFloat(require("node:fs").readFileSync("/proc/loadavg", "utf-8").split(/\s+/)[0] ?? "0");
    const cores = Math.max(1, require("node:os").cpus().length);
    const per = load / cores;
    // Same shape as the conductor's own ladder, expressed per-core: a box is "busy" at
    // ~1 runnable process per core, and saturated at ~2.
    const bucket = per < 0.25 ? 0 : per < 0.75 ? 1 : per < 2 ? 2 : 3;
    return { bucket, load, cores };
  } catch {
    return { bucket: 0, load: 0, cores: 1 };
  }
}

async function main(): Promise<void> {
  const nb = normalisedBucketLoad();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 30_000);
  try {
    const r = await fetch(RESOLVE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "rhythm_conductor_tick", bucket_load: nb.bucket } }),
      signal: c.signal,
    });
    const j = (await r.json()) as { body?: Record<string, unknown> };
    const b = j?.body ?? {};
    const enq = Array.isArray(b["enqueued"]) ? (b["enqueued"] as unknown[]) : [];
    const skip = Array.isArray(b["skipped"]) ? (b["skipped"] as unknown[]) : [];
    const load = b["bucket_load"];
    const ceiling = typeof load === "number" ? (1 - load / 3).toFixed(3) : "?";
    console.log(
      `[rhythm-conduct] considered=${b["considered"] ?? "?"} enqueued=${enq.length} skipped=${skip.length} ` +
        `drained=${b["drained"] ?? "?"} bucket_load=${load ?? "?"} affordability_ceiling=${ceiling} ` +
        `(load=${nb.load.toFixed(2)} cores=${nb.cores} per_core=${(nb.load / nb.cores).toFixed(2)} -> bucket ${nb.bucket}; ` +
        `raw-load bucketing would have said ${nb.load < 1 ? 0 : nb.load < 3 ? 1 : nb.load < 8 ? 2 : 3})`,
    );
    if (enq.length > 0) console.log(`[rhythm-conduct] enqueued: ${JSON.stringify(enq).slice(0, 400)}`);
    if (skip.length > 0) console.log(`[rhythm-conduct] skipped: ${JSON.stringify(skip).slice(0, 400)}`);
    // An idle tick is the expected steady state, but say so rather than exiting silent.
    if (enq.length === 0 && skip.length === 0) {
      console.log(
        `[rhythm-conduct] nothing enqueued and nothing recorded as skipped — either no family was due, ` +
          `or every due family was priced out by the affordability ceiling. The conductor does not report ` +
          `a per-family reason, so this line is the only record that the tick ran at all.`,
      );
    }
  } finally {
    clearTimeout(t);
  }
}

main().catch((e) => {
  console.error("[rhythm-conduct] failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
