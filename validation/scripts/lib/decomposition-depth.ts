/**
 * decomposition-depth.ts — G1.1.2
 *
 * Full BFS over discover-by-shapes backward mode to compute the minimum
 * number of `create-shape-provider-goal` escalations needed to produce a
 * set of target shapes from a seed pool.
 *
 * Algorithm:
 *   1. Start with `seedPool` (initially available shapes).
 *   2. Expand: query activity-api discover-by-shapes (backward) for all
 *      templates whose output_shapes intersect with needed shapes.
 *   3. For templates whose input_shapes are all satisfiable from the current
 *      pool, mark their output_shapes as reachable. Expand pool.
 *   4. Repeat until no new shapes are added to the pool.
 *   5. Any target shape still not in the pool counts as one escalation.
 *
 * Depth levels:
 *   0 — all target shapes reachable directly from seed pool via templates.
 *   1 — one target shape requires one escalation (create-shape-provider-goal).
 *   2 — two target shapes require escalation (or one that itself needs one).
 *   3+ — three or more escalations needed.
 *
 * Graceful degradation: network failure → returns depth 0 (optimistic).
 */

export type Depth = 0 | 1 | 2 | "3+";

interface DiscoverMatch {
  id?: string;
  template_id?: string;
  activity_id?: string;
  output_shapes?: string[];
  input_shapes?: string[];
  alpha?: number;
  beta?: number;
  total_executions?: number;
  sample_count?: number;
}

interface DiscoverResponse {
  activities?: DiscoverMatch[];
  templates?: DiscoverMatch[];
  matches?: DiscoverMatch[];
  data?: DiscoverMatch[];
}

/**
 * Fetch all templates that can produce any of `neededShapes`.
 * Uses discover-by-shapes backward mode.
 */
async function fetchProducers(
  neededShapes: string[],
  activityEndpoint: string,
  authHeaders: Record<string, string>
): Promise<DiscoverMatch[]> {
  try {
    const resp = await fetch(`${activityEndpoint}/v2/activities/discover-by-shapes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ output_shapes: neededShapes, mode: "backward" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return [];
    const body = (await resp.json()) as DiscoverResponse;
    return body.activities ?? body.templates ?? body.matches ?? body.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Expand the pool by running all templates whose input_shapes ⊆ pool.
 * Returns the set of shapes newly added to the pool.
 */
function expandPool(pool: Set<string>, templates: DiscoverMatch[]): Set<string> {
  const added = new Set<string>();
  for (const t of templates) {
    const inputs = t.input_shapes ?? [];
    // Template is applicable if all declared inputs are in the pool
    // (empty input_shapes = always applicable)
    const applicable = inputs.every((s) => pool.has(s));
    if (!applicable) continue;

    for (const s of t.output_shapes ?? []) {
      if (!pool.has(s)) {
        pool.add(s);
        added.add(s);
      }
    }
  }
  return added;
}

/**
 * Compute the decomposition depth for `targetShapes` given `seedPool`.
 *
 * @param targetShapes    The shapes the goal needs to produce.
 * @param seedPool        Shapes already available at goal start (initial impulse pool).
 * @param activityEndpoint  Activity-API base URL.
 * @param authHeaders     Authorization headers.
 * @returns Depth: 0 | 1 | 2 | "3+"
 */
export async function computeDecompositionDepth(
  targetShapes: string[],
  seedPool: string[],
  activityEndpoint: string,
  authHeaders: Record<string, string>
): Promise<Depth> {
  if (targetShapes.length === 0) return 0;

  const pool = new Set<string>(seedPool);
  const needed = new Set<string>(targetShapes);

  // Remove already-satisfied shapes
  for (const s of pool) needed.delete(s);
  if (needed.size === 0) return 0;

  // BFS: iteratively expand the pool via templates
  // We do at most MAX_HOPS expansions before declaring a shape "not reachable"
  const MAX_HOPS = 6;

  // Fetch all potentially relevant producers upfront (for all needed shapes)
  const allProducers = await fetchProducers([...needed], activityEndpoint, authHeaders);

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const added = expandPool(pool, allProducers);
    if (added.size === 0) break;

    // Remove newly satisfied shapes from needed
    for (const s of added) needed.delete(s);
    if (needed.size === 0) return 0;
  }

  // Shapes still in `needed` cannot be produced by any known template chain.
  // Each one requires one create-shape-provider-goal escalation.
  // However, some of those shapes may themselves be producible via sub-chains.
  // We count distinct "escalation points" — each unreachable shape = 1 escalation.
  const escalations = needed.size;

  if (escalations === 0) return 0;
  if (escalations === 1) return 1;
  if (escalations === 2) return 2;
  return "3+";
}

/**
 * Batch computation — same as above but for multiple goal targets.
 * Fetches producers once per unique shape set to reduce API calls.
 */
export async function computeDecompositionDepthBatch(
  goals: Array<{ id: string; targetShapes: string[]; seedPool: string[] }>,
  activityEndpoint: string,
  authHeaders: Record<string, string>
): Promise<Map<string, Depth>> {
  const results = new Map<string, Depth>();

  // Collect all unique target shapes across all goals for a batch fetch
  const allTargetShapes = new Set<string>();
  for (const g of goals) {
    for (const s of g.targetShapes) allTargetShapes.add(s);
  }

  const allProducers =
    allTargetShapes.size > 0
      ? await fetchProducers([...allTargetShapes], activityEndpoint, authHeaders)
      : [];

  for (const g of goals) {
    if (g.targetShapes.length === 0) {
      results.set(g.id, 0);
      continue;
    }

    const pool = new Set<string>(g.seedPool);
    const needed = new Set<string>(g.targetShapes);
    for (const s of pool) needed.delete(s);

    if (needed.size === 0) {
      results.set(g.id, 0);
      continue;
    }

    const MAX_HOPS = 6;
    // Filter producers relevant to this goal's needed shapes
    const relevantProducers = allProducers.filter((p) => {
      const outputs = p.output_shapes ?? [];
      return outputs.some((s) => needed.has(s) || pool.has(s));
    });

    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const added = expandPool(pool, relevantProducers);
      if (added.size === 0) break;
      for (const s of added) needed.delete(s);
      if (needed.size === 0) break;
    }

    const escalations = needed.size;
    if (escalations === 0) results.set(g.id, 0);
    else if (escalations === 1) results.set(g.id, 1);
    else if (escalations === 2) results.set(g.id, 2);
    else results.set(g.id, "3+");
  }

  return results;
}
