/**
 * mirror-memory-note.ts — mirror a single operator memory file into the
 * substrate's memoryNote store. Called by the substrate-memory-mirror
 * PostToolUse hook, but also runnable by hand:
 *
 *   DEV_VESSEL_ENDPOINT=http://localhost:18090 bun mirror-memory-note.ts <file.md>
 *
 * Id scheme matches import-operator-memory.ts (`operator-import:<stem>`) so a
 * later edit upserts the same note rather than creating a duplicate. Provenance
 * is tagged `harness-mirror` to distinguish hook-written notes from the one-shot
 * import. Fail-open: any error is logged to stderr and the process exits 0 — a
 * memory mirror must never break the caller.
 */
export {};
//# sourceMappingURL=mirror-memory-note.d.ts.map