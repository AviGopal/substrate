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
/**
 * Compute the decomposition depth for `targetShapes` given `seedPool`.
 *
 * @param targetShapes    The shapes the goal needs to produce.
 * @param seedPool        Shapes already available at goal start (initial impulse pool).
 * @param activityEndpoint  Activity-API base URL.
 * @param authHeaders     Authorization headers.
 * @returns Depth: 0 | 1 | 2 | "3+"
 */
export declare function computeDecompositionDepth(targetShapes: string[], seedPool: string[], activityEndpoint: string, authHeaders: Record<string, string>): Promise<Depth>;
/**
 * Batch computation — same as above but for multiple goal targets.
 * Fetches producers once per unique shape set to reduce API calls.
 */
export declare function computeDecompositionDepthBatch(goals: Array<{
    id: string;
    targetShapes: string[];
    seedPool: string[];
}>, activityEndpoint: string, authHeaders: Record<string, string>): Promise<Map<string, Depth>>;
//# sourceMappingURL=decomposition-depth.d.ts.map