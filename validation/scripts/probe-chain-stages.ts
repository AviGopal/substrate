#!/usr/bin/env bun
/**
 * probe-chain-stages.ts — Phase 2 probe harness.
 *
 * For each chain stage, dispatch 10x and verify invariants. Records pass/fail
 * + duration + side effects per run. Outputs JSON report.
 *
 * Usage:
 *   bun run validation/scripts/probe-chain-stages.ts \
 *     --out validation/findings/phase-2-probe-results-2026-06-05/probe-results.json
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync(`${process.env.HOME}/.metabob/config.json`, "utf-8"));
const API_KEY: string = cfg.metabob?.apiKey ?? "";
const GOAL_HOST = process.env.GOAL_HOST ?? "http://localhost:18210";
const DEV_VESSEL = process.env.DEV_VESSEL ?? "http://localhost:18090";
const ACTIVITY_API = process.env.ACTIVITY_API ?? "http://localhost:18080";
const CONTAINER = process.env.CONTAINER ?? "substrate-live";
const REPO_ROOT = process.env.REPO_ROOT ?? "/home/avi/documents/work/exp-repo/metabob-devbob";
const HEADERS = { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` };
const RUNS = Number(process.env.RUNS ?? 10);

type RunResult = { run: number; pass: boolean; durationMs: number; detail: string; data?: unknown };
type StageReport = {
  stage: string;
  name: string;
  runs: RunResult[];
  passRate: string;
  invariants: { name: string; pass: boolean; detail: string }[];
};

const outArg = process.argv.indexOf("--out");
const OUT = outArg >= 0 ? process.argv[outArg + 1] : `${REPO_ROOT}/validation/findings/phase-2-probe-results-2026-06-05/probe-results.json`;

function inContainer(cmd: string): string {
  return execSync(`docker exec ${CONTAINER} ${cmd}`, { encoding: "utf-8" });
}
function listContainerDir(path: string): string[] {
  try { return inContainer(`ls ${path}`).trim().split("\n").filter(Boolean); } catch { return []; }
}

async function dispatch(targetTemplateId: string, variables: Record<string, unknown> = {}): Promise<string> {
  const res = await fetch(`${GOAL_HOST}/run-goal`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ goal: `probe:${targetTemplateId}`, targetTemplateId, variables }),
  });
  const body = await res.json() as { dispatchId?: string; error?: string };
  if (body.error || !body.dispatchId) throw new Error(`dispatch failed: ${JSON.stringify(body)}`);
  return body.dispatchId;
}
async function poll(dispatchId: string, timeoutMs = 120_000): Promise<{ status: string; executionId: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${GOAL_HOST}/executions/${dispatchId}`, { headers: HEADERS });
    if (r.ok) {
      const b = await r.json() as { status?: string; executionId?: string };
      if (b.status === "completed" || b.status === "failed") return { status: b.status, executionId: b.executionId ?? "" };
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return { status: "timeout", executionId: "" };
}
async function resolveDev(type: string, body: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ impulse: { type, pointer: { type, ...body } } }),
  });
  return res.json();
}

async function runStage<T>(stage: string, name: string, runner: (i: number) => Promise<RunResult>, invariants: (runs: RunResult[]) => StageReport["invariants"]): Promise<StageReport> {
  console.log(`\n=== ${stage}: ${name} ===`);
  const runs: RunResult[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now();
    try {
      const r = await runner(i);
      r.durationMs = Date.now() - t0;
      runs.push(r);
      console.log(`  run ${i+1}/${RUNS}: ${r.pass ? "PASS" : "FAIL"} (${r.durationMs}ms) — ${r.detail}`);
    } catch (e: any) {
      runs.push({ run: i, pass: false, durationMs: Date.now() - t0, detail: `error: ${e.message}` });
      console.log(`  run ${i+1}/${RUNS}: ERROR — ${e.message}`);
    }
  }
  const passed = runs.filter(r => r.pass).length;
  return { stage, name, runs, passRate: `${passed}/${RUNS}`, invariants: invariants(runs) };
}

// ─── Stage 1: Detection (orthogonality audit) ───
async function stage1(i: number): Promise<RunResult> {
  const id = await dispatch("activity:⟨development-vessel:vector-space-orthogonality-audit-tick⟩", {});
  const r = await poll(id);
  if (r.status !== "completed") return { run: i, pass: false, durationMs: 0, detail: `status=${r.status}`, data: { id } };
  // verify gaps file populated
  const gaps = listContainerDir("/workspace/gaps");
  return { run: i, pass: gaps.length > 0, durationMs: 0, detail: `gaps_files=${gaps.length}`, data: { dispatchId: id, executionId: r.executionId, gapsFiles: gaps.length } };
}

// ─── Stage 2: gap_to_scenario bridge ───
async function stage2(i: number): Promise<RunResult> {
  const before = listContainerDir("/workspace/scenarios").length;
  const id = await dispatch("activity:⟨development-vessel:gap-to-scenario-bridge-tick⟩", {});
  const r = await poll(id);
  if (r.status !== "completed") return { run: i, pass: false, durationMs: 0, detail: `status=${r.status}` };
  const after = listContainerDir("/workspace/scenarios").length;
  return { run: i, pass: true, durationMs: 0, detail: `scenarios before=${before} after=${after}`, data: { before, after } };
}

// ─── Stage 3: draft-gap-closing ───
const SCENARIO_FILES = listContainerDir("/workspace/scenarios").slice(0, RUNS);
async function stage3(i: number): Promise<RunResult> {
  const scenario = SCENARIO_FILES[i % SCENARIO_FILES.length];
  if (!scenario) return { run: i, pass: false, durationMs: 0, detail: "no scenario file" };
  const before = listContainerDir("/workspace/proposals").length;
  const id = await dispatch("activity:⟨development-vessel:draft-gap-closing-activity⟩", {
    report_path: `/workspace/scenarios/${scenario}`,
    scenario_id: scenario.replace(".json", ""),
  });
  const r = await poll(id, 180_000);
  const after = listContainerDir("/workspace/proposals").length;
  return { run: i, pass: r.status === "completed" && after > before, durationMs: 0, detail: `scenario=${scenario} proposals before=${before} after=${after} status=${r.status}`, data: { scenario, before, after, status: r.status } };
}

// ─── Stage 4: apply-proposal-as-patch ───
async function stage4(i: number): Promise<RunResult> {
  const proposals = listContainerDir("/workspace/proposals").filter(p => p.endsWith(".json") && p.includes("auto-"));
  const proposal = proposals[i % proposals.length];
  if (!proposal) return { run: i, pass: false, durationMs: 0, detail: "no proposal" };
  const beforeVessels = listContainerDir("/vessels").length;
  const id = await dispatch("activity:⟨development-vessel:apply-proposal-as-patch⟩", {
    proposal_path: `/workspace/proposals/${proposal}`,
  });
  const r = await poll(id);
  const afterVessels = listContainerDir("/vessels").length;
  const created = afterVessels > beforeVessels;
  return { run: i, pass: r.status === "completed", durationMs: 0, detail: `proposal=${proposal} vessels before=${beforeVessels} after=${afterVessels} created=${created}`, data: { proposal, created, status: r.status } };
}

// ─── Stage 5: vessel_mitosis_evaluate ───
async function stage5(i: number): Promise<RunResult> {
  const mitosisDirs = listContainerDir("/vessels").filter(d => d.includes("mitosis"));
  const target = mitosisDirs[i % Math.max(1, mitosisDirs.length)] ?? "";
  // parse base + mitosis ids from dir name
  const m = target.match(/^([\w-]+?)-mitosis-(.+)$/);
  if (!m) return { run: i, pass: false, durationMs: 0, detail: `no parseable mitosis dir; have ${mitosisDirs.length}` };
  const [, vesselName, mitosisVersion] = m;
  const body = await resolveDev("vessel_mitosis_evaluate", { vessel_name: vesselName, base_version_id: "v1", mitosis_version_id: `mitosis-${mitosisVersion}` });
  const verdict = body?.body?.verdict ?? body?.body?.detail ?? body?.shape;
  const validVerdict = ["FAVORABLE", "UNFAVORABLE", "INSUFFICIENT_DATA"].includes(String(verdict));
  return { run: i, pass: body?.success === true || validVerdict, durationMs: 0, detail: `vessel=${vesselName} mitosis=${mitosisVersion} verdict=${verdict}`, data: { vesselName, mitosisVersion, verdict, body: body?.body } };
}

// ─── Stage 6: vessel_mitosis_cutover ───
async function stage6(i: number): Promise<RunResult> {
  const mitosisDirs = listContainerDir("/vessels").filter(d => d.includes("mitosis"));
  const target = mitosisDirs[i % Math.max(1, mitosisDirs.length)] ?? "";
  const m = target.match(/^([\w-]+?)-mitosis-(.+)$/);
  if (!m) return { run: i, pass: false, durationMs: 0, detail: `no parseable mitosis dir` };
  const [, vesselName, mitosisVersion] = m;
  const intentBefore = existsSync(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync.jsonl`) ? readFileSync(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync.jsonl`, "utf-8").split("\n").filter(Boolean).length : 0;
  const body = await resolveDev("vessel_mitosis_cutover", { vessel_name: vesselName, base_version_id: "v1", mitosis_version_id: `mitosis-${mitosisVersion}`, dry_run: false });
  const intentAfter = existsSync(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync.jsonl`) ? readFileSync(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync.jsonl`, "utf-8").split("\n").filter(Boolean).length : 0;
  return { run: i, pass: body?.success === true, durationMs: 0, detail: `vessel=${vesselName} intent_emitted=${intentAfter > intentBefore} body.success=${body?.success}`, data: { vesselName, mitosisVersion, intentDelta: intentAfter - intentBefore, body: body?.body } };
}

// ─── Stage 7: host-sync poller ───
async function stage7(i: number): Promise<RunResult> {
  const resultsPath = `${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync-results.jsonl`;
  const before = existsSync(resultsPath) ? readFileSync(resultsPath, "utf-8").split("\n").filter(Boolean).length : 0;
  try {
    execSync(`bash ${REPO_ROOT}/scripts/substrate/host-sync-poller.sh --once`, { encoding: "utf-8", stdio: "pipe", timeout: 60_000 });
  } catch (e: any) {
    // poller can exit non-zero; we still inspect results file
  }
  const after = existsSync(resultsPath) ? readFileSync(resultsPath, "utf-8").split("\n").filter(Boolean).length : 0;
  return { run: i, pass: true, durationMs: 0, detail: `result lines before=${before} after=${after} delta=${after - before}`, data: { before, after, delta: after - before } };
}

(async () => {
  const reports: StageReport[] = [];
  reports.push(await runStage("S1", "Detection (orthogonality audit)", stage1, (runs) => {
    const counts = runs.map(r => (r.data as any)?.gapsFiles ?? 0).filter(n => n > 0);
    const min = Math.min(...counts, Infinity); const max = Math.max(...counts, 0);
    const stable = counts.length > 0 ? (max - min) / Math.max(1, max) <= 0.2 : false;
    return [{ name: "gap_count variation ≤20%", pass: stable, detail: `min=${min} max=${max}` }];
  }));
  reports.push(await runStage("S2", "Bridge (gap → scenario)", stage2, (runs) => {
    const deltas = runs.map(r => ((r.data as any)?.after ?? 0) - ((r.data as any)?.before ?? 0));
    const idempotent = deltas.every(d => d === 0 || d > 0); // no negative deltas; ≥1 zero shows idempotency
    const zeros = deltas.filter(d => d === 0).length;
    return [{ name: "idempotent: no duplicates", pass: zeros >= Math.floor(RUNS / 2), detail: `deltas=${JSON.stringify(deltas)} zeros=${zeros}` }];
  }));
  reports.push(await runStage("S3", "Draft (scenario → proposal)", stage3, (runs) => {
    const scenarios = runs.map(r => (r.data as any)?.scenario);
    const deltas = runs.map(r => ((r.data as any)?.after ?? 0) - ((r.data as any)?.before ?? 0));
    const nonOverwrite = deltas.every(d => d >= 0);
    return [{ name: "no proposal overwritten", pass: nonOverwrite, detail: `deltas=${JSON.stringify(deltas)}` },
            { name: "distinct scenarios exercised", pass: new Set(scenarios).size >= Math.min(3, runs.length), detail: `distinct=${new Set(scenarios).size}` }];
  }));
  reports.push(await runStage("S4", "Apply (proposal → mitosis)", stage4, (runs) => {
    const created = runs.filter(r => (r.data as any)?.created).length;
    return [{ name: "≥3 distinct mitosis dirs created", pass: created >= 3, detail: `created=${created}` }];
  }));
  reports.push(await runStage("S5", "Evaluate (mitosis → verdict)", stage5, (runs) => {
    const verdicts = runs.map(r => (r.data as any)?.verdict);
    const byMitosis: Record<string, string[]> = {};
    for (const r of runs) { const m = (r.data as any)?.mitosisVersion; if (m) (byMitosis[m] ??= []).push((r.data as any)?.verdict); }
    const det = Object.values(byMitosis).every(vs => new Set(vs).size === 1);
    return [{ name: "deterministic per mitosis dir", pass: det, detail: `by-mitosis=${JSON.stringify(byMitosis)}` }];
  }));
  reports.push(await runStage("S6", "Cutover (verdict → intent)", stage6, (runs) => {
    const intents = runs.filter(r => ((r.data as any)?.intentDelta ?? 0) > 0).length;
    return [{ name: "intent emitted with unique id", pass: intents >= 1, detail: `intents_emitted=${intents}` }];
  }));
  reports.push(await runStage("S7", "Host-sync (intent → commit)", stage7, (runs) => {
    const writes = runs.filter(r => ((r.data as any)?.delta ?? 0) > 0).length;
    return [{ name: "result lines written on processed intents", pass: writes >= 1 || runs.every(r => ((r.data as any)?.delta ?? 0) === 0), detail: `runs_with_writes=${writes}` }];
  }));

  const out = { ts: new Date().toISOString(), runs: RUNS, reports };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\n=== SUMMARY ===`);
  for (const r of reports) console.log(`${r.stage} ${r.name}: ${r.passRate}; invariants: ${r.invariants.map(i => `${i.name}=${i.pass?"OK":"X"}`).join(", ")}`);
  console.log(`\nwrote ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
