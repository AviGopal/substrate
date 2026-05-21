/**
 * VERIFY: branch-health vessel faithfully replaces conventional `git`
 * invocation.
 *
 * Spec context: 2026-05-21 user pivot — primary use of ias-executor-ts is
 * to replace conventional software with vessel-based environs. This probe
 * provides concrete evidence that the branch-health vessel produces the
 * SAME factual information you'd get from running git commands manually.
 *
 * Method:
 *   1. Run runBranchHealth against the super-repo cwd.
 *   2. Independently invoke the same four git commands.
 *   3. Diff parsed-vessel-report vs parsed-raw-output. Any divergence is
 *      reported with both sides.
 *
 * Exit codes:
 *   0 — vessel report matches raw git output (faithful replacement)
 *   1 — divergence found (vessel is broken or git changed under our feet)
 *   2 — vessel itself failed to run
 */

import { runBranchHealth } from "../../repos/ias-executor-ts/src/examples/branch-health";
import { spawnSync } from "node:child_process";

function runGit(args: string[], cwd: string): { exitCode: number; stdout: string; stderr: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return {
    exitCode: r.status ?? -1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function parseShortstat(text: string): { filesChanged: number; insertions: number; deletions: number } {
  const filesM = /(\d+) files? changed/.exec(text);
  const insM = /(\d+) insertions?\(\+\)/.exec(text);
  const delM = /(\d+) deletions?\(-\)/.exec(text);
  return {
    filesChanged: filesM ? parseInt(filesM[1]!, 10) : 0,
    insertions: insM ? parseInt(insM[1]!, 10) : 0,
    deletions: delM ? parseInt(delM[1]!, 10) : 0,
  };
}

interface Divergence {
  field: string;
  vessel: unknown;
  raw: unknown;
}

async function main(): Promise<void> {
  const cwd = process.argv[2] ?? process.cwd();
  console.log(`[verify-branch-health] cwd = ${cwd}`);

  // 1. Vessel
  let vesselReport;
  try {
    const { trace, report } = await runBranchHealth(cwd);
    if (trace.status !== "completed") {
      console.error(`[verify-branch-health] vessel trace.status=${trace.status} — abort`);
      process.exit(2);
    }
    if (!report) {
      console.error("[verify-branch-health] vessel emitted no report — abort");
      process.exit(2);
    }
    vesselReport = report;
  } catch (err) {
    console.error("[verify-branch-health] vessel threw:", err instanceof Error ? err.message : err);
    process.exit(2);
  }

  // 2. Raw git
  const rawBranch = runGit(["symbolic-ref", "--short", "HEAD"], cwd);
  const rawStatus = runGit(["status", "--porcelain"], cwd);
  const rawDiff = runGit(["diff", "--shortstat", "HEAD"], cwd);
  const rawLog = runGit(["log", "-5", "--pretty=%s"], cwd);

  const expected = {
    branch: rawBranch.exitCode === 0 ? rawBranch.stdout.trim().replace(/^refs\/heads\//, "") : "unknown",
    workingTreeChanges:
      rawStatus.exitCode === 0
        ? rawStatus.stdout.trim().split("\n").filter((l) => l.length > 0).length
        : 0,
    diffStat: rawDiff.exitCode === 0 ? parseShortstat(rawDiff.stdout) : { filesChanged: 0, insertions: 0, deletions: 0 },
    recentCommits:
      rawLog.exitCode === 0 ? rawLog.stdout.trim().split("\n").filter((l) => l.length > 0) : [],
  };

  // 3. Diff
  const divergences: Divergence[] = [];
  if (vesselReport.branch !== expected.branch) {
    divergences.push({ field: "branch", vessel: vesselReport.branch, raw: expected.branch });
  }
  if (vesselReport.workingTreeChanges !== expected.workingTreeChanges) {
    divergences.push({
      field: "workingTreeChanges",
      vessel: vesselReport.workingTreeChanges,
      raw: expected.workingTreeChanges,
    });
  }
  if (
    vesselReport.diffStat.filesChanged !== expected.diffStat.filesChanged ||
    vesselReport.diffStat.insertions !== expected.diffStat.insertions ||
    vesselReport.diffStat.deletions !== expected.diffStat.deletions
  ) {
    divergences.push({ field: "diffStat", vessel: vesselReport.diffStat, raw: expected.diffStat });
  }
  if (
    vesselReport.recentCommits.length !== expected.recentCommits.length ||
    vesselReport.recentCommits.some((c, i) => c !== expected.recentCommits[i])
  ) {
    divergences.push({
      field: "recentCommits",
      vessel: vesselReport.recentCommits,
      raw: expected.recentCommits,
    });
  }

  console.log("");
  console.log("=== Vessel report ===");
  console.log(JSON.stringify(vesselReport, null, 2));
  console.log("");
  console.log("=== Raw git (independently invoked) ===");
  console.log(JSON.stringify(expected, null, 2));
  console.log("");

  if (divergences.length === 0) {
    console.log("✅ FAITHFUL REPLACEMENT: vessel report matches raw git output on every field.");
    console.log("   The branch-health vessel can substitute for the manual git command sequence.");
    process.exit(0);
  } else {
    console.log("❌ DIVERGENCE — vessel does not faithfully replace raw git:");
    for (const d of divergences) {
      console.log(`   field=${d.field}`);
      console.log(`     vessel: ${JSON.stringify(d.vessel)}`);
      console.log(`     raw   : ${JSON.stringify(d.raw)}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-branch-health] FATAL:", err instanceof Error ? err.message : err);
  process.exit(2);
});
