"use strict";
/**
 * Unit tests for decomposition-depth.ts — G1.1.2 acceptance criteria.
 * 6 fixtures covering depth 0, 1, 2, 3+, empty seed, and empty target.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const decomposition_depth_1 = require("./decomposition-depth");
function makeMockFetch(templates) {
    return (0, bun_test_1.mock)(async () => Response.json({
        activities: templates.map((t, i) => ({
            id: `tpl-${i}`,
            input_shapes: t.input_shapes,
            output_shapes: t.output_shapes,
            alpha: 2,
            beta: 1,
            total_executions: 5,
        })),
    }));
}
const AUTH = { Authorization: "ApiKey test-key" };
const ENDPOINT = "https://activity.metabob.com";
// ---------------------------------------------------------------------------
// Graph used by fixtures 1-4:
//
//   tpl-A: [] → [shapeX]          (no inputs needed)
//   tpl-B: [shapeX] → [shapeY]
//   tpl-C: [shapeY] → [shapeZ]
//   tpl-D: [] → [shapeW]          (unreachable without seed for shapeQ)
//   tpl-E: [shapeQ] → [shapeW]    (only reachable if shapeQ in seed)
// ---------------------------------------------------------------------------
const GRAPH = [
    { input_shapes: [], output_shapes: ["shapeX"] },
    { input_shapes: ["shapeX"], output_shapes: ["shapeY"] },
    { input_shapes: ["shapeY"], output_shapes: ["shapeZ"] },
    { input_shapes: [], output_shapes: ["shapeW"] },
    { input_shapes: ["shapeQ"], output_shapes: ["shapeW"] },
];
(0, bun_test_1.describe)("computeDecompositionDepth", () => {
    // Fixture 1: all shapes reachable via template chain — depth 0
    (0, bun_test_1.test)("fixture 1: all targets reachable via chain (depth 0)", async () => {
        const origFetch = globalThis.fetch;
        globalThis.fetch = makeMockFetch(GRAPH);
        try {
            // shapeZ is reachable: [] → shapeX → shapeY → shapeZ
            const depth = await (0, decomposition_depth_1.computeDecompositionDepth)(["shapeZ"], [], ENDPOINT, AUTH);
            (0, bun_test_1.expect)(depth).toBe(0);
        }
        finally {
            globalThis.fetch = origFetch;
        }
    });
    // Fixture 2: one target shape unreachable (no template produces shapeV) — depth 1
    (0, bun_test_1.test)("fixture 2: one unreachable target (depth 1)", async () => {
        const origFetch = globalThis.fetch;
        globalThis.fetch = makeMockFetch(GRAPH);
        try {
            // shapeV has no producer in GRAPH
            const depth = await (0, decomposition_depth_1.computeDecompositionDepth)(["shapeX", "shapeV"], [], ENDPOINT, AUTH);
            (0, bun_test_1.expect)(depth).toBe(1);
        }
        finally {
            globalThis.fetch = origFetch;
        }
    });
    // Fixture 3: two unreachable shapes — depth 2
    (0, bun_test_1.test)("fixture 3: two unreachable targets (depth 2)", async () => {
        const origFetch = globalThis.fetch;
        globalThis.fetch = makeMockFetch(GRAPH);
        try {
            // shapeV and shapeM both have no producers in GRAPH
            const depth = await (0, decomposition_depth_1.computeDecompositionDepth)(["shapeX", "shapeV", "shapeM"], [], ENDPOINT, AUTH);
            (0, bun_test_1.expect)(depth).toBe(2);
        }
        finally {
            globalThis.fetch = origFetch;
        }
    });
    // Fixture 4: three+ unreachable shapes — depth 3+
    (0, bun_test_1.test)("fixture 4: three unreachable targets (depth 3+)", async () => {
        const origFetch = globalThis.fetch;
        globalThis.fetch = makeMockFetch(GRAPH);
        try {
            // shapeV, shapeM, shapeN all missing producers
            const depth = await (0, decomposition_depth_1.computeDecompositionDepth)(["shapeX", "shapeV", "shapeM", "shapeN"], [], ENDPOINT, AUTH);
            (0, bun_test_1.expect)(depth).toBe("3+");
        }
        finally {
            globalThis.fetch = origFetch;
        }
    });
    // Fixture 5: target already in seed pool — depth 0 without any fetch
    (0, bun_test_1.test)("fixture 5: target already in seed pool (depth 0, no templates needed)", async () => {
        const origFetch = globalThis.fetch;
        // Use empty graph — if fetch is called and returns no templates,
        // depth should still be 0 because the seed already has the target.
        globalThis.fetch = makeMockFetch([]);
        try {
            const depth = await (0, decomposition_depth_1.computeDecompositionDepth)(["shapeX"], ["shapeX", "shapeY"], // seed already contains target
            ENDPOINT, AUTH);
            (0, bun_test_1.expect)(depth).toBe(0);
        }
        finally {
            globalThis.fetch = origFetch;
        }
    });
    // Fixture 6: empty target shapes — depth 0
    (0, bun_test_1.test)("fixture 6: empty target list (depth 0)", async () => {
        const origFetch = globalThis.fetch;
        globalThis.fetch = makeMockFetch(GRAPH);
        try {
            const depth = await (0, decomposition_depth_1.computeDecompositionDepth)([], [], ENDPOINT, AUTH);
            (0, bun_test_1.expect)(depth).toBe(0);
        }
        finally {
            globalThis.fetch = origFetch;
        }
    });
});
//# sourceMappingURL=decomposition-depth.test.js.map