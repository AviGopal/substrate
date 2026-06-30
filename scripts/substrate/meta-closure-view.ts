#!/usr/bin/env bun
/**
 * meta-closure-view.ts — READ-ONLY supervision view for the six META-SHAPES
 * (learning-to-learn as a shape; see plan imperative-twirling-truffle.md).
 *
 * The premise: each meta-capability is a SHAPE with a (possibly) missing
 * producer/consumer. Recognition is native — the shape-graph walk files a
 * substrateGap (fileCapabilityGap) when it can't produce a target shape, and the
 * gap→feature loop authors the producer. This view does NOT recognize or close
 * anything; it just shows, per meta-shape, whether the substrate closed the gap
 * itself or STALLED at the hot-path consumption boundary — the operator's cue for
 * which consumption seam to scaffold next.
 *
 * Closure on the meta-shapes is gap #6 (shapeClosureDemand) self-applied, so this
 * is a closure-tracking view: it reuses the gap PROVENANCE→OUTCOME join idiom from
 * development-vessel/src/resolvers/detector-yield-registry.ts (landed = closed &
 * not churned; churned = closed with a churn closed_reason; open = open) and the
 * docker-exec read of the workspace-volume gaps.json from autonomy-metrics-view.ts.
 *
 *   bun scripts/substrate/meta-closure-view.ts
 *   SUBSTRATE_CONTAINER=substrate-b bun scripts/substrate/meta-closure-view.ts
 */

import { readFileSync } from "node:fs";

const CONTAINER = process.env.SUBSTRATE_CONTAINER ?? "substrate-live";
const DISCOVERY = process.env.DISCOVERY_ENDPOINT ?? "http://localhost:18100";
const HOST_GAPS_FALLBACK = `${import.meta.dir}/workspace/gaps/gaps.json`;

// Discovery /resolve requires auth. Prefer ~/.metabob/config.json — CLAUDE.md
// designates it the substrate config source of truth, and it carries the key that
// authenticates against the LOCAL substrate. Env is the fallback (and is avoided
// first because Bun auto-loads a repo-root .env that may carry a stale key).
function resolveApiKey(): string {
  try {
    const cfg = JSON.parse(readFileSync(`${process.env.HOME}/.metabob/config.json`, "utf8"));
    if (cfg?.metabob?.apiKey) return cfg.metabob.apiKey;
  } catch { /* fall through */ }
  return process.env.METABOB_API_KEY ?? "";
}
const API_KEY = resolveApiKey();

// ── The six meta-shapes (plan Part 1). Each row: the shape the walk targets, the
//    gap category its producer-gap carries, id/metadata tokens to match loosely
//    (categories are free strings at the write boundary), and the consumption seam
//    (if any) that the operator must scaffold because consumption is hot-path. ──
interface MetaShape {
  n: number;
  shape: string;           // the meta-shape name (walk target / discovery probe)
  category: string;        // substrateGap category its producer-gap carries
  tokens: string[];        // loose match tokens (id prefix / metadata.shape)
  seam: string;            // "" = no operator seam (pure); else the seam id
}
const META_SHAPES: MetaShape[] = [
  { n: 1, shape: "learningPolicy",          category: "meta_hyperparam_unconverged",     tokens: ["learningpolicy", "meta-hyperparam", "tuning"],        seam: "3a (hot-path consume)" },
  { n: 2, shape: "repairPolicy",            category: "repair_not_failure_conditioned",  tokens: ["repairpolicy", "repair-conditioning", "failure_mode"], seam: "3b (hot-path consume)" },
  { n: 3, shape: "traceCompletenessReport", category: "trace_quality",                   tokens: ["tracecompleteness", "trace-completeness"],            seam: "" },
  { n: 4, shape: "selectionEntropy",        category: "exploration_collapse",            tokens: ["selectionentropy", "posterior-entropy", "entropy"],   seam: "deferred (selector hook)" },
  { n: 5, shape: "coarsenableChain",        category: "coarsenable_chain",               tokens: ["coarsenablechain", "recurring-chain", "coarsen"],     seam: "" },
  { n: 6, shape: "shapeClosureDemand",      category: "closure_demand",                  tokens: ["shapeclosuredemand", "closure-demand", "closure_demand"], seam: "" },
];

const HARD_CATEGORIES = new Set([
  "architectural_pattern", "performance_inefficiency", "responsibility_misallocation",
  "learning_signal_degeneracy", "decision_without_action", "resolver_distribution",
  // the two consumption-coupled meta-categories are feature-sized until their seam lands
  "meta_hyperparam_unconverged", "repair_not_failure_conditioned",
]);

