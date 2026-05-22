#!/usr/bin/env bun
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

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { parseArgs } from "node:util";

interface HarnessReport {
  generated_at: string;
  label: string;
  scenarios: Array<{
    scenario_id: string;
    emergence_class: "reuse" | "new" | "gap" | "gap_accepted";
    matched_existing_activity_id: string | null;
    emergent_trace_id: string | null;
    self_heal_seconds: number | null;
    notes: string[];
  }>;
  summary: { reuse: number; new: number; gap: number };
}

interface Proposal {
  proposal_id: string;
  scenario_id: string;
  closes_gap: boolean;
  template_name: string;
  authored_by: "subagent" | "human" | "make_activity_autonomous";
  authored_at: string;
  registration_status:
    | "draft"
    | "registered_canary"
    | "registered_production"
    | "blocked_operator";
  notes?: string;
}

interface CycleSummary {
  cycle_number: number;
  started_at: string;
  baseline_report: string;
  baseline_gap_count: number;
  baseline_reuse_count: number;
  proposals_authored: number;
  proposals_by_author: Record<string, number>;
  proposals_registered: number;
  manual_intervention_debt: number;
  manual_intervention_breakdown: {
    subagent_dispatches: number;
    human_authored_templates: number;
    operator_admin_actions_required: number;
  };
  remaining_gaps: string[];
  gaps_with_proposal: string[];
  lift_kpi: {
    debt_zero: boolean;
    gap_count_decreasing: boolean;
    consecutive_zero_debt_cycles: number;
  };
  notes: string[];
}

async function loadReport(path: string): Promise<HarnessReport> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as HarnessReport;
}

async function loadProposals(dir: string): Promise<Proposal[]> {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const out: Proposal[] = [];
  for (const f of files) {
    const raw = JSON.parse(await readFile(join(dir, f), "utf8")) as
      | Proposal
      | { proposal: Proposal; template?: unknown };
    // Accept both flat and {proposal, template} envelope formats.
    const p = "proposal" in raw && raw.proposal ? raw.proposal : (raw as Proposal);
    out.push(p);
  }
  return out;
}

async function loadPriorCycle(
  cyclesDir: string,
  thisCycle: number,
): Promise<CycleSummary | null> {
  const prior = join(cyclesDir, `cycle-${thisCycle - 1}.json`);
  if (!existsSync(prior)) return null;
  return JSON.parse(await readFile(prior, "utf8")) as CycleSummary;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
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

  if (!values.report) throw new Error("--report is required");
  if (!values.cycle) throw new Error("--cycle is required");

  const cycleNumber = parseInt(values.cycle, 10);
  const report = await loadReport(values.report);
  const proposals = await loadProposals(values.proposals!);

  const gapScenarios = report.scenarios.filter(
    (s) => s.emergence_class === "gap",
  );
  const gapIds = new Set(gapScenarios.map((s) => s.scenario_id));
  const gapsWithProposal = new Set(
    proposals.filter((p) => gapIds.has(p.scenario_id)).map((p) => p.scenario_id),
  );

  const byAuthor: Record<string, number> = {};
  for (const p of proposals) {
    byAuthor[p.authored_by] = (byAuthor[p.authored_by] ?? 0) + 1;
  }

  const registered = proposals.filter(
    (p) =>
      p.registration_status === "registered_canary" ||
      p.registration_status === "registered_production",
  ).length;

  // Manual intervention debt: 1 unit per gap that needed human-driven
  // subagent dispatch or template authoring. make_activity_autonomous = 0.
  const subagentDispatches = byAuthor["subagent"] ?? 0;
  const humanAuthored = byAuthor["human"] ?? 0;
  const autonomous = byAuthor["make_activity_autonomous"] ?? 0;
  const operatorBlocked = proposals.filter(
    (p) => p.registration_status === "blocked_operator",
  ).length;

  const debt = subagentDispatches + humanAuthored + operatorBlocked;

  const prior = await loadPriorCycle(
    dirname(values.out ?? "validation/failure-modes/cycles/.placeholder"),
    cycleNumber,
  );
  const debtZero = debt === 0;
  const gapDecreasing = prior
    ? gapScenarios.length < prior.baseline_gap_count
    : true;
  const consecutiveZero = debtZero
    ? (prior?.lift_kpi.consecutive_zero_debt_cycles ?? 0) + 1
    : 0;

  const summary: CycleSummary = {
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

  if (consecutiveZero >= 3 && gapDecreasing) {
    summary.notes.push(
      `LIFT CANDIDATE: ${consecutiveZero} consecutive cycles with zero manual debt AND gap count still decreasing. System may be operating autonomously.`,
    );
  }
  if (autonomous > 0) {
    summary.notes.push(
      `${autonomous} proposals authored autonomously (via make-activity). This is the lift signal.`,
    );
  }

  const outPath =
    values.out ?? `validation/failure-modes/cycles/cycle-${cycleNumber}.json`;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(summary, null, 2));

  console.log(`progression-driver: cycle ${cycleNumber}`);
  console.log(`  baseline:        ${basename(values.report)}`);
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
