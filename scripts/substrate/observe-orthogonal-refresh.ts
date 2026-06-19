#!/usr/bin/env bun
/**
 * observe-orthogonal-refresh.ts — run observe-orthogonal-patterns on a cadence so
 * fresh orthogonal-decisions flow to enact-orthogonal-decisions.
 *
 * WHY (2026-06-19): observe-orthogonal-patterns is the cross-template synthesis loop
 * (resolver/failure pattern reports → LLM → MODIFY / CREATE_DETECTOR / CREATE_CONSUMER
 * decisions). enact-orthogonal-decisions (in the boredom rotation) reads the latest
 * decisions from /workspace/observations/orthogonal-latest.json and acts on them —
 * authoring CONSUMERS for orphan output shapes, which is what deepens the composition
 * topology beyond depth-2. But observe itself is NOT in the boredom rotation, so its
 * observations went STALE on 2026-06-02 and the loop dried up. This timer (mirroring
 * funnel-drain / composition-edge-reconcile) guarantees observe runs on cadence and
 * repoints `orthogonal-latest.json` at the fresh decisions.
 *
 * Dispatch path: the dev-vessel cli `run-activity` (fetches the re-seeded template
 * from activity-api and runs the cli sequential executor, whose bare-{{taskId}}
 * variable binding is the one proven to surface the aggregator data to the LLM —
 * see finding-2026-06-19-compose-var-binding-fixed). The LLM wraps its JSON in
 * ```json fences; we strip them and rewrite the file as clean JSON so enact's
 * json_path_extract reads a valid array. Only repoints `latest` when the run yields
 * a NON-EMPTY decision array — a degraded/empty run never clobbers good observations.
 */
const OBS_DIR = "/workspace/observations";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = `${OBS_DIR}/orthogonal-${stamp}.json`;
const result: Record<string, unknown> = {
  at: new Date().toISOString(),
  action: "observe_orthogonal_refresh",
  out_path: outPath,
};

try {
  const proc = Bun.spawn(
    [
      "/root/.bun/bin/bun",
      "/vessels/development-vessel/src/cli.ts",
      "run-activity",
      "development-vessel:observe-orthogonal-patterns",
      "--var",
      `out_path=${outPath}`,
    ],
    {
      env: { ...process.env, WORKSPACE_ROOT: "/workspace" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  await proc.exited;
  result["exit_code"] = proc.exitCode;

  const raw = await Bun.file(outPath).text().catch(() => "");
  const cleaned = raw
    .replace(/^﻿/, "")
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  let decisions: unknown[] = [];
  try {
    const parsed = JSON.parse(cleaned);
    decisions = Array.isArray(parsed) ? parsed : [];
  } catch {
    /* not a valid JSON array — treat as no decisions */
  }
  result["decision_count"] = decisions.length;

  if (decisions.length > 0) {
    // Rewrite the file as clean JSON (no fences) so enact's json_path_extract works.
    await Bun.write(outPath, JSON.stringify(decisions, null, 2));
    // Repoint orthogonal-latest.json -> the fresh file (enact reads this symlink).
    const latest = `${OBS_DIR}/orthogonal-latest.json`;
    const { unlink, symlink } = await import("node:fs/promises");
    await unlink(latest).catch(() => {});
    await symlink(outPath, latest);
    result["latest_updated"] = true;
    result["kinds"] = decisions
      .map((d) => (d as { kind?: string }).kind)
      .filter(Boolean);
  } else {
    result["latest_updated"] = false;
    result["reason"] = "no decisions produced — not repointing latest (kept prior observations)";
  }
} catch (err) {
  result["error"] = err instanceof Error ? err.message.slice(0, 200) : String(err);
}

console.log(JSON.stringify(result));
