#!/usr/bin/env bun
/**
 * autonomy-metrics-view.ts — READ-ONLY viewer over the autonomy-metrics JSONL
 * time series. Prints the key autonomy signals per snapshot + first→last delta,
 * so we can SEE whether the substrate is self-correcting without nudging.
 *
 *   bun scripts/substrate/autonomy-metrics-view.ts            # last 20 snapshots
 *   N=50 bun scripts/substrate/autonomy-metrics-view.ts       # last 50
 */
const FILE = process.env.METRICS_OUT || "/workspace/metrics/autonomy-metrics.jsonl";
const N = Number(process.env.N ?? 20);
const lines = (await Bun.file(FILE).text()).split("\n").filter((l) => l.trim());
const rows = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
if (rows.length === 0) { console.log("no metrics recorded yet"); process.exit(0); }
const pick = (r: any) => ({
  at: (r.at ?? "").slice(5, 16).replace("T", " "),
  lift: r.lift?.overall_passing === true ? "Y" : r.lift?.overall_passing === false ? "n" : "?",
  tph: r.dec_limiters?.rho_sample_traces_per_hour ?? null,            // throughput (ρ_sample)
  kspread: (r.dec_limiters?.kappa_posterior_spread?.max != null && r.dec_limiters?.kappa_posterior_spread?.min != null)
    ? +(r.dec_limiters.kappa_posterior_spread.max - r.dec_limiters.kappa_posterior_spread.min).toFixed(2) : null, // κ non-degeneracy
  edges: r.backward_model?.composition_edges ?? null,                 // λ₁ substrate
  orphan: r.backward_model?.orphan_parent_rate ?? null,
  emb: r.forward_model?.embedding_coverage ?? null,
  sel: r.forward_model?.selector_scored_fraction ?? null,
  landed: r.self_alteration?.landed ?? null,                          // self-alteration output
  mr_gaps: r.gaps?.model_reality_open ?? null,                        // KEY: does the loop close these?
  fma: r.gaps?.by_category?.forward_model_artifact ?? null,
  refused: r.push_away?.intervention_refused ?? null,                 // S3
});
const view = rows.slice(-N).map(pick);
const cols = ["at", "lift", "tph", "kspread", "edges", "orphan", "emb", "sel", "landed", "mr_gaps", "fma", "refused"];
const w: Record<string, number> = {};
for (const c of cols) w[c] = Math.max(c.length, ...view.map((v: any) => String(v[c] ?? "").length));
const fmt = (v: any, c: string) => String(v[c] ?? "·").padStart(w[c]);
console.log(cols.map((c) => c.padStart(w[c])).join("  "));
for (const v of view) console.log(cols.map((c) => fmt(v, c)).join("  "));
if (view.length >= 2) {
  const a = view[0], b = view[view.length - 1];
  const d = (k: string) => (typeof a[k] === "number" && typeof b[k] === "number") ? `${b[k] - a[k] >= 0 ? "+" : ""}${+(b[k] - a[k]).toFixed(2)}` : "·";
  console.log("\nΔ first→last (" + view.length + " pts):  " +
    ["landed", "mr_gaps", "fma", "edges", "refused", "tph"].map((k) => `${k} ${d(k)}`).join("   "));
  console.log("watch:  mr_gaps↓ / fma↓ = loop self-correcting · landed↑ = self-alteration working · refused↑ = S3 push-away");
}
