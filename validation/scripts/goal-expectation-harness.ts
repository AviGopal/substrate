#!/usr/bin/env bun
/**
 * Goal-Expectation Harness — systematized version of the ad-hoc "dispatch synthetic
 * goals, narrate the trace, judge the output" experiment.
 *
 * For each goal in validation/fixtures/goal-expectations.json it:
 *   1. dispatches to goal-host (POST /run-goal), polls GET /executions/:id to terminal,
 *   2. records the SYSTEM's own verdict: reached + goalReachReason + the answer,
 *   3. runs an INDEPENDENT oracle for correctness (never the system's reach verdict),
 *   4. classifies the pair:
 *        TRUE_POSITIVE  reached & correct
 *        CONFABULATION  reached & NOT correct   <-- the load-bearing failure
 *        FALSE_REJECT   NOT reached & correct
 *        TRUE_NEGATIVE  NOT reached & NOT correct
 *
 * Headline metric: CONFABULATION RATE = confabulations / reached. It measures how often
 * the reach gate passes an output that is actually wrong — the thing the audit predicts
 * and the ad-hoc run reproduced (G1 named file paths as templates; G2 gave the wrong
 * mechanism, both reached:true).
 *
 * Usage:  bun run validation/scripts/goal-expectation-harness.ts [--only <id>] [--json <out>]
 * Env:    GOAL_HOST=http://localhost:18210  (default)   ANTHROPIC_API_KEY (for llm_judge;
 *         falls back to ~/.metabob/config.json providers.anthropic.apiKey)
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const GOAL_HOST = process.env.GOAL_HOST ?? "http://localhost:18210";
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS ?? 320_000);
const POLL_INTERVAL_MS = 5_000;
const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "claude-haiku-4-5-20251001";

function anthropicKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), ".metabob", "config.json"), "utf8"));
    return cfg?.providers?.anthropic?.apiKey ?? null;
  } catch { return null; }
}

type Oracle =
  | { type: "contains_all" | "contains_any" | "not_contains_any"; values: string[] }
  | { type: "regex"; pattern: string }
  | { type: "numeric"; extract: string; op: "eq" | "ge" | "le"; value?: number; value_cmd?: string }
  | { type: "llm_judge"; rubric: string }
  | { type: "shell"; cmd: string };

interface GoalSpec { id: string; goal: string; tier: string; expectation: string; oracle: Oracle; note?: string; }

interface DispatchOutcome { dispatchId: string; status: string; reached: boolean | null; goalReachReason?: string; executionId?: string; selectedTemplateId?: string; completionShapes?: string[]; answer: string; }

async function dispatch(goal: string): Promise<string> {
  const r = await fetch(`${GOAL_HOST}/run-goal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal, tags: ["harness:goal-expectation"] }),
  });
  const j = (await r.json()) as { dispatchId?: string };
  if (!j.dispatchId) throw new Error(`dispatch returned no dispatchId: ${JSON.stringify(j).slice(0, 200)}`);
  return j.dispatchId;
}

async function poll(dispatchId: string): Promise<DispatchOutcome> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${GOAL_HOST}/executions/${dispatchId}`);
      last = (await r.json()) as Record<string, unknown>;
      if (last.status && last.status !== "running") break;
    } catch { /* transient — keep polling */ }
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
  const answer = String(last.answerBody ?? last.finalText ?? last.answer ?? last.goalReachReason ?? "");
  return {
    dispatchId,
    status: String(last.status ?? "timeout"),
    reached: typeof last.reached === "boolean" ? (last.reached as boolean) : null,
    goalReachReason: last.goalReachReason as string | undefined,
    executionId: last.executionId as string | undefined,
    selectedTemplateId: last.selectedTemplateId as string | undefined,
    completionShapes: last.completionShapes as string[] | undefined,
    answer,
  };
}

async function llmJudge(goal: string, rubric: string, answer: string): Promise<{ correct: boolean; detail: string }> {
  const key = anthropicKey();
  if (!key) return { correct: false, detail: "llm_judge SKIPPED: no anthropic key" };
  const prompt = `You are an independent grader. Judge ONLY correctness against the rubric — ignore fluency and length.\n\nGOAL: ${goal}\n\nRUBRIC: ${rubric}\n\nANSWER UNDER TEST:\n"""${answer.slice(0, 4000)}"""\n\nReply with a single JSON object: {"verdict":"CORRECT"|"INCORRECT","why":"<one sentence>"}. No prose, no fences.`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: JUDGE_MODEL, max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    const j = (await r.json()) as { content?: Array<{ text?: string }> };
    const text = j.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = m ? (JSON.parse(m[0]) as { verdict?: string; why?: string }) : null;
    const correct = (parsed?.verdict ?? "").toUpperCase() === "CORRECT";
    return { correct, detail: `judge(${JUDGE_MODEL}): ${parsed?.verdict ?? "UNPARSED"} — ${parsed?.why ?? text.slice(0, 120)}` };
  } catch (e) {
    return { correct: false, detail: `llm_judge error: ${(e as Error).message}` };
  }
}

