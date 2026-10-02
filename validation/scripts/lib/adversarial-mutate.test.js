"use strict";
/**
 * Unit tests for adversarial-mutate.ts — G1.3.1 acceptance criteria.
 *
 * Acceptance: seeded LLM call (temperature=0) returns identical output across
 * two runs given identical input.
 *
 * Tests:
 *   1. swap_output_shape mutation replaces expected_output_shapes
 *   2. narrow_constraint mutation appends to goal_text
 *   3. prompt_hash is stable (same goal → same hash)
 *   4. Two calls with identical input produce identical AdversarialGoal
 *   5. Markdown fences in LLM response are stripped
 *   6. Unknown mutation_type throws
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const adversarial_mutate_1 = require("./adversarial-mutate");
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BASE_GOAL = {
    id: "gen-42-001",
    cell_id: "seen.depth0.A",
    shape_signature: { input: ["file"], output: ["fileEdit"] },
    goal_text: "Refactor the authentication module",
    expected_output_shapes: ["fileEdit"],
    seed_impulse_pool: ["file:seed"],
    adversarial: false,
    oracle_label_id: null,
    generator_seed: "42",
    shape_registry_snapshot_hash: "abc123",
};
// ---------------------------------------------------------------------------
// Mock fetch helper
// ---------------------------------------------------------------------------
function makeMockFetch(responseText) {
    return (0, bun_test_1.mock)(async (_url, _init) => Response.json({
        content: [{ type: "text", text: responseText }],
    }));
}
let savedFetch;
(0, bun_test_1.beforeEach)(() => {
    savedFetch = globalThis.fetch;
});
(0, bun_test_1.afterEach)(() => {
    globalThis.fetch = savedFetch;
});
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("adversarial-mutate", () => {
    (0, bun_test_1.test)("swap_output_shape replaces expected_output_shapes", async () => {
        globalThis.fetch = makeMockFetch('{"mutation_type":"swap_output_shape","payload":{"new_shape":"databaseRecord"}}');
        const result = await (0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "test-key" });
        (0, bun_test_1.expect)(result.adversarial).toBe(true);
        (0, bun_test_1.expect)(result.mutation_type).toBe("swap_output_shape");
        (0, bun_test_1.expect)(result.expected_output_shapes).toEqual(["databaseRecord"]);
        (0, bun_test_1.expect)(result.goal_text).toBe(BASE_GOAL.goal_text); // unchanged
        (0, bun_test_1.expect)(result.mutation_payload).toEqual({ new_shape: "databaseRecord" });
    });
    (0, bun_test_1.test)("narrow_constraint appends constraint to goal_text", async () => {
        globalThis.fetch = makeMockFetch('{"mutation_type":"narrow_constraint","payload":{"constraint":"without modifying test files"}}');
        const result = await (0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "test-key" });
        (0, bun_test_1.expect)(result.adversarial).toBe(true);
        (0, bun_test_1.expect)(result.mutation_type).toBe("narrow_constraint");
        (0, bun_test_1.expect)(result.goal_text).toBe("Refactor the authentication module (without modifying test files)");
        (0, bun_test_1.expect)(result.expected_output_shapes).toEqual(BASE_GOAL.expected_output_shapes); // unchanged
    });
    (0, bun_test_1.test)("prompt_hash is stable — same goal produces same hash", async () => {
        globalThis.fetch = makeMockFetch('{"mutation_type":"narrow_constraint","payload":{"constraint":"only touching src/"}}');
        const r1 = await (0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "k1" });
        globalThis.fetch = makeMockFetch('{"mutation_type":"narrow_constraint","payload":{"constraint":"only touching src/"}}');
        const r2 = await (0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "k2" });
        // prompt_hash derives from the goal fields, not from the API key
        (0, bun_test_1.expect)(r1.prompt_hash).toBe(r2.prompt_hash);
        (0, bun_test_1.expect)(r1.prompt_hash).toHaveLength(16);
    });
    (0, bun_test_1.test)("identical input produces identical AdversarialGoal (determinism assertion)", async () => {
        const llmPayload = '{"mutation_type":"swap_output_shape","payload":{"new_shape":"apiResponse"}}';
        globalThis.fetch = makeMockFetch(llmPayload);
        const run1 = await (0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "test-key" });
        globalThis.fetch = makeMockFetch(llmPayload);
        const run2 = await (0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "test-key" });
        (0, bun_test_1.expect)(run1).toEqual(run2);
    });
    (0, bun_test_1.test)("markdown fences in LLM response are stripped before JSON parse", async () => {
        globalThis.fetch = makeMockFetch("```json\n{\"mutation_type\":\"narrow_constraint\",\"payload\":{\"constraint\":\"only for prod\"}}\n```");
        const result = await (0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "test-key" });
        (0, bun_test_1.expect)(result.mutation_type).toBe("narrow_constraint");
    });
    (0, bun_test_1.test)("unknown mutation_type in LLM response throws", async () => {
        globalThis.fetch = makeMockFetch('{"mutation_type":"invalid_type","payload":{}}');
        await (0, bun_test_1.expect)((0, adversarial_mutate_1.mutateGoal)(BASE_GOAL, { anthropicApiKey: "test-key" })).rejects.toThrow("Unknown mutation_type");
    });
    (0, bun_test_1.test)("buildPrompt includes goal_text and output shapes", () => {
        const prompt = (0, adversarial_mutate_1.buildPrompt)(BASE_GOAL);
        (0, bun_test_1.expect)(prompt).toContain(BASE_GOAL.goal_text);
        (0, bun_test_1.expect)(prompt).toContain("fileEdit");
        (0, bun_test_1.expect)(prompt).toContain("swap_output_shape");
        (0, bun_test_1.expect)(prompt).toContain("narrow_constraint");
    });
});
//# sourceMappingURL=adversarial-mutate.test.js.map