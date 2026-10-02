#!/usr/bin/env bun
/**
 * typecheck-scenario-gen.ts — concrete-scenario SUPPLY for the self-alteration funnel.
 *
 * WHY (2026-06-17): the funnel (drafter → apply → patch_with_tools → cutover →
 * push) is proven to autonomously resolve CONCRETE blockers and land them on
 * GitHub (substrate-live commit 28df8d0 fixed a real tsc error). But the
 * substrate had NO detector that turns its own concrete defects into patchable
 * scenario files — its materialized scenarios were exhausted/abstract meta-gaps
 * that patch_with_tools can't verify. This generator closes that gap for the
 * highest-value concrete-defect class: TypeScript compile errors. They are
 * localized, single-file, and patch_with_tools-verifiable (the 28df8d0 fix was
 * exactly one). For each `tsc --noEmit` error in a vessel with a writable clone,
 * it emits a concrete scenario file + an open gap row (high harm so
 * pick_priority_scenario ranks it ABOVE the abstract meta-gaps). The existing
 * funnel then drafts → patches → cuts over → pushes — sustained autonomous
 * landings without operator-supplied scenarios.
 *
 * Idempotent: skips errors whose scenario file already exists or has an applied
 * sentinel. Bounded: MAX_NEW scenarios per run. Standalone (timer-run), like
 * funnel-drain.ts / composition-edge-reconcile.ts — no vessel-source wiring.
 */
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";

const RUNTIME_DIR = process.env["MITOSIS_RUNTIME_DIR"] ?? "/vessels";
const SCENARIOS_DIR = process.env["SCENARIOS_DIR"] ?? "/workspace/validation/failure-modes/scenarios";
const GAPS_PATH = process.env["GAPS_PATH"] ?? "/workspace/gaps/gaps.json";
const APPLIED_DIR = "/workspace/proposals/.applied";
const BUN = process.env["BUN_BIN"] ?? "/root/.bun/bin/bun";
// Vessels with a writable push clone (only these can cut over). Keep in sync with
// /workspace/git/vessels/*. dev-vessel last so its restart-on-cutover doesn't
// interrupt generation for the others.
const VESSELS = (process.env["TYPECHECK_VESSELS"] ?? "activity-api,goal-host-vessel,ribosome-vessel,concept-db,development-vessel").split(",");
const MAX_NEW = Number(process.env["MAX_NEW_SCENARIOS"] ?? 3);

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

async function pathExists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

interface TcError { vessel: string; file: string; line: number; col: number; code: string; message: string; }

async function typecheckVessel(vessel: string): Promise<TcError[]> {
  const cwd = `${RUNTIME_DIR}/${vessel}`;
  if (!(await pathExists(`${cwd}/tsconfig.json`))) return [];
  const proc = Bun.spawn([BUN, "run", "typecheck"], { cwd, stdout: "pipe", stderr: "pipe" });
  const out = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text());
  await proc.exited;
  const errs: TcError[] = [];
  for (const line of out.split("\n")) {
    // src/foo.ts(12,5): error TS2532: Object is possibly 'undefined'.
    const m = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/);
    if (m) errs.push({ vessel, file: m[1]!.trim(), line: +m[2]!, col: +m[3]!, code: m[4]!, message: m[5]!.trim() });
  }
  return errs;
}

async function main(): Promise<void> {
  await mkdir(SCENARIOS_DIR, { recursive: true });
  const existing = new Set(await readdir(SCENARIOS_DIR).catch(() => []));
  const applied = new Set(await readdir(APPLIED_DIR).catch(() => []));
  let gaps: Array<Record<string, unknown>> = [];
  try { const p = JSON.parse(await readFile(GAPS_PATH, "utf-8")); if (Array.isArray(p)) gaps = p; } catch { /* start fresh */ }
  const gapIds = new Set(gaps.map((g) => String(g["id"] ?? "")));

  const created: string[] = [];
  let totalErrors = 0;
  for (const vessel of VESSELS) {
    if (created.length >= MAX_NEW) break;
    let errs: TcError[] = [];
    try { errs = await typecheckVessel(vessel.trim()); } catch { /* tolerant */ }
    totalErrors += errs.length;
    for (const e of errs) {
      if (created.length >= MAX_NEW) break;
      const id = `typecheck-${slug(e.vessel)}-${slug(e.file.replace(/\.tsx?$/, ""))}-l${e.line}-${e.code.toLowerCase()}`;
      const scenarioFile = `${id}.json`;
      const reportSentinel = `${id}-report.json`;
      if (existing.has(scenarioFile) || applied.has(reportSentinel)) continue; // dedup
      const repoPath = `repos/${e.vessel}/${e.file}`;
      const scenario = {
        id,
        mode_class: "concrete_defect",
        stage: "compile",
        outcome_class: "gap",
        title: `TypeScript ${e.code} in ${e.vessel}/${e.file}:${e.line}`,
        description:
          `\`bun run typecheck\` (tsc --noEmit) fails in ${e.vessel} at ${e.file} ` +
          `line ${e.line} col ${e.col}: ${e.code} ${e.message}. This is a concrete, ` +
          `localized compile error. Fix it at ${repoPath} (around line ${e.line}) with the ` +
          `minimal change that satisfies the type checker without altering runtime behavior ` +
          `(e.g. a null/undefined guard, an explicit export, a narrowing check, or a cast only ` +
          `if genuinely safe). After the fix, \`bun run typecheck\` must pass for this file.`,
        goal_text: `fix ${e.code} typecheck error in ${e.vessel}/${e.file}:${e.line}`,
        target_file: repoPath,
        required_fix_location: `${repoPath} near line ${e.line}`,
      };
      await writeFile(`${SCENARIOS_DIR}/${scenarioFile}`, JSON.stringify(scenario, null, 2));
      if (!gapIds.has(id)) {
        gaps.push({
          id,
          category: "typecheck_error",
          source: "substrate_detected",
          status: "open",
          summary: `${e.code} ${e.vessel}/${e.file}:${e.line}`,
          // harm=1 (broken build), samples weighted so severity outranks the
          // 0.1 abstract meta-gaps → pick_priority picks concrete fixes first.
          classification_metadata: { success_rate: 0, samples: 5 },
          created_at: new Date().toISOString(),
        });
        gapIds.add(id);
      }
      created.push(id);
    }
  }
  if (created.length > 0) {
    try { await writeFile(GAPS_PATH, JSON.stringify(gaps, null, 2)); } catch { /* tolerant */ }
  }
  console.log(JSON.stringify({ total_tc_errors: totalErrors, scenarios_created: created.length, created }));
}

await main();
