/**
 * topology-gap-band.ts — G1.1.3
 *
 * Classifies a set of required output shapes as Scenario A / B / C / D:
 *
 *   A — Rich topology: every required shape has ≥ 1 known producer with α/(α+β) > 0.5
 *   B — Sparse topology: at least one required shape has a producer but cold posterior
 *       (total_executions ≤ 2 or α/(α+β) < 0.5)
 *   C — Missing activity, extant vessel: no template produces the shape but a connected
 *       vessel advertises a resolver for it
 *   D — Missing vessel: no connected vessel advertises the shape at all
 *
 * Uses activity-api POST /v2/activities/discover-by-shapes (backward mode) for template
 * coverage and Thompson posteriors, then falls back to the discovery-vessel registry
 * shapes list to check C vs D.
 */

interface DiscoverMatch {
  id?: string;
  template_id?: string;
  activity_id?: string;
  output_shapes?: string[];
  alpha?: number;
  beta?: number;
  total_executions?: number;
  sample_count?: number;
  composition_score?: number;
}

interface DiscoverResponse {
  activities?: DiscoverMatch[];
  templates?: DiscoverMatch[];
  matches?: DiscoverMatch[];
  data?: DiscoverMatch[];
}

/**
 * Classify the topology gap for a set of required output shapes.
 *
 * @param shapes        The output shapes needed
 * @param activityEndpoint  Activity-API base URL
 * @param discoveryEndpoint Discovery-vessel base URL
 * @param authHeaders   Authorization headers
 */
export async function classifyTopologyGap(
  shapes: string[],
  activityEndpoint: string,
  discoveryEndpoint: string,
  authHeaders: Record<string, string>
): Promise<"A" | "B" | "C" | "D"> {
  if (shapes.length === 0) return "A";

  // Step 1: Check activity-api for templates that produce these shapes (backward mode)
  let matches: DiscoverMatch[] = [];
  try {
    const resp = await fetch(`${activityEndpoint}/v2/activities/discover-by-shapes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ output_shapes: shapes, mode: "backward" }),
      signal: AbortSignal.timeout(15_000),
    });

    if (resp.ok) {
      const body = (await resp.json()) as DiscoverResponse;
      matches =
        body.activities ??
        body.templates ??
        body.matches ??
        body.data ??
        [];
    }
  } catch {
    // Non-fatal: treat as no matches
  }

  // Determine which shapes have template producers
  const shapesWithTemplate = new Set<string>();
  const shapesWithColdTemplate = new Set<string>();

  for (const match of matches) {
    const outputShapes = match.output_shapes ?? [];
    const alpha = match.alpha ?? 1;
    const beta = match.beta ?? 1;
    const totalExecs =
      match.total_executions ??
      match.sample_count ??
      Math.max(0, (alpha - 1) + (beta - 1));

    const ev = alpha / (alpha + beta);
    const isCold = totalExecs <= 2 || ev < 0.5;

    for (const shape of outputShapes) {
      if (shapes.includes(shape)) {
        shapesWithTemplate.add(shape);
        if (isCold) shapesWithColdTemplate.add(shape);
      }
    }
  }

  // Check which required shapes have NO template producer
  const shapesWithoutTemplate = shapes.filter((s) => !shapesWithTemplate.has(s));

  if (shapesWithoutTemplate.length === 0) {
    // All shapes have templates. Are any cold?
    if (shapesWithColdTemplate.size > 0) return "B";
    return "A";
  }

  // Some shapes have no template — check discovery-vessel registry
  // to decide between C (vessel exists) and D (no vessel)
  let discoveryShapes: string[] = [];
  try {
    const resp = await fetch(`${discoveryEndpoint}/registry/shapes`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.ok) {
      const body = (await resp.json()) as { shapes?: string[] };
      discoveryShapes = body.shapes ?? [];
    }
  } catch {
    // Non-fatal: assume no discovery coverage
  }

  const discoveryShapeSet = new Set(discoveryShapes);

  for (const shape of shapesWithoutTemplate) {
    if (discoveryShapeSet.has(shape)) {
      // At least one shape has a vessel resolver but no template → Scenario C
      return "C";
    }
  }

  // No template and no vessel for any missing shape → Scenario D
  return "D";
}
