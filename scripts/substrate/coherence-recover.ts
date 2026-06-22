#!/usr/bin/env bun
/**
 * coherence-recover.ts — SELF-RECOVERY from orthogonality erosion (MDP §12.7).
 *
 * WHY (2026-06-20): the coherence metric found the action-space dictionary is bloated with
 * EXACT-behavioral duplicates (e.g. ~140 detect-unclassified_failure_* variants, cosine 1.0) —
 * the drafter authoring a new cell per instance. Duplicate cells SPLIT credit (fewer samples
 * each → slower convergence) and inflate the action space → orthogonality (the moat) erodes.
 * This loop RESTORES orthogonality: it groups activities by EXACT behavioral signature
 * (input_shapes + output_shapes + task resolver/type structure — ignoring id/name/timestamp),
 * keeps the most-exercised member of each duplicate family, and demotes the rest to
 * proposed=true (OUT of the active action space — Thompson never selects proposed; REVERSIBLE,
 * no hard delete). Credit pools onto the canonical member; the action space shrinks. Bounded +
 * conservative: only collapses families of ≥2 with identical signatures; caps demotions/run.
 */
const PASS = process.env.SURREAL_PASS || "";
const sqlAuth = "Basic " + Buffer.from(`root:${PASS}`).toString("base64");
async function sql(q: string): Promise<any[]> {
  const r = await fetch("http://127.0.0.1:8000/sql", { method: "POST",
    headers: { Accept: "application/json", "Surreal-NS": "activity-system", "Surreal-DB": "learning_loop", Authorization: sqlAuth, "Content-Type": "text/plain" }, body: q });
  return (await r.json()).map((s: any) => s.result);
}
const CAP = Number(process.env.RECOVER_CAP ?? 60);
const DRY = process.env.RECOVER_DRY === "1";
// Active (non-proposed, non-hook) activities + behavioral fields.
const [rows] = await sql(`SELECT id, input_shapes, output_shapes, tasks FROM activity WHERE proposed != true LIMIT 3000;`);
const isHook = (s: string) => /validator-dispatch|slot-binding/.test(s || "");
// Behavioral signature: shapes + FULL task behavior (resolver + complete config + prompt
// template). The PROMPT is included because two LLM activities with identical shapes/resolvers
// but different prompts are DIFFERENT behaviors (e.g. gap-closing activities each fixing a
// distinct gap) — collapsing them would destroy distinct capabilities. Only BYTE-IDENTICAL
// behavior shares a signature → only true duplicates collapse. NOT id/name/tags/timestamp.
const sig = (a: any): string => {
  const ins = [...(a.input_shapes || [])].sort().join(",");
  const outs = [...(a.output_shapes || [])].sort().join(",");
  const tasks = (a.tasks || []).map((t: any) =>
    `${t.resolver || ""}::${JSON.stringify(t.config ?? {})}::${(t.prompt?.template ?? "").trim()}`).join(">>");
  return `${ins}|${outs}|${tasks}`;
};
// Execution counts (to keep the most-exercised canonical member).
// Rolling 30d window on the INDEXED `executed_at` column: the unbounded GROUP BY
// full-scanned all 160K+ traces every 60min off an UNINDEXED scan; scoping to
// executed_at rides idx_activity_executions_executed_at. This count is only a
// RELATIVE ranking signal WITHIN each byte-identical duplicate family (pick the
// member with the most accumulated exercise to keep its pooled credit), so a
// recent window is acceptable; and with effectively the whole current corpus
// inside 30d, recent-exercise ≈ all-time exercise — the canonical choice is
// unchanged today while the scan stays index-bounded and self-prunes as the
// store ages.
const RECOVER_CUT = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
const [execs] = await sql(`SELECT activity_id, count() AS n FROM activity_execution_traces WHERE executed_at >= type::datetime("${RECOVER_CUT}") GROUP BY activity_id;`);
const execN = new Map<string, number>((execs || []).map((r: any) => [r.activity_id, r.n ?? 0]));
const families = new Map<string, any[]>();
for (const a of rows || []) {
  if (!a.id || isHook(a.id)) continue;
  const s = sig(a);
  if (s === "||") continue; // skip empty-signature (no shapes/tasks) — too coarse to dedup
  if (!families.has(s)) families.set(s, []);
  families.get(s)!.push(a);
}
let demoted = 0; const report: any[] = [];
for (const [s, members] of families) {
  if (members.length < 2 || demoted >= CAP) continue;
  members.sort((x, y) => (execN.get(y.id) ?? 0) - (execN.get(x.id) ?? 0)); // most-exercised first = canonical
  const canonical = members[0];
  const redundant = members.slice(1, 1 + (CAP - demoted));
  for (const r of redundant) {
    if (!DRY) await sql(`UPDATE ${r.id.startsWith("activity:") ? r.id : `activity:\`${r.id}\``} SET proposed = true, deduped_into = ${JSON.stringify(canonical.id)}, deduped_at = time::now();`);
    demoted++;
  }
  report.push({ signature: s.slice(0, 60), family_size: members.length, kept: canonical.id, demoted: redundant.length });
}
const out = { at: new Date().toISOString(), dry_run: DRY, demoted, families_collapsed: report.length,
  top: report.sort((a, b) => b.family_size - a.family_size).slice(0, 6) };
console.log(JSON.stringify(out, null, 2));
try { const f = "/workspace/metrics/coherence-recover.jsonl"; await Bun.write(Bun.file(f), (await Bun.file(f).exists() ? await Bun.file(f).text() : "") + JSON.stringify({ at: out.at, dry_run: DRY, demoted, families_collapsed: report.length }) + "\n"); } catch {}
