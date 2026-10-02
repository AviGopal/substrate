#!/usr/bin/env bun
/**
 * observe-chain-window.ts — Sample substrate state at intervals during a 60-min observation window.
 *
 * Captures: autonomous commits, new variants, new gaps, new concepts, mitosis dirs,
 * intent/result lines, mode counts, concept ts_sum for 5 specific concept ids.
 *
 * Usage: SAMPLES=4 INTERVAL_MIN=15 bun run validation/scripts/observe-chain-window.ts
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const cfg = JSON.parse(readFileSync(`${process.env.HOME}/.metabob/config.json`, "utf-8"));
const API_KEY = cfg.metabob?.apiKey ?? "";
const ACTIVITY_API = process.env.ACTIVITY_API ?? "http://localhost:18080";
const CONTAINER = process.env.CONTAINER ?? "substrate-live";
const REPO_ROOT = process.env.REPO_ROOT ?? "/home/avi/documents/work/exp-repo/metabob-devbob";
const OUT = process.env.OUT ?? `${REPO_ROOT}/validation/findings/phase-2-probe-results-2026-06-05/observation-samples.json`;
const SAMPLES = Number(process.env.SAMPLES ?? 4);
const INTERVAL_MIN = Number(process.env.INTERVAL_MIN ?? 15);
const TARGET_CONCEPT_IDS = (process.env.CONCEPT_IDS ?? "concept_lzKXyoYYwEBR,concept_jyiAE_i4GXU7").split(",").filter(Boolean);
const HEADERS = { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` };

function dexec(cmd: string): string {
  try { return execSync(`docker exec ${CONTAINER} ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }); } catch { return ""; }
}
function ls(path: string): string[] { return dexec(`ls ${path}`).trim().split("\n").filter(Boolean); }
function fileLines(path: string): number { return existsSync(path) ? readFileSync(path, "utf-8").split("\n").filter(Boolean).length : 0; }

function sample(idx: number, ts: string) {
  const proposals = ls("/workspace/proposals").length;
  const scenarios = ls("/workspace/scenarios").length;
  const gapFiles = ls("/workspace/gaps");
  const mitosisDirs = ls("/vessels").filter(d => d.includes("mitosis"));
  const intents = fileLines(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync.jsonl`);
  const results = fileLines(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync-results.jsonl`);
  let resultsByStatus: Record<string, number> = {};
  try {
    const lines = existsSync(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync-results.jsonl`)
      ? readFileSync(`${REPO_ROOT}/scripts/substrate/workspace/mitosis-applied-host-sync-results.jsonl`, "utf-8").split("\n").filter(Boolean) : [];
    for (const l of lines) { try { const o = JSON.parse(l); const s = o.push_status ?? "unknown"; resultsByStatus[s] = (resultsByStatus[s] ?? 0) + 1; } catch {} }
  } catch {}
  // autonomous commits in last hour
  let commitCount = 0;
  try {
    commitCount = Number(execSync(`git -C ${REPO_ROOT} log --since="1 hour ago" --grep="substrate-authored\\|host-sync" --oneline | wc -l`, { encoding: "utf-8" }).trim());
  } catch {}
  // template counts via FTS (proxy for variant minting)
  return { idx, ts, proposals, scenarios, gap_files: gapFiles, mitosis_dirs: mitosisDirs.length, intents, results, results_by_status: resultsByStatus, commits_last_hour: commitCount };
}

(async () => {
  const samples: any[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const ts = new Date().toISOString();
    const s = sample(i, ts);
    samples.push(s);
    console.log(`[${ts}] sample ${i+1}/${SAMPLES}: proposals=${s.proposals} scenarios=${s.scenarios} mitosis=${s.mitosis_dirs} intents=${s.intents} results=${s.results} commits=${s.commits_last_hour} byStatus=${JSON.stringify(s.results_by_status)}`);
    writeFileSync(OUT, JSON.stringify({ ts: new Date().toISOString(), samples }, null, 2));
    if (i < SAMPLES - 1) await new Promise(r => setTimeout(r, INTERVAL_MIN * 60_000));
  }
  // delta computation
  const first = samples[0], last = samples[samples.length - 1];
  const delta = {
    proposals: last.proposals - first.proposals,
    scenarios: last.scenarios - first.scenarios,
    mitosis_dirs: last.mitosis_dirs - first.mitosis_dirs,
    intents: last.intents - first.intents,
    results: last.results - first.results,
    commits_last_hour_at_end: last.commits_last_hour,
  };
  writeFileSync(OUT, JSON.stringify({ ts: new Date().toISOString(), samples, delta }, null, 2));
  console.log(`\nDELTA over ${INTERVAL_MIN * (SAMPLES - 1)} min: ${JSON.stringify(delta)}`);
})();
