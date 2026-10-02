#!/usr/bin/env bun
// performance-status.ts — READ-ONLY one-shot view of substrate performance.
//
// Prints the four measurement families the operator holds the system to
// (CLAUDE.md "execution expectation" + law 7 "measure by the gap triple"):
//
//   1. HONEST reach      — the goal_verification_label oracle corpus (human verdicts),
//                          not the walk's self-assessment.
//   2. SELF-REPORTED reach — goal-host activeDispatches `reached` flags, so the
//                          honest-vs-self divergence (a gamed-metric tell) is visible.
//   3. GAP TRIPLE        — open/closed stock, closed_reason decomposition (verified
//                          repair vs lifecycle expiry — a high close rate dominated by
//                          expiry is NOT progress), close latency, reopen rate.
//   4. TOPOLOGY          — registry shape count, running vessel units, federated LLM
//                          arms, graded-template population.
//
// Pure renderer over live resolves: no writes, no DB creds, safe to run anytime.
// Each section degrades to "unavailable" if its vessel is down — never crashes.
//
// Envelope quirks (verified live, they differ per vessel):
//   activity-api  POST /v2/impulses/resolve  {"pointer":{...}}   (content: JSON string)
//   dev-vessel    POST /v2/impulses/resolve  {"impulse":{...}}   (body.gaps)
//   goal-host     POST /resolve              {"pointer":{...}}   (body.dispatches)
//   discovery     GET  /registry/shapes; POST /resolve {"pointer":{type:vesselCapability}}

import { readFileSync } from "node:fs";

const ACTIVITY = process.env.ACTIVITY ?? "http://localhost:18080";
const DEVVESSEL = process.env.DEVVESSEL ?? "http://localhost:18090";
const DISCOVERY = process.env.DISCOVERY ?? "http://localhost:18100";
const GOALHOST = process.env.GOALHOST ?? "http://localhost:18210";
const CONTAINER = process.env.CONTAINER ?? "substrate-live";

const LABEL_LIMIT = 500;
const GAP_LIMIT = 1000;
const DISPATCH_LIMIT = 500;
const TEMPLATE_LIMIT = 1000;
const WEEK_MS = 7 * 24 * 3600 * 1000;
const weekAgoIso = new Date(Date.now() - WEEK_MS).toISOString();