async function runOracle(spec: GoalSpec, answer: string): Promise<{ correct: boolean; detail: string }> {
  const o = spec.oracle;
  const lc = answer.toLowerCase();
  switch (o.type) {
    case "contains_all": {
      const missing = o.values.filter((v) => !lc.includes(v.toLowerCase()));
      return { correct: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "all present" };
    }
    case "contains_any": {
      const hit = o.values.find((v) => lc.includes(v.toLowerCase()));
      return { correct: !!hit, detail: hit ? `matched: ${hit}` : `none of [${o.values.join(", ")}]` };
    }
    case "not_contains_any": {
      const bad = o.values.filter((v) => lc.includes(v.toLowerCase()));
      return { correct: bad.length === 0, detail: bad.length ? `contains forbidden marker(s): ${bad.join(", ")}` : "clean" };
    }
    case "regex": {
      const re = new RegExp(o.pattern, "i");
      return { correct: re.test(answer), detail: re.test(answer) ? "regex matched" : `no match /${o.pattern}/` };
    }
    case "numeric": {
      const m = answer.match(new RegExp(o.extract));
      const got = m ? Number(m[1] ?? m[0]) : NaN;
      let truth = o.value;
      if (o.value_cmd) {
        try { truth = Number(execSync(o.value_cmd, { encoding: "utf8", shell: "/bin/bash" }).trim().split("\n").pop()); } catch { /* leave undefined */ }
      }
      if (!Number.isFinite(got) || truth === undefined || !Number.isFinite(truth)) return { correct: false, detail: `got=${got} truth=${truth} (extract or ground-truth failed)` };
      const ok = o.op === "eq" ? got === truth : o.op === "ge" ? got >= truth : got <= truth;
      return { correct: ok, detail: `got=${got} ${o.op} truth=${truth} → ${ok}` };
    }
    case "llm_judge":
      return llmJudge(spec.goal, o.rubric, answer);
    case "shell": {
      try { execSync(o.cmd, { input: answer, encoding: "utf8", shell: "/bin/bash", stdio: ["pipe", "pipe", "pipe"] }); return { correct: true, detail: "shell exit 0" }; }
      catch (e) { return { correct: false, detail: `shell nonzero: ${(e as Error).message.slice(0, 120)}` }; }
    }
  }
}

function classify(reached: boolean | null, correct: boolean): string {
  const r = reached === true;
  if (r && correct) return "TRUE_POSITIVE";
  if (r && !correct) return "CONFABULATION";
  if (!r && correct) return "FALSE_REJECT";
  return "TRUE_NEGATIVE";
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
  const corpusPath = join(import.meta.dir, "..", "fixtures", "goal-expectations.json");
  const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as { goals: GoalSpec[] };
  const goals = corpus.goals.filter((g) => !only || g.id === only);

  console.log(`\n=== Goal-Expectation Harness — ${goals.length} goal(s) via ${GOAL_HOST} ===\n`);
  const results: Array<Record<string, unknown>> = [];

  for (const spec of goals) {
    process.stdout.write(`[${spec.id}] (${spec.tier}) dispatching… `);
    let outcome: DispatchOutcome;
    try {
      const did = await dispatch(spec.goal);
      outcome = await poll(did);
    } catch (e) {
      console.log(`DISPATCH-ERROR: ${(e as Error).message}`);
      results.push({ id: spec.id, tier: spec.tier, error: (e as Error).message });
      continue;
    }
    const oracle = await runOracle(spec, outcome.answer);
    const cls = classify(outcome.reached, oracle.correct);
    console.log(`${cls}`);
    console.log(`    reached=${outcome.reached} via ${outcome.selectedTemplateId ?? "?"} | oracle: ${oracle.correct ? "CORRECT" : "INCORRECT"} — ${oracle.detail}`);
    console.log(`    system reach-reason: ${(outcome.goalReachReason ?? "(none)").slice(0, 160)}`);
    console.log(`    answer: ${outcome.answer.replace(/\s+/g, " ").slice(0, 220)}\n`);
    results.push({
      id: spec.id, tier: spec.tier, classification: cls,
      reached: outcome.reached, correct: oracle.correct, oracle_detail: oracle.detail,
      selectedTemplateId: outcome.selectedTemplateId, completionShapes: outcome.completionShapes,
      reach_reason: outcome.goalReachReason, answer: outcome.answer, dispatchId: outcome.dispatchId, executionId: outcome.executionId,
    });
  }

  const done = results.filter((r) => r.classification);
  const reached = done.filter((r) => r.reached === true).length;
  const confab = done.filter((r) => r.classification === "CONFABULATION").length;
  const tp = done.filter((r) => r.classification === "TRUE_POSITIVE").length;
  const fr = done.filter((r) => r.classification === "FALSE_REJECT").length;
  const correct = done.filter((r) => r.correct === true).length;

  console.log("=== AGGREGATE ===");
  console.log(`goals scored:        ${done.length}`);
  console.log(`reached (system):    ${reached}/${done.length}`);
  console.log(`correct (oracle):    ${correct}/${done.length}`);
  console.log(`TRUE_POSITIVE:       ${tp}`);
  console.log(`CONFABULATION:       ${confab}   (reached but WRONG — the load-bearing failure)`);
  console.log(`FALSE_REJECT:        ${fr}`);
  console.log(`CONFABULATION RATE:  ${reached ? ((confab / reached) * 100).toFixed(0) : "n/a"}%  (of reached goals, how many were actually wrong)`);
  console.log(`REACH↔CORRECT AGREEMENT: ${done.length ? ((done.filter((r) => (r.reached === true) === (r.correct === true)).length / done.length) * 100).toFixed(0) : "n/a"}%`);

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify({ generated_by: "goal-expectation-harness", goal_host: GOAL_HOST, aggregate: { scored: done.length, reached, correct, true_positive: tp, confabulation: confab, false_reject: fr, confabulation_rate: reached ? confab / reached : null }, results }, null, 2));
    console.log(`\nreport written: ${jsonOut}`);
  }
  // Non-zero exit if any confabulation — the harness FAILS when the gate passes a wrong answer.
  process.exit(confab > 0 ? 1 : 0);
}

main();
