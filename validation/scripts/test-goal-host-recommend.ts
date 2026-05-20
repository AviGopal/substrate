/**
 * End-to-end live test: GoalHost.runGoal with real recommend (no bypass).
 *
 * Demonstrates the template-format bridge (commits 80bfa60 + 196001d):
 *   1. GoalHost queries activity-api /v2/activities/recommend with goalText
 *   2. Top template (likely resolver:null + prompt.template) is fetched
 *   3. normalizeMinibobTemplate() rewrites resolver:null → "llm-prompt"
 *   4. llm-prompt resolver interpolates {{var}}, calls LLM, emits llmText
 *   5. Trace stored on canary
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... METABOB_API_KEY=... \
 *     bun run validation/scripts/test-goal-host-recommend.ts [goal-text]
 */

import { GoalHost } from "../../repos/ias-executor-ts/src/examples/goal-host";
import type { LLMPort } from "../../repos/ias-executor-ts/src/ports";

class AnthropicLLM implements LLMPort {
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  constructor(private readonly apiKey: string) {}
  async generate(input: { prompt: string; systemPrompt?: string }): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 512,
      messages: [{ role: "user", content: input.prompt }],
    };
    if (input.systemPrompt) body.system = input.systemPrompt;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }
}

async function main(): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const metabobKey = process.env.METABOB_API_KEY;
  if (!anthropicKey || !metabobKey) {
    throw new Error("ANTHROPIC_API_KEY and METABOB_API_KEY required");
  }

  const goalText = process.argv[2] ?? "write a one-sentence greeting";

  const host = new GoalHost({
    llm: new AnthropicLLM(anthropicKey),
    activityApiEndpoint: "https://activity.metabob.com",
    apiKey: metabobKey,
  });

  console.log(`[live-recommend] goal              = ${goalText}`);
  console.log("[live-recommend] runGoal with no targetTemplateId (real recommend)...");
  const result = await host.runGoal(goalText, { variables: { goal: goalText } });

  console.log(`[live-recommend] trace id          = ${result.trace.id}`);
  console.log(`[live-recommend] selected template = ${result.selectedTemplateId}`);
  console.log(`[live-recommend] trace status      = ${result.trace.status}`);
  console.log(`[live-recommend] tasks             = ${result.trace.tasks.length}`);
  for (const t of result.trace.tasks) {
    console.log(
      `[live-recommend]   ${t.taskId} (${t.resolverId}): success=${t.success} outputs=${t.outputImpulseIds.length}`,
    );
  }
  if (result.recommendCandidates) {
    console.log(`[live-recommend] candidates       = ${result.recommendCandidates.length}`);
  }
}

main().catch((err) => {
  console.error("[live-recommend] FATAL:", err.message ?? err);
  process.exit(1);
});
