/**
 * adversarial-mutate.ts — G1.3.1
 *
 * Takes a passing GeneratedGoal and produces an AdversarialGoal by calling
 * an LLM at temperature=0.  Two mutation types are supported:
 *
 *   swap_output_shape    — replace expected_output_shapes with a related-but-
 *                          different shape, making the goal harder to satisfy.
 *   narrow_constraint    — append a narrowing constraint to goal_text (e.g.,
 *                          "without modifying X", "only using Y"), leaving the
 *                          output shapes unchanged but restricting the solution.
 *
 * Determinism guarantee: prompt is derived only from the source goal's stable
 * fields, temperature is 0, and model is pinned.  The same input always
 * produces the same output.
 *
 * Usage (see goal-generator.ts G1.3.2 wiring):
 *   const adversarial = await mutateGoal(goal, { apiKey, anthropicApiKey, endpoint });
 */

import { createHash } from "node:crypto";
import type { GeneratedGoal } from "../goal-generator";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MutationType = "swap_output_shape" | "narrow_constraint";

export interface AdversarialGoal extends Omit<GeneratedGoal, "adversarial"> {
  adversarial: true;
  mutation_type: MutationType;
  /** Raw LLM payload — shape depends on mutation_type. */
  mutation_payload: Record<string, unknown>;
  llm_model: string;
  prompt_hash: string;
}

export type HarnessGoal = GeneratedGoal | AdversarialGoal;

// ---------------------------------------------------------------------------
// LLM call (no external SDK; raw fetch, same pattern as test-22-forge-and-paths)
// ---------------------------------------------------------------------------

const ADVERSARIAL_MODEL = "claude-haiku-4-5-20251001";

interface LLMResponse {
  mutation_type: MutationType;
  /** swap_output_shape: { new_shape: string }
   *  narrow_constraint: { constraint: string } */
  payload: Record<string, unknown>;
}

function buildPrompt(goal: GeneratedGoal): string {
  // Serialise deterministically so prompt_hash is stable across runs.
  const outputShapes = [...goal.expected_output_shapes].sort().join(", ");
  const inputShapes = [...goal.seed_impulse_pool]
    .map((s) => s.replace(/:seed$/, ""))
    .sort()
    .join(", ");

  return `You are a test-harness adversary.  Your task is to make the following goal HARDER to satisfy by applying exactly ONE mutation.

Goal text: ${goal.goal_text}
Expected output shapes: ${outputShapes}
Input shapes available: ${inputShapes || "(none)"}

Choose one mutation type:

1. swap_output_shape — replace the expected output shape with a DIFFERENT but plausible shape
   that a different activity template would produce (not a trivially related synonym).
   Example: "fileEdit" → "databaseRecord" when the goal can be re-read as a DB write.

2. narrow_constraint — append a constraint to the goal text that narrows the solution space
   without changing the output shapes.
   Example: "Refactor the auth module" → "Refactor the auth module without modifying test files".

Respond with ONLY a JSON object on a single line (no markdown, no prose):
{"mutation_type":"swap_output_shape","payload":{"new_shape":"<shape>"}}
OR
{"mutation_type":"narrow_constraint","payload":{"constraint":"<constraint phrase>"}}`;
}

async function callLLM(
  prompt: string,
  anthropicApiKey: string
): Promise<LLMResponse> {
  const body = {
    model: ADVERSARIAL_MODEL,
    max_tokens: 256,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";

  // Strip markdown fences if present
  const cleaned = text.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM returned non-JSON: ${cleaned.slice(0, 200)}`);
  }

  const obj = parsed as Record<string, unknown>;
  const mutType = obj["mutation_type"];
  if (mutType !== "swap_output_shape" && mutType !== "narrow_constraint") {
    throw new Error(`Unknown mutation_type: ${String(mutType)}`);
  }

  return {
    mutation_type: mutType as MutationType,
    payload: (obj["payload"] as Record<string, unknown>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// Exported function
// ---------------------------------------------------------------------------

export async function mutateGoal(
  goal: GeneratedGoal,
  opts: {
    anthropicApiKey: string;
  }
): Promise<AdversarialGoal> {
  const prompt = buildPrompt(goal);
  const promptHash = createHash("sha256").update(prompt, "utf8").digest("hex").slice(0, 16);

  const llmResult = await callLLM(prompt, opts.anthropicApiKey);

  // Apply mutation to the goal fields
  let goalText = goal.goal_text;
  let expectedOutputShapes = [...goal.expected_output_shapes];

  if (llmResult.mutation_type === "swap_output_shape") {
    const newShape = String(llmResult.payload["new_shape"] ?? "").trim();
    if (newShape) {
      expectedOutputShapes = [newShape];
    }
  } else {
    // narrow_constraint
    const constraint = String(llmResult.payload["constraint"] ?? "").trim();
    if (constraint) {
      goalText = `${goal.goal_text} (${constraint})`;
    }
  }

  return {
    ...goal,
    adversarial: true,
    goal_text: goalText,
    expected_output_shapes: expectedOutputShapes,
    mutation_type: llmResult.mutation_type,
    mutation_payload: llmResult.payload,
    llm_model: ADVERSARIAL_MODEL,
    prompt_hash: promptHash,
  };
}

// ---------------------------------------------------------------------------
// Exported for testing — lets tests mock callLLM internals via fetch override
// ---------------------------------------------------------------------------

export { buildPrompt };
