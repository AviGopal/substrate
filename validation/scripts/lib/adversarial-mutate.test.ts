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

import { describe, test, expect, mock, afterEach, beforeEach } from "bun:test";
import { mutateGoal, buildPrompt } from "./adversarial-mutate";
import type { GeneratedGoal } from "../goal-generator";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_GOAL: GeneratedGoal = {
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

function makeMockFetch(responseText: string) {
  return mock(async (_url: string, _init?: RequestInit) =>
    Response.json({
      content: [{ type: "text", text: responseText }],
    })
  );
}

let savedFetch: typeof globalThis.fetch;

beforeEach(() => {
  savedFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = savedFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("adversarial-mutate", () => {
  test("swap_output_shape replaces expected_output_shapes", async () => {
    globalThis.fetch = makeMockFetch(
      '{"mutation_type":"swap_output_shape","payload":{"new_shape":"databaseRecord"}}'
    );

    const result = await mutateGoal(BASE_GOAL, { anthropicApiKey: "test-key" });

    expect(result.adversarial).toBe(true);
    expect(result.mutation_type).toBe("swap_output_shape");
    expect(result.expected_output_shapes).toEqual(["databaseRecord"]);
    expect(result.goal_text).toBe(BASE_GOAL.goal_text); // unchanged
    expect(result.mutation_payload).toEqual({ new_shape: "databaseRecord" });
  });

  test("narrow_constraint appends constraint to goal_text", async () => {
    globalThis.fetch = makeMockFetch(
      '{"mutation_type":"narrow_constraint","payload":{"constraint":"without modifying test files"}}'
    );

    const result = await mutateGoal(BASE_GOAL, { anthropicApiKey: "test-key" });

    expect(result.adversarial).toBe(true);
    expect(result.mutation_type).toBe("narrow_constraint");
    expect(result.goal_text).toBe("Refactor the authentication module (without modifying test files)");
    expect(result.expected_output_shapes).toEqual(BASE_GOAL.expected_output_shapes); // unchanged
  });

  test("prompt_hash is stable — same goal produces same hash", async () => {
    globalThis.fetch = makeMockFetch(
      '{"mutation_type":"narrow_constraint","payload":{"constraint":"only touching src/"}}'
    );

    const r1 = await mutateGoal(BASE_GOAL, { anthropicApiKey: "k1" });

    globalThis.fetch = makeMockFetch(
      '{"mutation_type":"narrow_constraint","payload":{"constraint":"only touching src/"}}'
    );

    const r2 = await mutateGoal(BASE_GOAL, { anthropicApiKey: "k2" });

    // prompt_hash derives from the goal fields, not from the API key
    expect(r1.prompt_hash).toBe(r2.prompt_hash);
    expect(r1.prompt_hash).toHaveLength(16);
  });

  test("identical input produces identical AdversarialGoal (determinism assertion)", async () => {
    const llmPayload = '{"mutation_type":"swap_output_shape","payload":{"new_shape":"apiResponse"}}';

    globalThis.fetch = makeMockFetch(llmPayload);
    const run1 = await mutateGoal(BASE_GOAL, { anthropicApiKey: "test-key" });

    globalThis.fetch = makeMockFetch(llmPayload);
    const run2 = await mutateGoal(BASE_GOAL, { anthropicApiKey: "test-key" });

    expect(run1).toEqual(run2);
  });

  test("markdown fences in LLM response are stripped before JSON parse", async () => {
    globalThis.fetch = makeMockFetch(
      "```json\n{\"mutation_type\":\"narrow_constraint\",\"payload\":{\"constraint\":\"only for prod\"}}\n```"
    );

    const result = await mutateGoal(BASE_GOAL, { anthropicApiKey: "test-key" });
    expect(result.mutation_type).toBe("narrow_constraint");
  });

  test("unknown mutation_type in LLM response throws", async () => {
    globalThis.fetch = makeMockFetch('{"mutation_type":"invalid_type","payload":{}}');

    await expect(
      mutateGoal(BASE_GOAL, { anthropicApiKey: "test-key" })
    ).rejects.toThrow("Unknown mutation_type");
  });

  test("buildPrompt includes goal_text and output shapes", () => {
    const prompt = buildPrompt(BASE_GOAL);
    expect(prompt).toContain(BASE_GOAL.goal_text);
    expect(prompt).toContain("fileEdit");
    expect(prompt).toContain("swap_output_shape");
    expect(prompt).toContain("narrow_constraint");
  });
});