interface GapRow {
  id?: string;
  category?: string;
  status?: "open" | "closed" | "rejected";
  classification_metadata?: Record<string, unknown> | null;
  created_at?: string; updated_at?: string; detected_at?: string;
}

async function readGaps(): Promise<GapRow[]> {
  // Authoritative copy lives in the substrate-workspace docker VOLUME; host can't
  // see it via fs (mirrors autonomy-metrics-view.ts). docker exec first, host fallback.
  try {
    const proc = Bun.spawn(["docker", "exec", CONTAINER, "cat", "/workspace/gaps/gaps.json"], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    if ((await proc.exited) === 0 && out.trim()) {
      const parsed = JSON.parse(out);
      return Array.isArray(parsed) ? parsed : (parsed.gaps ?? []);
    }
  } catch { /* fall through */ }
  try {
    if (await Bun.file(HOST_GAPS_FALLBACK).exists()) {
      const parsed = JSON.parse(await Bun.file(HOST_GAPS_FALLBACK).text());
      return Array.isArray(parsed) ? parsed : (parsed.gaps ?? []);
    }
  } catch { /* none */ }
  return [];
}

// Does any vessel advertise this shape? (producer authored). Read-only discovery probe.
async function producerAuthored(shape: string): Promise<boolean | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (API_KEY) headers["Authorization"] = `ApiKey ${API_KEY}`;
    const r = await fetch(`${DISCOVERY}/resolve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) return null;
    const j = await r.json() as { content?: { vessels?: unknown[] } };
    return (j?.content?.vessels?.length ?? 0) > 0;
  } catch { return null; }
}

function isChurned(g: GapRow): boolean {
  const reason = g.classification_metadata?.["closed_reason"];
  return typeof reason === "string" && /churn/i.test(reason);
}

function matches(g: GapRow, m: MetaShape): boolean {
  if (g.category === m.category) return true;
  const hay = `${g.id ?? ""} ${String(g.classification_metadata?.["shape"] ?? "")} ${String(g.classification_metadata?.["detector"] ?? "")}`.toLowerCase();
  return m.tokens.some((t) => hay.includes(t));
}

const gaps = await readGaps();

interface Row {
  n: number; shape: string; producer: string; seam: string;
  open: number; landed: number; churned: number; rejected: number; stalled: number;
}

const rows: Row[] = [];
for (const m of META_SHAPES) {
  const mine = gaps.filter((g) => matches(g, m));
  let open = 0, landed = 0, churned = 0, rejected = 0, stalled = 0;
  for (const g of mine) {
    if (g.status === "open") {
      open++;
      // stalled = open + in a hard/feature-sized category (the consumption boundary)
      if (HARD_CATEGORIES.has(g.category ?? "")) stalled++;
    } else if (g.status === "rejected") rejected++;
    else if (g.status === "closed") { if (isChurned(g)) churned++; else landed++; }
  }
  const prod = await producerAuthored(m.shape);
  rows.push({
    n: m.n, shape: m.shape,
    producer: prod === true ? "Y" : prod === false ? "n" : "?",
    seam: m.seam || "—",
    open, landed, churned, rejected, stalled,
  });
}

const cols: Array<[keyof Row, string]> = [
  ["n", "#"], ["shape", "meta-shape"], ["producer", "prod"], ["seam", "consume-seam"],
  ["open", "open"], ["landed", "landed"], ["stalled", "stalled"], ["churned", "churn"], ["rejected", "rej"],
];
const w: Record<string, number> = {};
for (const [k, h] of cols) w[k as string] = Math.max(h.length, ...rows.map((r) => String(r[k]).length));
const pad = (v: unknown, k: string) => String(v).padEnd(w[k]);
console.log(`meta-closure (gaps=${gaps.length}, container=${CONTAINER})\n`);
console.log(cols.map(([k, h]) => h.padEnd(w[k as string])).join("  "));
for (const r of rows) console.log(cols.map(([k]) => pad(r[k], k as string)).join("  "));
console.log(
  "\nlanded>0 = substrate closed it itself · stalled>0 = open + feature-boundary (scaffold the consume-seam) · prod=Y = a vessel advertises the shape",
);
console.log("read-only; recognition is the walk's fileCapabilityGap, production is gap→feature. This view only observes closure.");
