#!/usr/bin/env bun
/**
 * autonomy-trend.ts — READ-ONLY longitudinal "continuity of becoming" view.
 *
 * Where autonomy-status.ts gives a glanceable NOW verdict and
 * autonomy-metrics-view.ts prints the per-snapshot table, this answers the
 * harder question the operator goal actually asks: across the WHOLE collected
 * series, is the substrate progressively self-developing toward increasing
 * complexity WITHOUT regression? It samples quartile snapshots and, for each
 * self-development dimension, counts how many consecutive steps moved toward the
 * goal vs away — so "continuity" is shown by near-zero regression over a long
 * window, not asserted from two endpoints.
 *
 * Strictly read-only — reads the JSONL the collector already wrote. Resolves the
 * series the same freshest-of-all-reachable-sources way as autonomy-status.ts
 * (substrate-workspace docker volume via `docker exec`, host bind-mount cache).
 *
 *   bun scripts/substrate/autonomy-trend.ts
 */
const HOST_FALLBACK = `${import.meta.dir}/workspace/metrics/autonomy-metrics.jsonl`;
const CONTAINER = process.env.SUBSTRATE_CONTAINER ?? "substrate-live";
const CONTAINER_PATH = "/workspace/metrics/autonomy-metrics.jsonl";
async function readHost(p: string) { try { return (await Bun.file(p).exists()) ? await Bun.file(p).text() : ""; } catch { return ""; } }
async function readSubstrate() {
  try {
    const proc = Bun.spawn(["docker", "exec", CONTAINER, "cat", CONTAINER_PATH], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    return (await proc.exited) === 0 ? out : "";
  } catch { return ""; }
}
function lastAt(t: string) {
  const ls = t.split("\n").filter((l) => l.trim());
  for (let i = ls.length - 1; i >= 0; i--) { try { const v = Date.parse(JSON.parse(ls[i]!).at); if (!Number.isNaN(v)) return v; } catch { /* */ } }
  return -Infinity;
}
const srcs = [process.env.METRICS_OUT ? await readHost(process.env.METRICS_OUT) : "", await readSubstrate(), await readHost(HOST_FALLBACK)];
const text = srcs.reduce((best, s) => (s && lastAt(s) > lastAt(best) ? s : best), "");
const rows = text.split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
if (rows.length < 2) { console.log("insufficient series — is autonomy-metrics.timer active?"); process.exit(0); }

const g = (r: any, ...ks: string[]) => ks.reduce((o, k) => (o == null || typeof o !== "object" ? null : o[k]), r);
const pa = (r: any) => { const p = g(r, "push_away"); return (p && typeof p === "object") ? p.intervention_refused : p; };

// dimension: [label, accessor, goodDirection (+1 rising good, -1 falling good)]
const dims: Array<[string, (r: any) => any, number]> = [
  ["self-alteration landed", (r) => g(r, "self_alteration", "landed"), +1],
  ["composition edges", (r) => g(r, "backward_model", "composition_edges"), +1],
  ["topology depth2", (r) => g(r, "topology", "depth2_compositions") ?? g(r, "topology", "depth2"), +1],
  ["concepts (information)", (r) => g(r, "substrate_self", "concepts"), +1],
  ["self-manip activities", (r) => g(r, "substrate_self", "manipulation_activities"), +1],
  ["model-reality gaps", (r) => g(r, "gaps", "model_reality_open"), -1],
  ["S3 push-away (refused)", pa, +1],
];

const span = `${rows[0].at.slice(0, 16)} → ${rows[rows.length - 1].at.slice(0, 16)}`;
console.log(`\n  CONTINUITY OF BECOMING  ·  ${rows.length} snapshots  ·  ${span}`);
console.log(`  ${"─".repeat(78)}`);

// quartile snapshots
const idx = [0, Math.floor(rows.length / 4), Math.floor(rows.length / 2), Math.floor((3 * rows.length) / 4), rows.length - 1];
const near = (i: number, f: (r: any) => any) => {
  for (const j of [...Array(rows.length - i).keys()].map((k) => i + k)) { const x = f(rows[j]); if (typeof x === "number") return x; }
  for (let j = i; j >= 0; j--) { const x = f(rows[j]); if (typeof x === "number") return x; }
  return null;
};
const hdr = idx.map((i) => rows[i].at.slice(5, 16)).map((s) => s.padStart(13)).join("");
console.log(`  ${"dimension".padEnd(24)}${hdr}   monotonicity (toward/flat/away)`);
for (const [name, f, good] of dims) {
  const cells = idx.map((i) => String(near(i, f)).padStart(13)).join("");
  const vals = rows.map(f).filter((v) => typeof v === "number") as number[];
  const steps = vals.slice(1).map((b, k) => b - vals[k]!);
  const toward = steps.filter((s) => s * good > 0).length;
  const away = steps.filter((s) => s * good < 0).length;
  const flat = steps.filter((s) => s === 0).length;
  const verdict = away === 0 && toward > 0 ? "✓ monotonic, no regression" : away <= toward * 0.1 ? "✓ near-monotonic" : "~ noisy";
  console.log(`  ${name.padEnd(24)}${cells}   ${toward}/${flat}/${away}  ${verdict}`);
}
console.log(`  ${"─".repeat(78)}`);
console.log(`  Reading: dimensions accumulate on events, so most steps are flat; the test`);
console.log(`  of continuity is AWAY-steps ≈ 0 (the substrate does not un-learn). S3`);
console.log(`  push-away emerging 0→N marks the S1→S2→S3 frontier (refusing nudges w/ evidence).\n`);
