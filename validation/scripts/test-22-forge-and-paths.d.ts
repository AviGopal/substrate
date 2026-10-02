/**
 * Phase 22 acceptance test — forge + dispatch paths
 *
 * Runs the forge-vessel-for-shape template end-to-end using VesselForgeHost
 * and asserts the six dispatch paths (A–F) all succeed without path-specific code.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   METABOB_API_KEY=mb_... \
 *   CONCEPT_DB_URL=http://localhost:13001 \
 *   CONCEPT_DB_KEY=mb-... \
 *   DISCOVERY_URL=https://discovery.metabob.com \
 *   bun run validation/scripts/test-22-forge-and-paths.ts
 *
 * Prerequisites:
 *   kubectl port-forward -n activity-system svc/concept-db 13001:8081 &
 */
export {};
//# sourceMappingURL=test-22-forge-and-paths.d.ts.map