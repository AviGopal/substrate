/**
 * db-maintenance-tick.ts — the substrate manages its OWN database, autonomously.
 *
 * Closes the self-management loop: db_admin (activity-api resolver) gives the
 * substrate the CAPABILITY to diagnose/index/migrate/repair/prune its SurrealDB;
 * this tick makes it ACTUALLY DO IT on a cadence, with a sane autonomous posture:
 *   - diagnose every tick (read-only health + integrity + missing-index report)
 *   - AUTO-APPLY non-destructive remediations: create_index, apply_migration(reconcile)
 *   - AUTO-APPLY bounded INTEGRITY repairs (delete_none_fk / coerce_null_to_none):
 *       low blast-radius, fixes violations, bounded + audited by db_admin
 *   - DRY-RUN ONLY for bulk prune (surface the impact; never auto-delete bulk data
 *     on a blind timer — that goes through an explicit goal with the bound+audit)
 * Every action is bounded + audited inside db_admin (db_admin_audit table) and
 * logged here to /workspace/metrics/db-maintenance.jsonl.
 *
 * Self-activating from the run-dir; env-gated DB_MAINTENANCE (default 1). (2026-06-28)
 */
import { readFileSync } from "node:fs";

if ((process.env["DB_MAINTENANCE"] ?? "1") === "0") { console.log("[db-maint] disabled"); process.exit(0); }

let API = "http://localhost:8080", KEY = "";
try {
  const env = readFileSync("/etc/substrate/env", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (!m) continue;
    if (m[1] === "ACTIVITY_API_ENDPOINT" || m[1] === "ACTIVITY_API_URL") API = m[2];
    if (m[1] === "METABOB_API_KEY" || (/^mb[_-]/.test(m[2]) && !KEY)) KEY = m[2];
  }
} catch { /* defaults */ }

async function dbAdmin(operation: string, extra: Record<string, unknown> = {}): Promise<any> {
  try {
    const r = await fetch(`${API}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
      body: JSON.stringify({ impulse: { type: "db_admin", pointer: { type: "db_admin", operation, ...extra } } }),
      signal: AbortSignal.timeout(120_000),
    });
    const j: any = await r.json();
    try { return typeof j.content === "string" ? JSON.parse(j.content) : (j.content ?? j); } catch { return j; }
  } catch (e) { return { error: String(e) }; }
}

const actions: any[] = [];

// 1) Diagnose (read-only).
const diag = await dbAdmin("diagnose");
const remediations: any[] = Array.isArray(diag?.suggested_remediations) ? diag.suggested_remediations
  : Array.isArray(diag?.remediations) ? diag.remediations : [];

// 2) Auto-apply NON-DESTRUCTIVE remediations the diagnose suggested.
for (const rem of remediations.slice(0, 8)) {
  const op = rem?.operation;
  if (op === "create_index") {
    const res = await dbAdmin("create_index", rem.params ?? rem);
    actions.push({ op, params: rem.params ?? rem, result: res?.error ? "error" : "applied", detail: (res?.error ?? res?.status ?? "ok") });
  } else if (op === "apply_migration") {
    const res = await dbAdmin("apply_migration", rem.params ?? rem);
    actions.push({ op, result: res?.error ? "error" : "applied" });
  }
}

// 3) Auto-apply BOUNDED integrity repairs (low blast-radius). dry-run first; apply only
//    if the impact is within a tight bound (these fix violations, not bulk data).
const INTEGRITY_PATTERNS = ["delete_none_fk", "coerce_null_to_none"];
const integrity: any[] = Array.isArray(diag?.integrity) ? diag.integrity : [];
for (const finding of integrity) {
  const pattern = finding?.pattern ?? (finding?.id?.includes("none_fk") ? "delete_none_fk" : finding?.id?.includes("null") ? "coerce_null_to_none" : null);
  const count = Number(finding?.count ?? finding?.violation_count ?? 0);
  if (!pattern || !INTEGRITY_PATTERNS.includes(pattern) || count <= 0) continue;
  const dry = await dbAdmin("repair", { pattern, ...(finding.params ?? {}) });
  const affected = Number(dry?.affected_count ?? dry?.impact_count ?? count);
  if (affected > 0 && affected <= 2000) {
    const ap = await dbAdmin("repair", { pattern, apply: true, max_rows: 2000, ...(finding.params ?? {}) });
    actions.push({ op: "repair", pattern, affected, result: ap?.error ? "error" : "applied" });
  } else {
    actions.push({ op: "repair", pattern, affected, result: affected > 2000 ? "skipped_over_bound(surfaced)" : "noop" });
  }
}

// 4) DRY-RUN bulk prune — surface the impact, never auto-delete bulk on a timer.
const prune = await dbAdmin("prune", { pattern: "prune_traces_older_than", older_than_days: 30 });
const pruneCandidates = Number(prune?.affected_count ?? prune?.impact_count ?? 0);

const out = {
  at: new Date().toISOString(),
  error_rate: diag?.db_metrics?.error_rate ?? null,
  slow_queries: diag?.db_metrics?.slow_queries ?? null,
  integrity_findings: integrity.map((f: any) => ({ id: f?.id, count: f?.count })),
  actions,
  prune_candidates_30d: pruneCandidates,
};
console.log(JSON.stringify(out));
try {
  const f = "/workspace/metrics/db-maintenance.jsonl";
  const prev = await Bun.file(f).exists() ? await Bun.file(f).text() : "";
  await Bun.write(Bun.file(f), prev + JSON.stringify(out) + "\n");
} catch { /* tolerant */ }
