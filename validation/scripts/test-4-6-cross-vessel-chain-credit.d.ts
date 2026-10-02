/**
 * Integration test Phase 4.6 — Cross-vessel composition-chain credit propagation
 *
 * Ports 18.4.7 to a 3-vessel topology:
 *   goal-host-vessel (orchestrator)
 *     → llm-resolver-vessel (parent resolver)
 *       → local-tools-vessel (leaf)
 *
 * Each trace carries a distinct vessel_id. The test asserts that:
 *   1. Cross-vessel composition_chain credit propagation reaches the grandparent
 *      template even when traces originate from different vessels.
 *   2. Δα at the grandparent matches γ^2 = 0.25 (CREDIT_PROPAGATION_GAMMA=0.5, depth 2).
 *
 * This validates that vessel_id is not used as a credit-propagation guard —
 * chain credit flows across the vessel boundary.
 *
 * Run:
 *   METABOB_API_KEY=<key> bun run validation/scripts/test-4-6-cross-vessel-chain-credit.ts
 */
export {};
//# sourceMappingURL=test-4-6-cross-vessel-chain-credit.d.ts.map