// ── auth (same resolution order as meta-closure-view.ts) ────────────────────
function resolveApiKey(): string {
  try {
    const cfg = JSON.parse(readFileSync(`${process.env.HOME}/.metabob/config.json`, "utf8"));
    if (cfg?.metabob?.apiKey) return cfg.metabob.apiKey;
  } catch { /* fall through */ }
  return process.env.METABOB_API_KEY ?? "";
}
const API_KEY = resolveApiKey();
const HEADERS = { "Content-Type": "application/json", Authorization: `ApiKey ${API_KEY}` };

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, { method: "POST", headers: HEADERS, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}
async function get(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

const pct = (num: number, den: number) => (den ? `${((100 * num) / den).toFixed(1)}%` : "n/a");
function quantiles(days: number[]): string {
  if (!days.length) return "n/a";
  const s = [...days].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(1);
  const mean = (s.reduce((a, b) => a + b, 0) / s.length).toFixed(1);
  return `median ${at(0.5)}d  mean ${mean}d  p90 ${at(0.9)}d  (n=${s.length})`;
}
function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const section = (title: string) => console.log(`\n${"═".repeat(64)}\n${title}\n${"═".repeat(64)}`);

// ── 1. HONEST reach — verification-label oracle corpus ──────────────────────
async function honestReach() {
  section("1. HONEST REACH — goal_verification_label oracle corpus");
  try {
    const res = await post(`${ACTIVITY}/v2/impulses/resolve`, { pointer: { type: "goal_verification_label", limit: LABEL_LIMIT } });
    // activity-api returns the label array as a JSON-encoded STRING in .content
    const labels: any[] = typeof res.content === "string" ? JSON.parse(res.content) : res.content ?? [];
    if (!labels.length) return console.log("no labels in corpus");
    const tally = (set: any[]) => {
      const by = Object.fromEntries(countBy(set, (l) => l.verdict ?? "unknown"));
      const achieved = by.achieved ?? 0;
      return `${pct(achieved, set.length)} achieved  (${set.length} labels: ${Object.entries(by).map(([v, n]) => `${n} ${v}`).join(", ")})`;
    };
    console.log(`overall : ${tally(labels)}`);
    console.log(`last 7d : ${tally(labels.filter((l) => (l.created_at ?? "") >= weekAgoIso))}`);
    for (const [labeler, n] of countBy(labels, (l) => l.labeler ?? "unknown"))
      console.log(`by labeler: ${labeler} — ${tally(labels.filter((l) => (l.labeler ?? "unknown") === labeler))} (${n})`);
  } catch (e) {
    console.log(`unavailable: ${e instanceof Error ? e.message : e}`);
  }
}

// ── 2. SELF-REPORTED reach — goal-host dispatch window ──────────────────────
async function selfReportedReach() {
  section("2. SELF-REPORTED REACH — goal-host activeDispatches window");
  try {
    const res = await post(`${GOALHOST}/resolve`, { pointer: { type: "activeDispatches", limit: DISPATCH_LIMIT } });
    const dispatches: any[] = res?.body?.dispatches ?? [];
    if (!dispatches.length) return console.log("no dispatches in window");
    for (const [row, n] of countBy(dispatches, (d) => `${d.status}\treached=${d.reached}`)) console.log(`${String(n).padStart(4)}  ${row}`);
    const finished = dispatches.filter((d) => d.status !== "running");
    const reached = finished.filter((d) => d.reached === true);
    const hollow = finished.filter((d) => d.status === "completed" && d.reached === false);
    const satisfier = finished.filter((d) => d.status === "failed" && d.reached === true);
    console.log(`self-reported reach: ${pct(reached.length, finished.length)} of ${finished.length} finished`);
    console.log(`hollow completions (completed + reached=false): ${hollow.length}   satisfier reaches (failed + reached=true): ${satisfier.length}`);
    console.log("NOTE: compare with section 1 — a wide self-vs-honest spread is the gamed-metric tell.");
  } catch (e) {
    console.log(`unavailable: ${e instanceof Error ? e.message : e}`);
  }
}

// ── 3. GAP TRIPLE — close rate, latency, durability (law 7) ─────────────────
async function gapTriple() {
  section("3. GAP TRIPLE — substrateGap store (rolling window)");
  try {
    const res = await post(`${DEVVESSEL}/v2/impulses/resolve`, { impulse: { type: "substrateGap", limit: GAP_LIMIT } });
    const gaps: any[] = res?.body?.gaps ?? [];
    if (!gaps.length) return console.log("no gaps in store");
    const capped = gaps.length >= GAP_LIMIT ? ` (window capped at ${GAP_LIMIT} — treat as a window, not all-time)` : "";
    console.log(`stock${capped}: ${countBy(gaps, (g) => g.status ?? "unknown").map(([s, n]) => `${n} ${s}`).join(", ")}`);

    const closed = gaps.filter((g) => g.status === "closed" || g.status === "resolved");
    const reasons = countBy(closed, (g) => g.classification_metadata?.closed_reason ?? "unspecified");
    console.log(`closed_reason: ${reasons.map(([r, n]) => `${n} ${r}`).join(", ")}`);
    const repaired = closed.filter((g) => g.classification_metadata?.closed_reason === "producer_now_exists").length;
    const expired = closed.filter((g) => g.classification_metadata?.closed_reason === "expired_not_redetected").length;
    console.log(`HONESTY (law 7): verified-repair share of closes = ${pct(repaired, closed.length)} (${repaired}/${closed.length}); expiry share = ${pct(expired, closed.length)}`);
    if (expired > repaired) console.log("⚠ closes are expiry-dominated — the headline close rate overstates repair");

    const latencyDays = closed
      .map((g) => (Date.parse(g.updated_at) - Date.parse(g.created_at)) / 86_400_000)
      .filter((d) => Number.isFinite(d) && d >= 0);
    console.log(`close latency (created→closed): ${quantiles(latencyDays)}`);

    const reopened = gaps.filter((g) => (g.reopen_count ?? 0) > 0).length;
    console.log(`durability: ${pct(reopened, gaps.length)} of gaps reopened at least once (${reopened}/${gaps.length})`);

    const detected7d = gaps.filter((g) => (g.created_at ?? "") >= weekAgoIso).length;
    const closed7d = closed.filter((g) => (g.updated_at ?? "") >= weekAgoIso).length;
    console.log(`flow last 7d: ${detected7d} detected vs ${closed7d} closed`);

    console.log("top open categories:");
    for (const [cat, n] of countBy(gaps.filter((g) => g.status === "open"), (g) => g.category ?? "uncategorized").slice(0, 8))
      console.log(`  ${String(n).padStart(4)}  ${cat}`);
  } catch (e) {
    console.log(`unavailable: ${e instanceof Error ? e.message : e}`);
  }
}

// ── 4. TOPOLOGY — vocabulary, fleet, federation, learned structure ──────────
async function topology() {
  section("4. TOPOLOGY — shapes, vessels, federation, templates");
  try {
    const shapes = await get(`${DISCOVERY}/registry/shapes`);
    console.log(`advertised shape vocabulary: ${shapes?.shapes?.length ?? "n/a"} shapes`);
  } catch (e) {
    console.log(`shape count unavailable: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const res = await post(`${DISCOVERY}/resolve`, { pointer: { type: "vesselCapability", shape: "llm_completion" } });
    const vessels: any[] = res?.content?.vessels ?? [];
    const federated = vessels.filter((v) => /@/.test(v.vesselId ?? ""));
    console.log(`llm_completion producers: ${vessels.length} (${federated.length} federated) — ${vessels.map((v) => v.vesselId).join(", ") || "none"}`);
  } catch (e) {
    console.log(`llm arms unavailable: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const proc = Bun.spawnSync([
      "docker", "exec", CONTAINER,
      "systemctl", "list-units", "--type=service", "--state=running", "--no-legend", "--plain",
    ]);
    if (proc.exitCode !== 0) throw new Error(proc.stderr.toString().trim() || `docker exec exit ${proc.exitCode}`);
    const units = proc.stdout
      .toString()
      .split("\n")
      .map((l) => l.trim().split(/\s+/)[0])
      .filter((u) => u?.endsWith(".service"))
      .filter((u) => !/^(surrealdb|valkey|journald|dbus|systemd|getty|user@)/.test(u));
    console.log(`running vessel units in ${CONTAINER}: ${units.length}`);
    for (const u of units) console.log(`  ${u}`);
  } catch (e) {
    console.log(`vessel units: n/a (${e instanceof Error ? e.message : e})`);
  }
  try {
    const res = await post(`${ACTIVITY}/v2/impulses/resolve`, { pointer: { type: "activityTemplatesByMetrics", limit: TEMPLATE_LIMIT } });
    const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
    const m = text.match(/Found (\d+) template/);
    if (!m) throw new Error("template count not found in report");
    const n = Number(m[1]);
    console.log(`templates with execution history: ${n >= TEMPLATE_LIMIT ? `>= ${n} (limit-capped)` : n}`);
  } catch (e) {
    console.log(`template count unavailable: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`substrate performance status — ${new Date().toISOString()}`);
console.log(`endpoints: activity=${ACTIVITY} dev=${DEVVESSEL} discovery=${DISCOVERY} goal-host=${GOALHOST}`);
if (!API_KEY) console.log("⚠ no API key resolved (~/.metabob/config.json .metabob.apiKey or METABOB_API_KEY) — authed reads will fail");
await honestReach();
await selfReportedReach();
await gapTriple();
await topology();
