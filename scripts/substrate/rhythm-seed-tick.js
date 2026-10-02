"use strict";
/**
 * rhythm-seed-tick.ts — restore the time-shaped rhythm registry if it is empty.
 *
 * WHY THIS EXISTS. Law 5 puts cadence in the pool as time-shaped rhythm impulses that
 * rhythm_conductor_tick reads, scores by due-ness and enqueues. On 2026-09-07 thirteen
 * rhythms were seeded BY HAND and verified end to end. No script was retained, so when
 * a power outage recreated the pool on 2026-09-09 the registry came back EMPTY and
 * nothing noticed: a conductor with no rhythms is silent, and silence reads as health.
 * Meanwhile validator-liveness files a recurring validator-cadence-severed gap that
 * nothing can service while the conductor has nothing to make due.
 *
 * THIS IS RESTORATION, NOT NEW POLICY — EXCEPT WHERE AN ENTRY IS EXPLICITLY FLAGGED
 * "NEW POLICY" IN A COMMENT ON THE ENTRY ITSELF. Every unflagged body below is recovered
 * VERBATIM from the pre-outage pool snapshot (/workspace/pool/standing.json,
 * 2026-09-07T04:33Z) — the same families, budgets, credit and staleness that were already
 * approved and running. No budget was invented in the restored set. In this scheduler
 * budget is COST (due = credit_mean * staleness / budget; affordable iff
 * budget <= 1 - load/3), so a fabricated budget would silently re-prioritise the whole
 * fleet — which is exactly why a newly-authored budget must be flagged rather than
 * smuggled in under the restoration claim. Flagged entries state their own rationale.
 *
 * IDEMPOTENT BY CONSTRUCTION. It reads the registry through the CONDUCTOR OWN read path
 * and writes nothing if any rhythm already exists, so it is safe on every tick and cannot
 * fight a live conductor or double-seed.
 *
 * IT JOURNALS WHAT IT SEEDED, deliberately: the 09-07 seeding left no record, which is
 * why the loss was unrecoverable rather than merely inconvenient. The next recovery can
 * diff against this log.
 *
 * NOTE ON COVERAGE, stated rather than discovered later: the conductor maps family -> goal
 * from its bootstrap FAMILY_GOALS const, extended at runtime by rhythmFamilyGoal impulses.
 * Of the eleven restored families, capability-census and validation carry their mappings
 * below. concept-management has NO mapping in either place and will be skipped
 * no_goal_mapping until one is supplied — recorded, not invented.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const DEV = process.env["DEV_VESSEL_ENDPOINT"] || process.env["DEVELOPMENT_VESSEL_URL"] || "http://127.0.0.1:8090";
const RESOLVE = DEV.replace(/\/$/, "") + "/v2/impulses/resolve";
const SEED = {
    "rhythms": [
        {
            "id": "rhythm-reality-modeling",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "reality",
                "axis_code": 1,
                "family": "reality-modeling",
                "paces": "stateSpaceSignature",
                "budget": 0.15,
                "alpha": 56,
                "beta": 1,
                "staleness": 0.07648698835078825,
                "transient": false,
                "description": "Refresh world-model (state signature + observers). Cheap, high-cadence, the conductors senses."
            }
        },
        {
            "id": "rhythm-data-management",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "freshness",
                "axis_code": 2,
                "family": "data-management",
                "budget": 0.3,
                "alpha": 28.5,
                "beta": 1,
                "staleness": 0.09329777398749518,
                "paces": "docs/vault reconciliation"
            }
        },
        {
            "id": "rhythm-gap-closing",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "gap",
                "axis_code": 3,
                "family": "gap-closing",
                "budget": 0.4,
                "alpha": 755,
                "beta": 2,
                "staleness": 1,
                "paces": "gap drain"
            }
        },
        {
            "id": "rhythm-pattern-mining",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "pattern",
                "axis_code": 4,
                "family": "pattern-mining",
                "paces": "recurringPatternCluster",
                "budget": 0.35,
                "alpha": 17.5,
                "beta": 1,
                "staleness": 0.13321127370360672,
                "transient": false,
                "description": "signature_cluster_scan/trace_recurring_pattern_scan -> concept-from-pattern. Slow."
            }
        },
        {
            "id": "rhythm-human-interacting",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "presence",
                "axis_code": 5,
                "family": "human-interacting",
                "paces": "obsidian_deliver_assist",
                "budget": 0.5,
                "alpha": 13,
                "beta": 1,
                "staleness": 0.16639944395833334,
                "transient": false,
                "description": "presence-conditioned obsidian solicitation/assist. Due only when an operator surface is present."
            }
        },
        {
            "id": "rhythm-concept-management",
            "shape": "timeShapedRhythm",
            "body": {
                "family": "concept-management",
                "axis": "freshness",
                "staleness": 0.12480182431256581,
                "budget": 0.3,
                "alpha": 25,
                "beta": 1
            }
        },
        {
            "id": "rhythm-project-intake",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "freshness",
                "axis_code": 2,
                "family": "project-intake",
                "budget": 0.2,
                "alpha": 38.5,
                "beta": 1,
                "staleness": 0.07012560427700873,
                "paces": "Substrate/Projects pickup — human project items become goals",
                "description": "Scan Substrate/Projects for open To do items and execute project plans (dispatch + mark). Condition-driven human-intake rhythm."
            }
        },
        {
            "id": "rhythm-view-exercise",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "presence",
                "axis_code": 5,
                "family": "view-exercise",
                "paces": "obsidian view legibility + availability check",
                "budget": 0.35,
                "alpha": 17,
                "beta": 1,
                "staleness": 0.13005882008555253,
                "transient": false,
                "description": "Presence-conditioned exercise of the obsidian goal-dispatch views: screenshot the panel, run legibility sensors, verify the newest dispatch note renders verdict + Why, file defects as gaps. Keeps the human-facing surfaces working and honest."
            }
        },
        {
            "id": "rhythm-self-maintenance",
            "shape": "timeShapedRhythm",
            "body": {
                "family": "self-maintenance",
                "budget": 0.3,
                "alpha": 9.5,
                "beta": 1,
                "staleness": 0.1107819177518311
            }
        },
        {
            "id": "rhythm-capability-census",
            "shape": "timeShapedRhythm",
            "body": {
                "family": "capability-census",
                "axis": "freshness",
                "budget": 0.15,
                "alpha": 13,
                "beta": 1,
                "staleness": 0.05388482882734058,
                "paces": "capability census: per-activity 7d execution evidence + orphaned capability surface"
            }
        },
        {
            "id": "a7ba7920-4a99-4bdf-ac7d-75ae4c919e50",
            "shape": "timeShapedRhythm",
            "body": {
                "family": "validation",
                "axis": "freshness",
                "budget": 0.2,
                "alpha": 10,
                "beta": 1,
                "staleness": 0.0663229265028414,
                "paces": "self-validation cycle"
            }
        },
        // ───────────────────────────────────────────────────────────────────────────────
        // NEW POLICY, NOT RESTORATION. This family did not exist before the outage and is
        // NOT in the 2026-09-07 snapshot. Every number below was AUTHORED (2026-09-12), not
        // recovered — the file's restoration claim above does not cover it, which is why it
        // carries this flag.
        //
        // WHY 0.12 — budget is COST, not allowance. due = credit_mean * staleness /
        // max(budget, 0.05), and a family is affordable only while budget <= 1 - load/3. So a
        // cheap family comes due often AND survives load; an expensive one is priced out
        // first when the substrate is busy. Federation verification that gets priced out
        // exactly when the substrate is churning would be useless, because CHURN IS WHEN
        // FEDERATION BREAKS — vessels restart, get masked, lose their relay reservation, and
        // the overlay goes dark precisely during self-edit. 0.12 is the cheapest budget in
        // the registry (below reality-modeling's 0.15) and stays affordable through load
        // bucket 2, so the oracle keeps sweeping through the churn it exists to observe.
        //
        // alpha/beta 1/1 is an UNINFORMED prior — no credit history is fabricated for a
        // family that has never run. staleness 1.0 means "never verified", so the first
        // conductor tick after mount scores it due (0.5 * 1.0 / 0.12 ≈ 4.2 vs threshold 1.0)
        // and it decays from there like every other family.
        //
        // axis is freshness, NOT presence: the conductor gates presence-axis rhythms on an
        // Obsidian surface being discoverable, which would silently freeze federation
        // verification whenever no human is connected — the opposite of what an autonomous
        // oracle needs.
        {
            "id": "rhythm-federation-verification",
            "shape": "timeShapedRhythm",
            "body": {
                "axis": "freshness",
                "axis_code": 2,
                "family": "federation-verification",
                "budget": 0.12,
                "alpha": 1,
                "beta": 1,
                "staleness": 1,
                "transient": false,
                "paces": "federation overlay probe sweep from a foreign vantage",
                "description": "Dial the federation overlay from an ephemeral nonce-identity libp2p peer and grade join/find/route/leave/payload invariants against the live roster. Cheapest budget in the registry on purpose: verification must stay affordable during churn, because churn is when federation breaks."
            }
        }
    ],
    "familyGoals": [
        {
            "id": "rhythm-family-goal-capability-census",
            "shape": "rhythmFamilyGoal",
            "body": {
                "family": "capability-census",
                "goal": "produce capabilityCensusReport via capability-census-tick: grouped execution counts and success counts per activity over the last 7 days from the trace store, plus the orphaned-capability surface, merged into one capabilityCensusReport impulse"
            }
        },
        {
            "id": "09ea76fc-e637-4476-8d62-5a7249777852",
            "shape": "rhythmFamilyGoal",
            "body": {
                "family": "validation",
                "goal": "run validation-goal-synth then validation-dispatch-tick then validation-grade-tick for the least-recently-validated promoted template"
            }
        },
        // NEW POLICY, NOT RESTORATION (2026-09-12) — see the rhythm entry above. This
        // mapping is LOAD-BEARING: federation-verification has no entry in the conductor's
        // bootstrap FAMILY_GOALS const, and the conductor merges pool goals OVER that const,
        // so without this row the family scores due every tick and is then skipped
        // no_goal_mapping forever — due but unmappable, which reads as silence.
        {
            "id": "rhythm-family-goal-federation-verification",
            "shape": "rhythmFamilyGoal",
            "body": {
                "family": "federation-verification",
                "goal": "Resolve the federation_verification_report shape and report the federation overlay's current state: its coverage fraction, its blocking reason, which invariants are failing, and whether the report is fresh. The shape is served by the federation transport vessel and returns the most recent report measured by an independent ephemeral libp2p peer, starting a new sweep when the last one is stale."
            }
        }
    ]
};
async function post(body, timeoutMs = 4000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    try {
        const r = await fetch(RESOLVE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: c.signal });
        return await r.json();
    }
    finally {
        clearTimeout(t);
    }
}
async function readRhythms() {
    // The CONDUCTOR own read path — checking any other store would test a different system.
    const r = await post({ impulse: { type: "poolImpulse", shape: "timeShapedRhythm", limit: 50 } });
    return r?.body?.impulses ?? [];
}
async function main() {
    const existing = await readRhythms();
    if (existing.length > 0) {
        console.log(`[rhythm-seed] registry already holds ${existing.length} rhythm(s) — no action`);
        return;
    }
    console.log("[rhythm-seed] registry EMPTY — restoring the pre-outage set");
    let wrote = 0;
    for (const r of SEED.rhythms) {
        await post({ impulse: { type: "poolImpulse_write", id: r.id, shape: "timeShapedRhythm", source: "rhythm-seed-tick", body: r.body } });
        wrote++;
        console.log(`[rhythm-seed] seeded rhythm family=${r.body.family} budget=${r.body.budget} credit=${r.body.alpha}/${r.body.beta} staleness=${r.body.staleness}`);
    }
    for (const g of SEED.familyGoals) {
        await post({ impulse: { type: "poolImpulse_write", id: g.id, shape: "rhythmFamilyGoal", source: "rhythm-seed-tick", body: g.body } });
        wrote++;
        console.log(`[rhythm-seed] seeded familyGoal family=${g.body.family}`);
    }
    // Verify at the consuming layer: re-read through the conductor path, do not trust the writes.
    const after = await readRhythms();
    console.log(`[rhythm-seed] wrote ${wrote} impulse(s); registry now reads ${after.length} rhythm(s) via the conductor read path`);
    if (after.length === 0)
        console.log("[rhythm-seed] !!! writes reported success but the registry still reads EMPTY — the write path is not landing");
}
main().catch((e) => { console.error("[rhythm-seed] failed:", e instanceof Error ? e.message : String(e)); process.exit(1); });
//# sourceMappingURL=rhythm-seed-tick.js.map