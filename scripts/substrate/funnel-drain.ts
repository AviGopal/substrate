#!/usr/bin/env bun
/**
 * funnel-drain.ts — periodically drains the self-alteration funnel by firing
 * `apply_proposal_as_patch` on the development-vessel resolver, decoupled from
 * the boredom selector.
 *
 * WHY (2026-06-17): apply-proposal-as-patch is the funnel's entry point
 * (proposal → staged mitosis → self-propelled cutover → push). It lives in the
 * boredom pool but ranks ~69th by value_per_sec, so the selector almost never
 * picks it — a self-reinforcing starvation (never picked → never productive →
 * stays low value → never picked). Meanwhile the gap-closing drafter produces
 * fresh actionable proposals every ~90s. The result was a flat `landed` counter
 * despite a healthy upstream. This timer guarantees the entry runs on a steady
 * cadence so the funnel actually drains; patch_with_tools (~50% verified) and
 * the FAVORABLE-typecheck cutover gate still decide what lands, so a bad
 * proposal is rejected, not landed. Mirrors the composition-edge-reconcile and
 * model-reality-audit timer pattern.
 *
 * Idempotent + self-serializing: apply refuses while a FRESH mitosis-pending
 * exists (singleton guard), so overlapping fires don't double-stage. Reads no
 * args; emits one JSON line for the journal.
 */
const DEV_VESSEL = process.env["DEV_VESSEL_ENDPOINT"] ?? "http://127.0.0.1:8090";

async function main(): Promise<void> {
  const started = new Date().toISOString();
  let outcome: Record<string, unknown> = { at: started, action: "apply_proposal_as_patch" };
  try {
    const res = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impulse: { type: "apply_proposal_as_patch", config: { type: "apply_proposal_as_patch" } } }),
      signal: AbortSignal.timeout(200_000),
    });
    const body = (await res.json()) as { shape?: string; body?: Record<string, unknown> };
    const b = body.body ?? {};
    outcome = {
      ...outcome,
      http: res.status,
      shape: body.shape ?? null,
      dispatched: (b as { dispatched?: unknown }).dispatched ?? null,
      mitosis_version_id: (b as { mitosis_version_id?: unknown }).mitosis_version_id ?? null,
      // when nothing was eligible the resolver returns a structuredError with a skipped[] audit
      skipped_count: Array.isArray((b as { skipped?: unknown[] }).skipped) ? (b as { skipped: unknown[] }).skipped.length : 0,
      reason: (b as { reason?: unknown; detail?: unknown }).reason ?? (b as { detail?: unknown }).detail ?? null,
    };
  } catch (err) {
    outcome = { ...outcome, error: err instanceof Error ? err.message.slice(0, 200) : String(err) };
  }
  console.log(JSON.stringify(outcome));
}

await main();
