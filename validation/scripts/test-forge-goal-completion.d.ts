/**
 * forge-goal-completion test
 *
 * End-to-end test that exercises the vessel-forge pipeline as a CONSEQUENCE
 * of slot-binding escalation triggered by a real user-level goal. Distinct
 * from validation/scripts/test-22-forge-and-paths.ts which calls
 * VesselForgeHost directly.
 *
 * Spec: openspec/changes/2026-05-18-forge-goal-completion-test/
 *   - proposal.md
 *   - design.md (assertion tables §c, §d; witness defs §g)
 *   - specs/forge-goal-completion-test/spec.md (R1..R8)
 *   - tasks.md (T1..T6)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   METABOB_API_KEY=mb_... \
 *   ACTIVITY_API_URL=https://activity.metabob.com \
 *   DISCOVERY_URL=https://discovery.metabob.com \
 *   TARGET_SHAPE=webhook_signature_verifier \
 *   VARIANT=single-step-depth-0 \
 *   bun run validation/scripts/test-forge-goal-completion.ts
 */
export {};
//# sourceMappingURL=test-forge-goal-completion.d.ts.map