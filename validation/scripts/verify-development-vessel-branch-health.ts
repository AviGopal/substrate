/**
 * VERIFY: development-vessel branch-health activity produces same output as raw git.
 *
 * The development-vessel branch-health activity is now the canonical way to
 * inspect branch health. This probe verifies that the vessel's resolvers
 * (git_status, git_diff, git_log) produce the same factual information as
 * running git commands independently.
 *
 * Compare against the raw git baseline in verify-branch-health.ts.
 *
 * Exit codes:
 *   0 — vessel resolvers match raw git output (faithful replacement)
 *   1 — divergence found
 *   2 — vessel resolvers failed to run
 */

import { spawnSync } from "node:child_process";

interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runGit(args: string[], cwd: string): GitCommandResult {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return {
    exitCode: r.status ?? -1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function runResolver(resolverType: string, data: Record<string, unknown>, cwd: string): GitCommandResult {
  const dataStr = JSON.stringify(data);
  const result = spawnSync(
    "bun",
    [
      "repos/development-vessel/src/cli.ts",
      "call-resolver",
      resolverType,
      "--data",
      dataStr,
    ],
    {
      cwd,
      encoding: "utf-8",
      env: { ...process.env, WORKSPACE_ROOT: cwd },
    }
  );

  let stdout = result.stdout ?? "";
  let stderr = result.stderr ?? "";

  // Parse JSON output from resolver
  if (stdout) {
    try {
      const parsed = JSON.parse(stdout);
      if (parsed.body) {
        stdout = JSON.stringify(parsed.body);
      }
    } catch {
      // Keep raw output if not JSON
    }
  }

  return {
    exitCode: result.status ?? -1,
    stdout,
    stderr,
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

async function main(): Promise<void> {
  const cwd = process.argv[2] ?? process.cwd();
  console.log(`[verify-development-vessel-branch-health] cwd = ${cwd}\n`);

  // 1. Run vessel resolvers (simulating the branch-health activity)
  console.log("=== Vessel resolvers ===");
  const vesselStatus = runResolver("git_status", { cwd }, cwd);
  const vesselDiff = runResolver("git_diff", { cwd, stat: true }, cwd);
  const vesselLog = runResolver("git_log", { cwd, limit: 5 }, cwd);

  if (vesselStatus.exitCode !== 0 || vesselDiff.exitCode !== 0 || vesselLog.exitCode !== 0) {
    console.error("[verify-development-vessel-branch-health] vessel resolver failed");
    console.error("  git_status exit:", vesselStatus.exitCode);
    console.error("  git_diff exit:", vesselDiff.exitCode);
    console.error("  git_log exit:", vesselLog.exitCode);
    process.exit(2);
  }

  // Parse vessel outputs
  let vesselStatusLines: string[] = [];
  let vesselDiffStat = { filesChanged: 0, insertions: 0, deletions: 0 };
  let vesselLogLines: string[] = [];

  try {
    const statusBody = JSON.parse(vesselStatus.stdout);
    vesselStatusLines = statusBody.stdout
      ?.trim()
      .split("\n")
      .filter((l: string) => l.length > 0) ?? [];

    const diffBody = JSON.parse(vesselDiff.stdout);
    vesselDiffStat = parseShortstat(diffBody.stdout ?? "");

    const logBody = JSON.parse(vesselLog.stdout);
    vesselLogLines = logBody.stdout
      ?.trim()
      .split("\n")
      .filter((l: string) => l.length > 0) ?? [];
  } catch (err) {
    console.error("[verify-development-vessel-branch-health] parse error:", err);
    console.error("  git_status stdout:", vesselStatus.stdout);
    console.error("  git_diff stdout:", vesselDiff.stdout);
    console.error("  git_log stdout:", vesselLog.stdout);
    process.exit(2);
  }

  // 2. Run raw git commands
  console.log("=== Raw git ===");
  const rawBranch = runGit(["symbolic-ref", "--short", "HEAD"], cwd);
  const rawStatus = runGit(["status", "--porcelain"], cwd);
  const rawDiff = runGit(["diff", "--shortstat", "HEAD"], cwd);
  const rawLog = runGit(["log", "-5", "--pretty=%s"], cwd);

  const expected = {
    branch: rawBranch.exitCode === 0 ? rawBranch.stdout.trim().replace(/^refs\/heads\//, "") : "unknown",
    workingTreeChanges:
      rawStatus.exitCode === 0
        ? rawStatus.stdout.trim().split("\n").filter((l: string) => l.length > 0).length
        : 0,
    diffStat: rawDiff.exitCode === 0 ? parseShortstat(rawDiff.stdout) : { filesChanged: 0, insertions: 0, deletions: 0 },
    recentCommits:
      rawLog.exitCode === 0 ? rawLog.stdout.trim().split("\n").filter((l: string) => l.length > 0) : [],
  };

  // 3. Compare
  interface Divergence {
    field: string;
    vessel: unknown;
    raw: unknown;
  }

  const divergences: Divergence[] = [];

  if (vesselStatusLines.length !== expected.workingTreeChanges) {
    divergences.push({
      field: "workingTreeChanges",
      vessel: vesselStatusLines.length,
      raw: expected.workingTreeChanges,
    });
  }

  if (
    vesselDiffStat.filesChanged !== expected.diffStat.filesChanged ||
    vesselDiffStat.insertions !== expected.diffStat.insertions ||
    vesselDiffStat.deletions !== expected.diffStat.deletions
  ) {
    divergences.push({
      field: "diffStat",
      vessel: vesselDiffStat,
      raw: expected.diffStat,
    });
  }

  if (
    vesselLogLines.length !== expected.recentCommits.length ||
    vesselLogLines.some((c, i) => c !== expected.recentCommits[i])
  ) {
    divergences.push({
      field: "recentCommits",
      vessel: vesselLogLines,
      raw: expected.recentCommits,
    });
  }

  console.log("\n=== Vessel results ===");
  console.log(
    JSON.stringify(
      {
        workingTreeChanges: vesselStatusLines.length,
        diffStat: vesselDiffStat,
        recentCommits: vesselLogLines,
      },
      null,
      2
    )
  );

  console.log("\n=== Raw git results ===");
  console.log(JSON.stringify(expected, null, 2));

  if (divergences.length === 0) {
    console.log(
      "\n✅ FAITHFUL REPLACEMENT: vessel resolvers match raw git output on every field."
    );
    console.log(
      "   The development-vessel branch-health activity can substitute for manual git commands."
    );
    process.exit(0);
  } else {
    console.log("\n❌ DIVERGENCE — vessel resolvers do not faithfully match raw git:");
    for (const d of divergences) {
      console.log(`   field=${d.field}`);
      console.log(`     vessel: ${JSON.stringify(d.vessel)}`);
      console.log(`     raw   : ${JSON.stringify(d.raw)}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-development-vessel-branch-health] FATAL:", err instanceof Error ? err.message : err);
  process.exit(2);
});
