/**
 * shape-signature-pool.ts — G1.1.1
 *
 * Scans executionTraceWithSignatures over the last 30 days and emits a
 * Map keyed by canonical shape signature:
 *
 *   "(sorted_inputs) -> (sorted_outputs)"
 *
 * Each entry includes the input_shapes, output_shapes, and occurrence count.
 *
 * Graceful degradation: if no traces are returned or shapes are missing,
 * returns the pool with whatever was found (at least one synthetic fallback
 * entry so callers always have something to work with).
 */
export interface ShapeSignatureEntry {
    input_shapes: string[];
    output_shapes: string[];
    count: number;
}
/**
 * Build the shape-signature pool from executionTraceWithSignatures.
 *
 * @param endpoint     Activity-API base URL
 * @param authHeaders  Authorization headers
 */
export declare function buildShapeSignaturePool(endpoint: string, authHeaders: Record<string, string>): Promise<Map<string, ShapeSignatureEntry>>;
//# sourceMappingURL=shape-signature-pool.d.ts.map