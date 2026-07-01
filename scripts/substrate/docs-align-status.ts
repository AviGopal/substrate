#!/usr/bin/env bun
/**
 * docs-align-status.ts — on-demand readout of the documentation-as-expectation loop.
 *
 * Surfaces (does not gate) the closure loop's state so the operator can SEE it working and
 * decide when to flip DOC_FIX_AUTOLAND on. Reads the documentation_drift gaps from dev-vessel
 * and buckets them by doc_fix status:
 *   - detected      : drift found, not yet attempted by doc_drift_fix
 *   - proposed      : reach-gated FAVORABLE fix RECORDED on the gap (ready to review / autoland)
 *   - reach_unfavorable / draft_failed / no_anchor : doc_drift_fix could not produce a verified fix
 *   - landed        : fix pushed to origin/dev (autoland on)
 * Also reports the ingest surface size (doc-expectation concepts) so coverage is visible.
 *
 * Report-only. Run: docker exec substrate-live bun ${SUBSTRATE_ROOT}/scripts/substrate/docs-align-status.ts
 */
const DEV_VESSEL = (process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090").replace(/\/$/, "");
const MANIFEST = process.env.INGEST_MANIFEST ?? "/workspace/.docs-ingest-manifest.json";
const AUTOLAND = process.env.DOC_FIX_AUTOLAND === "1";

async function readGaps(status: string): Promise<Record<string, unknown>[]> {
  try {
    const r = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "substrateGap", category: "documentation_drift", status, limit: 500 } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const body = (await r.json())?.body ?? {};
    const gaps = (body as { gaps?: unknown }).gaps ?? body;
    return Array.isArray(gaps) ? (gaps as Record<string, unknown>[]) : [];
  } catch { return []; }
}

function docFixStatus(g: Record<string, unknown>): string {
  const meta = (g.classification_metadata ?? g.metadata ?? {}) as Record<string, unknown>;
  const df = (meta.doc_fix ?? null) as { status?: string } | null;
  return df?.status ?? "detected";
}

async function main(): Promise<void> {
  const [open, closed] = await Promise.all([readGaps("open"), readGaps("closed")]);
  const byStatus: Record<string, number> = {};
  const proposed: Array<{ doc: string; edits: number }> = [];
  for (const g of open) {
    const s = docFixStatus(g);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    if (s === "proposed") {
      const meta = (g.classification_metadata ?? {}) as Record<string, unknown>;
      const df = (meta.doc_fix ?? {}) as { edit_count?: number };
      proposed.push({ doc: String(meta.doc_path ?? g.id), edits: Number(df.edit_count ?? 0) });
    }
  }

  let surface = 0;
  try { surface = Object.keys(JSON.parse(await Bun.file(MANIFEST).text())).length; } catch { /* no manifest */ }

  console.log(JSON.stringify({
    readout: "docs-align-status",
    autoland: AUTOLAND ? "ON" : "OFF (triage — proposed fixes recorded, not pushed)",
    expectation_surface_sections: surface,
    open_drift_gaps: open.length,
    closed_drift_gaps: closed.length,
    open_by_doc_fix_status: byStatus,
    proposed_ready_for_review: proposed,
    hint: proposed.length
      ? `${proposed.length} reach-gated fix(es) recorded. Review, then set DOC_FIX_AUTOLAND=1 to let them land autonomously.`
      : "no proposed fixes pending.",
  }, null, 2));
}

await main();
