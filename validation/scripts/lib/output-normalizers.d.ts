/**
 * output-normalizers.ts — G6.3.1
 *
 * Per-shape output normalizers for the differential-solve / witness-pairing
 * harness (G6.2).  A normalizer converts a raw impulse body (unknown at
 * runtime) into a canonical, deterministic form so that two runs producing
 * semantically equivalent output are treated as "agreed".
 *
 * Four built-in shapes:
 *   fileEdit         — trim per-line whitespace + normalise line endings
 *   validation_result — extract structural verdict fields, drop timestamps
 *   gitDiff          — parse into sorted file-patch records
 *   directoryTree    — sort path list, normalise separators
 *
 * All other shapes fall back to canonical JSON (deep-sorted keys).
 *
 * Public API:
 *   normalizeOutput(shape, body) → unknown   (normalised canonical form)
 *   outputsAgree(shape, a, b) → bool
 *   diffOutputs(shape, a, b) → null | Record<string,unknown>
 */
export declare function normalizeOutput(shape: string, body: unknown): unknown;
export declare function outputsAgree(shape: string, a: unknown, b: unknown): boolean;
export declare function diffOutputs(shape: string, a: unknown, b: unknown): Record<string, unknown> | null;
//# sourceMappingURL=output-normalizers.d.ts.map