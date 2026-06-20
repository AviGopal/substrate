#!/usr/bin/env bun
/**
 * coherence-metric.ts — the ORTHOGONALITY health signal (SUBSTRATE_AS_MDP §12.7).
 *
 * WHY (2026-06-20): orthogonality = block-diagonal ⋆/L = the factorized Thompson posterior;
 * it is "the moat" that keeps learning tractable (O(1/ε²) per cell). The named failure mode is
 * "action-space growth tends to RAISE dictionary COHERENCE, eroding the very orthogonality that
 * makes growth efficient." So the honest health metric is NOT global λ₂ (mixing — anti-orthogonal)
 * but the MUTUAL COHERENCE of the activity dictionary: how similar/redundant the activities are.
 * Rising coherence as the action-space grows = the alarm.
 *
 * Computes, over a sample of activity signatures (name + in/out shapes) embedded via the concept-db
 * `embed` primitive (local MiniLM): the Gram matrix of normalized embeddings →
 *   - mutual_coherence  = max off-diagonal cosine (OMP worst-case redundancy)
 *   - mean_coherence    = mean off-diagonal cosine (average overlap)
 *   - high_coherence_frac = fraction of pairs with cosine > 0.9 (near-duplicate activities)
 * Tracked alongside the action-space size; the trend (coherence vs n) is the orthogonality signal.
 */
const PASS = process.env.SURREAL_PASS || "";
const sqlAuth = "Basic " + Buffer.from(`root:${PASS}`).toString("base64");
async function sql(q: string): Promise<any[]> {
  const r = await fetch("http://127.0.0.1:8000/sql", { method: "POST",
    headers: { Accept: "application/json", "Surreal-NS": "activity-system", "Surreal-DB": "learning_loop", Authorization: sqlAuth, "Content-Type": "text/plain" }, body: q });
  return (await r.json()).map((s: any) => s.result);
}
const SAMPLE = Number(process.env.COHERENCE_SAMPLE ?? 160);
const [total] = await sql(`SELECT count() FROM activity WHERE proposed != true GROUP ALL;`);
const totalN = total?.[0]?.count ?? 0;
// Representative sample of non-hook activities (ordered by id for determinism; capped).
const [rows] = await sql(`SELECT id, name, input_shapes, output_shapes FROM activity WHERE proposed != true LIMIT ${SAMPLE};`);
const isHook = (s: string) => /validator-dispatch|slot-binding/.test(s || "");
const acts = (rows || []).filter((a: any) => a.id && !isHook(a.id));
const sigs = acts.map((a: any) => `${(a.name || a.id).slice(0, 80)} :: in:${(a.input_shapes||[]).join(",")} out:${(a.output_shapes||[]).join(",")}`);
// Embed via the concept-db generalization primitive (reuse the local MiniLM model).
const er = await fetch("http://127.0.0.1:8260/v2/impulses/resolve", { method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ impulse: { pointer: { type: "embed", texts: sigs } } }) });
const embeds: number[][] = ((await er.json()).content || []).map((c: any) => c.embedding);
const norm = (v: number[]) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return v.map((x) => x / n); };
const E = embeds.map(norm);
let maxC = 0, sumC = 0, pairs = 0, high = 0;
const redundant: Array<{ a: string; b: string; cosine: number }> = [];
for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
  let d = 0; for (let k = 0; k < E[i].length; k++) d += E[i][k] * E[j][k];
  if (d > maxC) maxC = d; sumC += d; pairs++;
  if (d > 0.9) { high++; redundant.push({ a: acts[i].id, b: acts[j].id, cosine: Math.round(d * 1e4) / 1e4 }); }
}
// The redundant pairs ARE the dedup targets — make coherence ACTIONABLE. The deprecation path
// / a dedup activity can merge/prune the lower-value member of each, POOLING credit (more
// samples per cell) + shrinking the action space = restoring orthogonality (the moat).
redundant.sort((x, y) => y.cosine - x.cosine);
const topRedundant = redundant.slice(0, 40);
const out = {
  at: new Date().toISOString(),
  n_sampled: E.length, total_activities: totalN,
  mutual_coherence: Math.round(maxC * 1e4) / 1e4,
  mean_coherence: pairs ? Math.round((sumC / pairs) * 1e4) / 1e4 : 0,
  high_coherence_frac: pairs ? Math.round((high / pairs) * 1e4) / 1e4 : 0,
  redundant_pair_count: redundant.length,
};
console.log(JSON.stringify({ ...out, top_redundant: topRedundant.slice(0, 8) }, null, 2));
try { const f = "/workspace/metrics/coherence.jsonl"; await Bun.write(Bun.file(f), (await Bun.file(f).exists() ? await Bun.file(f).text() : "") + JSON.stringify(out) + "\n"); } catch { /* tolerant */ }
// Dedup-candidate list (read-only signal for the dedup loop). Overwritten each run.
try { await Bun.write("/workspace/metrics/coherence-candidates.json", JSON.stringify({ at: out.at, candidates: topRedundant }, null, 2)); } catch { /* tolerant */ }
