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
/**
 * Classify the topology gap for a set of required output shapes.
 *
 * @param shapes        The output shapes needed
 * @param activityEndpoint  Activity-API base URL
 * @param discoveryEndpoint Discovery-vessel base URL
 * @param authHeaders   Authorization headers
 */
export declare function classifyTopologyGap(shapes: string[], activityEndpoint: string, discoveryEndpoint: string, authHeaders: Record<string, string>): Promise<"A" | "B" | "C" | "D">;
//# sourceMappingURL=topology-gap-band.d.ts.map