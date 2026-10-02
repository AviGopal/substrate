/**
 * DOES THE CHAIN ACTUALLY MOVE THE ARGUMENTS? — the end-to-end check, in one process.
 *
 * The argument-recording chain was declared closed twice and was inert both times. Every
 * component test passed on both occasions, because every component was correct; what was
 * broken was the JOIN between components, and a per-repo test cannot see a join that spans
 * two repos.
 *
 * So this harness runs the REAL code of both sides against one another:
 *
 *   engine record  ──▶  TranslatingTraceSink (real, ias-executor-ts)
 *                          │  captured at an injected fetch — the actual wire bytes
 *                          ▼
 *                  normalizePersistedTask (real, activity-api)   ── the write boundary
 *                          ▼
 *                  extractTasks           (real, activity-api)   ── the read projection
 *                          ▼
 *                  the config a ribosome extraction would copy
 *
 * Nothing here is a stub of the thing under test and no constant is copied between the
 * sides: the payload the store parses is the payload the sink serialized, byte for byte.
 *
 * WHAT THIS DOES AND DOES NOT PROVE. It proves the four in-process seams agree — which is
 * exactly what was broken, twice, and is the claim that had gone unverified. It does NOT
 * prove production behaviour: the deployed hub runs its own build, and a live trace has never
 * carried this field. That check is one goal dispatch plus one query, and it needs an
 * operator.
 *
 * Run: bun test validation/scripts/argument-chain-check.test.ts
 */
export {};
//# sourceMappingURL=argument-chain-check.test.d.ts.map