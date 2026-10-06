"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const DEV = process.env["DEV_VESSEL_ENDPOINT"] || process.env["DEVELOPMENT_VESSEL_URL"] || "http://127.0.0.1:8090";
const RESOLVE = DEV.replace(/\/$/, "") + "/v2/impulses/resolve";
// The service key the unit's EnvironmentFile carries; development-vessel authenticates write-type
// pointers (every *_write shape) against identity-vessel, so a write without it is answered 401.
const KEY = process.env.METABOB_API_KEY ?? "";
/**
 * HISTORY (superseded 2026-10-06, see AFFORDABILITY IS THE CONDUCTOR'S TO MEASURE below).
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
 * So the sensor WAS normalised here, in the bootstrap-tier caller, and passed through the
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
// AFFORDABILITY IS THE CONDUCTOR'S TO MEASURE (2026-10-06). This script used to compute the per-core
// load-average bucket above and PIN it as bucket_load. A load average does not measure contention on a
// workstation: node1 read load 23-25 on 16 cores (bucket 2) and enqueued nothing for ~8 h while PSI said
// the host was idle. rhythm_conductor_tick (development-vessel 5691816e) now buckets on PSI cpu/io "some
// avg60" against a shaped threshold and falls back to per-core load only when PSI is unreadable; this
// script no longer pins a bucket, and journals what the conductor measured.
/**
 * CONDITION-DRIVEN CADENCE: RAISE FEDERATION STALENESS WHEN THE SUBSTRATE CHANGES.
 *
 * With the affordability gate repaired, the federation-verification family comes due on a
 * purely TIME-driven trajectory — roughly every 2.2 hours whether or not anything happened.
 * That is a clock wearing a condition's clothes, and it misses the case the whole
 * self-verification requirement exists for: the substrate edits itself, and a cutover —
 * units going up, restarting, being masked, stopping — is exactly when federation breaks.
 * An idle substrate and one mid-cutover get the same check interval.
 *
 * Law 5 says boredom is "select what to do from current conditions". So the CONDITION is
 * sampled here and written into the pool as staleness, which is the shape the selector
 * already reads at use time. No new scheduler, no new timer, no change to the due formula:
 * the same selector makes the same decision against a sensor that now reflects reality.
 *
 * The signal is deliberately narrow — restarts of units a federation verdict depends on,
 * and the set of peer substrates present. A trainer restarting is not a reason to
 * re-verify the overlay; the transport restarting, or a peer arriving or departing, is.
 *
 * DEBOUNCED. A rolling restart touches several units in a minute, and each touch would
 * otherwise re-raise staleness and queue another sweep on top of one already running. A
 * change only raises staleness if the last raise was more than MIN_RAISE_GAP_MS ago, so a
 * cutover produces one prompt sweep rather than a burst.
 */
const CHANGE_STATE = process.env["RHYTHM_CHANGE_STATE"] || "/workspace/rhythm-change-state.json";
const MIN_RAISE_GAP_MS = Number(process.env["RHYTHM_MIN_RAISE_GAP_MS"] || 900_000);
const FED_UNITS = [
    "federation-transport-vessel.service",
    "federation-relay.service",
    "discovery-vessel.service",
    "goal-host-vessel.service",
];
function federationChangeSignature() {
    const { execFileSync } = require("node:child_process");
    const parts = [];
    for (const u of FED_UNITS) {
        try {
            const out = String(execFileSync("systemctl", ["show", u, "-p", "MainPID", "-p", "NRestarts"], { encoding: "utf-8", timeout: 5000 }));
            parts.push(u + "=" + out.replace(/\s+/g, ","));
        }
        catch {
            parts.push(u + "=?");
        }
    }
    return parts.join("|");
}
async function raiseFederationStalenessOnChange() {
    const fs = require("node:fs");
    const sig = federationChangeSignature();
    let prev = {};
    try {
        prev = JSON.parse(fs.readFileSync(CHANGE_STATE, "utf-8"));
    }
    catch { /* first run */ }
    const changed = prev.sig !== undefined && prev.sig !== sig;
    const sinceRaise = Date.now() - (prev.raised_at ?? 0);
    let action = changed ? (sinceRaise < MIN_RAISE_GAP_MS ? "debounced" : "raised") : "no_change";
    if (action === "raised") {
        try {
            const r = await fetch(RESOLVE, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
                body: JSON.stringify({ impulse: { type: "poolImpulse", shape: "timeShapedRhythm", limit: 50 } }),
                signal: AbortSignal.timeout(8000),
            });
            const j = (await r.json());
            const row = (j?.body?.impulses ?? []).find((i) => i?.body?.family === "federation-verification");
            if (row) {
                await fetch(RESOLVE, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
                    body: JSON.stringify({ impulse: { type: "poolImpulse_write", id: row.id, shape: "timeShapedRhythm", source: "rhythm-conduct-change-signal", body: { ...row.body, staleness: 1 } } }),
                    signal: AbortSignal.timeout(8000),
                });
            }
            else {
                action = "family_absent";
            }
        }
        catch {
            action = "raise_failed";
        }
    }
    try {
        fs.writeFileSync(CHANGE_STATE, JSON.stringify({ sig, raised_at: action === "raised" ? Date.now() : (prev.raised_at ?? 0) }));
    }
    catch { /* best effort */ }
    return action;
}
async function main() {
    const changeAction = await raiseFederationStalenessOnChange();
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 30_000);
    try {
        const r = await fetch(RESOLVE, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
            body: JSON.stringify({ impulse: { type: "rhythm_conductor_tick" } }),
            signal: c.signal,
        });
        const j = (await r.json());
        const b = j?.body ?? {};
        const enq = Array.isArray(b["enqueued"]) ? b["enqueued"] : [];
        const skip = Array.isArray(b["skipped"]) ? b["skipped"] : [];
        const load = b["bucket_load"];
        const ceiling = typeof load === "number" ? (1 - load / 3).toFixed(3) : "?";
        console.log(`[rhythm-conduct] considered=${b["considered"] ?? "?"} enqueued=${enq.length} skipped=${skip.length} ` +
            `drained=${b["drained"] ?? "?"} bucket_load=${load ?? "?"} affordability_ceiling=${ceiling} ` +
            `(load_source=${b["load_source"] ?? "?"} psi_cpu=${b["psi_cpu"] ?? "?"} psi_io=${b["psi_io"] ?? "?"} ` +
            `load=${b["load"] ?? "?"} cores=${b["cores"] ?? "?"} psi_fallback=${b["psi_fallback"] ?? "?"}) ` +
            `federation_change=${changeAction}`);
        if (enq.length > 0)
            console.log(`[rhythm-conduct] enqueued: ${JSON.stringify(enq).slice(0, 400)}`);
        if (skip.length > 0)
            console.log(`[rhythm-conduct] skipped: ${JSON.stringify(skip).slice(0, 400)}`);
        // An idle tick is the expected steady state, but say so rather than exiting silent.
        if (enq.length === 0 && skip.length === 0) {
            console.log(`[rhythm-conduct] nothing enqueued and nothing recorded as skipped — either no family was due, ` +
                `or every due family was priced out by the affordability ceiling. The conductor does not report ` +
                `a per-family reason, so this line is the only record that the tick ran at all.`);
        }
    }
    finally {
        clearTimeout(t);
    }
}
main().catch((e) => {
    console.error("[rhythm-conduct] failed:", e instanceof Error ? e.message : String(e));
    process.exit(1);
});
//# sourceMappingURL=rhythm-conduct-tick.js.map