#!/usr/bin/env bun
"use strict";
/**
 * identical-failure-run-tick — hold the substrate to the operator's standing invariant:
 *
 *     "Identical failures should not be possible."
 *
 * Stated so a machine can test it: NO (activity, failure-class) PAIR SHOULD ACCUMULATE A LONG
 * RUN OF FAILURES WITHOUT SOMETHING CHANGING. A run past the bound with no open gap naming
 * that activity means the system observed the same fact N times and did nothing differently.
 * That — not the counting — is the defect.
 *
 * WHY THIS IS NOT DEDUPLICATION, which was considered and rejected. Collapsing N identical
 * failures into one would make the recurrence arithmetically invisible and would discard real
 * evidence of persistence: an activity failing right now IS less useful right now than one
 * that failed once, whatever the cause. Failures still count as independent samples exactly as
 * decided. What changes is that a RUN of them becomes a reportable condition in its own right.
 *
 * WHY IT IS A SIBLING OF THE REMEDY-LIVELOCK OBSERVER RATHER THAN A WIDENING OF IT. That
 * observer reads the gap-drain log and considers only `action:"dispatched"` entries, so its
 * universe is gap-remedy dispatches. Work driven by a timer or a rhythm never appears there
 * and is structurally invisible to it — which is exactly how a human-surface assist failed
 * every thirty minutes for two days unnoticed. This reads the execution table instead, which
 * every dispatch reaches regardless of who initiated it. The two detectors overlap by design;
 * the drain-log one knows about REMEDIES specifically, this one knows about EVERYTHING.
 *
 * ON "IDENTICAL": grouping is by (activity_id, failure class), where the class is the recorded
 * failure_mode type and `unclassified` when none was recorded. That is deliberately coarse. A
 * finer key would split a genuine run across several buckets and hide it, which is the failure
 * this exists to prevent. Coarse grouping over-reports; fine grouping under-reports; only one
 * of those is self-correcting when a human reads it.
 *
 * READ-ONLY except for gap emission. Never throws into its caller.
 *
 * Env (bootstrap tier only — endpoints and thresholds, no behavioural gating):
 *   IFR_WINDOW_HOURS   lookback window            (default 24)
 *   IFR_MIN_RUN        run length that trips it   (default 25)
 *   DEV_VESSEL_ENDPOINT / SURREALDB_URL           (defaults match the fleet)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const WINDOW_HOURS = Number(process.env["IFR_WINDOW_HOURS"] ?? 24);
const MIN_RUN = Number(process.env["IFR_MIN_RUN"] ?? 25);
const DEV_VESSEL = process.env["DEV_VESSEL_ENDPOINT"] ?? "http://127.0.0.1:8090";
const SURREAL = process.env["SURREALDB_URL"] ?? "http://127.0.0.1:8000";
const NS = process.env["SURREALDB_NAMESPACE"] ?? "activity-system";
const DB = process.env["SURREALDB_DATABASE"] ?? "learning_loop";
const USER = process.env["SURREALDB_USERNAME"] ?? "root";
const PASS = process.env["SURREALDB_PASSWORD"] ?? "";
async function sql(q) {
    const r = await fetch(`${SURREAL}/sql`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`,
            "surreal-ns": NS,
            "surreal-db": DB,
            Accept: "application/json",
            "Content-Type": "text/plain",
        },
        body: q,
        signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok)
        throw new Error(`sql ${r.status}`);
    const j = (await r.json());
    const first = j[0];
    if (!first || first.status !== "OK")
        throw new Error(`sql not OK: ${JSON.stringify(first).slice(0, 200)}`);
    return Array.isArray(first.result) ? first.result : [];
}
/** Open gaps whose text names this activity — the "did anything change?" half of the invariant. */
async function hasOpenGapNaming(activityId) {
    try {
        const r = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ impulse: { type: "substrateGap", status: "open", limit: 400 } }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!r.ok)
            return true; // cannot tell -> assume covered; never mint noise on a failed probe
        const j = (await r.json());
        const gaps = j?.body?.gaps ?? [];
        return gaps.some((g) => JSON.stringify(g).includes(activityId));
    }
    catch {
        return true; // fail QUIET: an unreachable gap store must not produce a flood of new gaps
    }
}
async function main() {
    let rows;
    try {
        rows = await sql(`SELECT activity_id, failure_mode.type AS ftype, count() AS n FROM execution ` +
            `WHERE success = false AND created_at > time::now() - ${WINDOW_HOURS}h ` +
            `GROUP BY activity_id, ftype;`);
    }
    catch (e) {
        // A detector that cannot read its own input must say so rather than exit clean — a silent
        // skip is indistinguishable from "nothing was wrong", which is the failure mode this
        // whole class of tick exists to avoid.
        console.error(`[identical-failure-run] CHECKED NOTHING: ${String(e?.message ?? e)}`);
        process.exit(0);
    }
    const runs = rows
        .map((r) => {
        const o = r;
        return {
            activity_id: typeof o.activity_id === "string" ? o.activity_id : "",
            failure_class: typeof o.ftype === "string" && o.ftype.length > 0 ? o.ftype : "unclassified",
            n: typeof o.n === "number" ? o.n : 0,
        };
    })
        .filter((r) => r.activity_id.length > 0 && r.n >= MIN_RUN)
        .sort((a, b) => b.n - a.n);
    if (runs.length === 0) {
        console.log(`[identical-failure-run] no (activity, failure-class) run reached ${MIN_RUN} in ${WINDOW_HOURS}h — invariant holds`);
        return;
    }
    console.warn(`[identical-failure-run] ${runs.length} run(s) at or over ${MIN_RUN} in ${WINDOW_HOURS}h: ` +
        runs.slice(0, 8).map((r) => `${r.activity_id}[${r.failure_class}]x${r.n}`).join(", "));
    for (const run of runs) {
        // The invariant is not "this failed a lot" — it is "this failed a lot AND NOTHING CHANGED".
        // An open gap naming the activity IS a disposition change, so it discharges the invariant
        // even while the failures continue.
        if (await hasOpenGapNaming(run.activity_id)) {
            console.log(`[identical-failure-run] ${run.activity_id}[${run.failure_class}] x${run.n} — an open gap already names it; invariant discharged`);
            continue;
        }
        const id = `identical-failure-run-${run.activity_id.replace(/[^a-zA-Z0-9]+/g, "-")}-${run.failure_class}`;
        const summary = `${run.activity_id} has failed ${run.n} times in the last ${WINDOW_HOURS}h under a single failure class ` +
            `(${run.failure_class}), and NO OPEN GAP NAMES IT. The count is not the defect — the defect is that the ` +
            `system observed the same fact ${run.n} times and changed nothing: it did not stop selecting the activity, ` +
            `did not open a gap against the cause, and did not try a different route. ` +
            (run.failure_class === "unclassified"
                ? `The class is UNCLASSIFIED, which compounds it: with no recorded failure mode these take the strict ` +
                    `default penalty, so an activity is being blamed ${run.n} times for a cause nobody has named. If the ` +
                    `cause is environmental, that blame is false and is paid for twice — once in the wrong penalty and ` +
                    `again in a posterior decay aggressive enough to forget it, which discards real evidence too. `
                : `The class is recorded, so the typed-delta path applies; the open question is why the repetition itself ` +
                    `never became a disposition. `) +
            `First action is to classify the failure, not to suppress the count: identical failures should not be ` +
            `possible, and where they occur they remain independent samples.`;
        try {
            const r = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    impulse: {
                        type: "substrateGap_write",
                        gap: {
                            id,
                            category: "repair_not_failure_conditioned",
                            source: "substrate_detected",
                            status: "open",
                            summary,
                            detected_at: new Date().toISOString(),
                            classification_metadata: {
                                activity_id: run.activity_id,
                                failure_class: run.failure_class,
                                run_length: run.n,
                                window_hours: WINDOW_HOURS,
                            },
                        },
                    },
                }),
                signal: AbortSignal.timeout(15_000),
            });
            console.log(`[identical-failure-run] filed ${id} (${run.n} failures) -> ${r.status}`);
        }
        catch (e) {
            console.error(`[identical-failure-run] gap emit failed for ${id}: ${String(e?.message ?? e)}`);
        }
    }
}
await main();
//# sourceMappingURL=identical-failure-run-tick.js.map