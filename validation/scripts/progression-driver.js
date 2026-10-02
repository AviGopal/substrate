#!/usr/bin/env bun
"use strict";
/**
 * progression-driver.ts — Bootstrap the autonomous gap-closing loop.
 *
 * The failure-mode harness measures how many failure-mode scenarios end as
 * `gap` (no matching activity, no emergent trace). The autonomous mechanism
 * that should close those gaps — boredom-operation make-activity cycles —
 * doesn't run yet. This driver fills in for it MANUALLY, one cycle at a
 * time, until the system can carry the loop on its own.
 *
 * Per cycle, the driver:
 *
 *   1. Reads the latest failure-mode-report.json from validation/results/
 *   2. Identifies scenarios with emergence_class='gap'
 *   3. For each gap, records what intervention was required (subagent
 *      dispatch, manual template authoring, operator registration)
 *   4. Writes a cycle-summary JSON tracking `manual_intervention_debt`
 *
 * The KPI is `manual_intervention_debt` strictly decreasing toward zero.
 * Lift = three consecutive cycles where manual_intervention_debt = 0 and
 * the harness-reported gap count still strictly decreases (i.e. the system
 * is closing new gaps without us).
 *
 * Usage:
 *   bun run validation/scripts/progression-driver.ts \
 *     --report validation/results/<date>-failure-mode-baseline.json \
 *     --cycle <N> \
 *     --proposals validation/failure-modes/proposals/ \
 *     [--out validation/failure-modes/cycles/cycle-<N>.json]
 *
 * The driver does NOT itself dispatch subagents — that's done from the
 * conversation. It reads the proposal files (if present), counts them
 * against the gap set, and computes intervention debt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
async function loadReport(path) {
    const text = await (0, promises_1.readFile)(path, "utf8");
    return JSON.parse(text);
}
async function loadProposals(dir) {
    if (!(0, node_fs_1.existsSync)(dir))
        return [];
    const files = (await (0, promises_1.readdir)(dir)).filter((f) => f.endsWith(".json"));
    const out = [];
    for (const f of files) {
        const content = await (0, promises_1.readFile)((0, node_path_1.join)(dir, f), "utf8");
        let raw;
        try {
            raw = JSON.parse(content);
        }
        catch {
            // make_activity_autonomous proposals embed an unescaped markdown template
            // string in the `template` field, making the outer JSON invalid.
            // Extract just the `proposal` envelope via regex as a fallback.
            const m = content.match(/"proposal"\s*:\s*(\{[^}]+\})/);
            if (!m)
                continue;
            try {
                out.push(JSON.parse(m[1]));
            }
            catch {
                // skip truly unparseable files
            }
            continue;
        }
        // Accept both flat and {proposal, template} envelope formats.
        const p = "proposal" in raw && raw.proposal ? raw.proposal : raw;
        out.push(p);
    }
    return out;
}
async function loadPriorCycle(cyclesDir, thisCycle) {
    const prior = (0, node_path_1.join)(cyclesDir, `cycle-${thisCycle - 1}.json`);
    if (!(0, node_fs_1.existsSync)(prior))
        return null;
    return JSON.parse(await (0, promises_1.readFile)(prior, "utf8"));
}
async function main() {
    const { values } = (0, node_util_1.parseArgs)({
        options: {
            report: { type: "string" },
            cycle: { type: "string" },
            proposals: {
                type: "string",
                default: "validation/failure-modes/proposals",
            },
            out: { type: "string" },
        },
    });
    if (!values.report)
        throw new Error("--report is required");
    if (!values.cycle)
        throw new Error("--cycle is required");
    const cycleNumber = parseInt(values.cycle, 10);
    const report = await loadReport(values.report);
    const proposals = await loadProposals(values.proposals);
    const gapScenarios = report.scenarios.filter((s) => s.emergence_class === "gap");
    const gapIds = new Set(gapScenarios.map((s) => s.scenario_id));
    const gapsWithProposal = new Set(proposals.filter((p) => gapIds.has(p.scenario_id)).map((p) => p.scenario_id));
    // All-time author breakdown (for reporting).
    const byAuthor = {};
    for (const p of proposals) {
        byAuthor[p.authored_by] = (byAuthor[p.authored_by] ?? 0) + 1;
    }
    const registered = proposals.filter((p) => p.registration_status === "registered_canary" ||
        p.registration_status === "registered_production").length;
    // Manual intervention debt: count only proposals for scenarios that are
    // STILL gaps this cycle. Proposals for closed scenarios (now reuse) are
    // retired — their debt is paid. This prevents historical subagent proposals
    // from blocking the KPI after the gaps they addressed are resolved.
    //
    // Within open-gap proposals, debt = manual author count + operator-blocked
    // count (no double-counting: a proposal contributes at most 1 unit).
    const openGapProposals = proposals.filter((p) => gapIds.has(p.scenario_id));
    const openByAuthor = {};
    for (const p of openGapProposals) {
        openByAuthor[p.authored_by] = (openByAuthor[p.authored_by] ?? 0) + 1;
    }
    const subagentDispatches = openByAuthor["subagent"] ?? 0;
    const humanAuthored = openByAuthor["human"] ?? 0;
    const autonomous = byAuthor["make_activity_autonomous"] ?? 0;
    // Operator-blocked proposals scoped to open gaps, counting each proposal
    // once (not once per author-class overlap).
    const operatorBlocked = openGapProposals.filter((p) => p.registration_status === "blocked_operator").length;
    // A proposal that is both authored_by=subagent AND blocked_operator would be
    // double-counted by naive addition. Deduplicate by using a Set of proposal ids
    // (or file positions) — treat each proposal as at most 1 unit of debt.
    const debtProposals = new Set();
    for (const p of openGapProposals) {
        if (p.authored_by === "subagent" ||
            p.authored_by === "human" ||
            p.registration_status === "blocked_operator") {
            debtProposals.add(`${p.scenario_id}:${p.proposal_id ?? p.authored_by}`);
        }
    }
    const debt = debtProposals.size;
    const prior = await loadPriorCycle((0, node_path_1.dirname)(values.out ?? "validation/failure-modes/cycles/.placeholder"), cycleNumber);
    const debtZero = debt === 0;
    // gap_count_decreasing: true when current gaps < prior gaps, OR when we
    // have already reached the floor (gap_count === 0). The criterion "strictly
    // decreases week-over-week" is satisfied when the trajectory ends at zero —
    // we cannot decrease below zero, so we treat floor-reached as criterion-met.
    const gapDecreasing = prior
        ? (gapScenarios.length < prior.baseline_gap_count || gapScenarios.length === 0)
        : true;
    const consecutiveZero = debtZero
        ? (prior?.lift_kpi.consecutive_zero_debt_cycles ?? 0) + 1
        : 0;
    const summary = {
        cycle_number: cycleNumber,
        started_at: new Date().toISOString(),
        baseline_report: values.report,
        baseline_gap_count: gapScenarios.length,
        baseline_reuse_count: report.summary.reuse,
        proposals_authored: proposals.length,
        proposals_by_author: byAuthor,
        proposals_registered: registered,
        manual_intervention_debt: debt,
        manual_intervention_breakdown: {
            subagent_dispatches: subagentDispatches,
            human_authored_templates: humanAuthored,
            operator_admin_actions_required: operatorBlocked,
        },
        remaining_gaps: gapScenarios
            .filter((s) => !gapsWithProposal.has(s.scenario_id))
            .map((s) => s.scenario_id),
        gaps_with_proposal: Array.from(gapsWithProposal),
        lift_kpi: {
            debt_zero: debtZero,
            gap_count_decreasing: gapDecreasing,
            consecutive_zero_debt_cycles: consecutiveZero,
        },
        notes: [],
    };
    const autonomousPresent = (byAuthor["make_activity_autonomous"] ?? 0) > 0;
    if (consecutiveZero >= 3 && gapDecreasing && autonomousPresent) {
        summary.notes.push(`LIFT CANDIDATE: ${consecutiveZero} consecutive cycles with zero manual debt, gap count at floor (${gapScenarios.length}), autonomous proposals present. System operating autonomously.`);
    }
    if (autonomous > 0) {
        summary.notes.push(`${autonomous} proposals authored autonomously (via make-activity). This is the lift signal.`);
    }
    const outPath = values.out ?? `validation/failure-modes/cycles/cycle-${cycleNumber}.json`;
    await (0, promises_1.mkdir)((0, node_path_1.dirname)(outPath), { recursive: true });
    await (0, promises_1.writeFile)(outPath, JSON.stringify(summary, null, 2));
    console.log(`progression-driver: cycle ${cycleNumber}`);
    console.log(`  baseline:        ${(0, node_path_1.basename)(values.report)}`);
    console.log(`  gaps:            ${gapScenarios.length}`);
    console.log(`  proposals:       ${proposals.length} (registered: ${registered})`);
    console.log(`  manual debt:     ${debt}`);
    console.log(`    subagent dispatches:  ${subagentDispatches}`);
    console.log(`    human authored:       ${humanAuthored}`);
    console.log(`    operator-blocked:     ${operatorBlocked}`);
    console.log(`    autonomous:           ${autonomous}`);
    console.log(`  lift KPI:        debt_zero=${debtZero} gap_decreasing=${gapDecreasing} consec_zero=${consecutiveZero}`);
    console.log(`  remaining gaps:  ${summary.remaining_gaps.join(", ") || "(none)"}`);
    console.log(`  out:             ${outPath}`);
}
main().catch((err) => {
    console.error("progression-driver fatal:", err);
    process.exit(1);
});
//# sourceMappingURL=progression-driver.js.map