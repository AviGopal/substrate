/**
 * compose-topology-drain — fire compose_topology_tick on a cadence (decoupled
 * from the boredom selector).
 *
 * compose_topology_tick is the substrate's organic edge-former: it picks an
 * uncomposed, non-hub chainable pair (producer output shape -> consumer input
 * shape) and authors+dispatches a composite activity, which forms a genuine
 * cross-link composition edge (raises lambda2, breaks the star topology). It
 * is goal[49] of 49 in the boredom goal-dispatch rotation, which is dormant
 * (0 autonomous dispatches observed over 40min) while the active pool/shape
 * loop only runs observer/audit ticks. So the edge-former never runs and
 * distinct/genuine edges sit flat. This oneshot guarantees it fires on a
 * cadence.
 *
 * Self-limiting: compose_topology_tick caps total composites (max_composites,
 * default 300). At the cap it returns reinforced_existing instead of authoring
 * a new composite, so this cadence cannot run away minting cells — it adds
 * edges only while headroom exists, then idles. Reads no args; emits one JSON
 * line for the journal.
 */
const DEV_VESSEL = process.env["DEV_VESSEL_ENDPOINT"] ?? "http://127.0.0.1:8090";

async function main(): Promise<void> {
  const started = new Date().toISOString();
  let outcome: Record<string, unknown> = { at: started, action: "compose_topology_tick" };
  try {
    const res = await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ impulse: { type: "compose_topology_tick", config: { type: "compose_topology_tick" } } }),
      signal: AbortSignal.timeout(200_000),
    });
    const body = (await res.json()) as { shape?: string; body?: Record<string, unknown> };
    const b = body.body ?? {};
    outcome = {
      ...outcome,
      http: res.status,
      shape: body.shape ?? null,
      composer_action: (b as { action?: unknown }).action ?? null,
      composite: (b as { composite?: unknown }).composite ?? null,
      existing_composites: (b as { existing_composites?: unknown }).existing_composites ?? null,
      chainable_pairs_available: (b as { chainable_pairs_available?: unknown }).chainable_pairs_available ?? null,
      under_cap: (b as { under_cap?: unknown }).under_cap ?? null,
      star_ratio: (b as { star_ratio?: unknown }).star_ratio ?? null,
      headroom: (b as { headroom?: unknown }).headroom ?? null,
    };
  } catch (err) {
    outcome = { ...outcome, error: err instanceof Error ? err.message : String(err) };
  }
  console.log(JSON.stringify(outcome));
}

void main();
