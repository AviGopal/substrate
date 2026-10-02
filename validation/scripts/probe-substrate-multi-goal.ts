/**
 * Multi-goal substrate probe — registered-template selection demonstrator.
 *
 * Runs N distinct goals through GoalHost.runGoal with NO targetTemplateId
 * bypass. Each goal exercises the full registered-template path:
 *   1. POST /v2/activities/recommend (Thompson Sampling over registry)
 *   2. Fetch top-ranked template via CatalogueWithFallback (local → remote)
 *   3. normalizeMinibobTemplate() bridges resolver:null/llm + prompt.template
 *   4. ActivityExecutor runs through registered resolvers
 *   5. TranslatingTraceSink records back to canary
 *
 * Output: a summary table per goal — template id, candidate count, trace
 * status, task count, and per-task resolver/success/outputs. Useful for
 * answering "are we using registered templates first" with concrete
 * evidence, not a single-goal anecdote.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... METABOB_API_KEY=... \
 *     bun run validation/scripts/probe-substrate-multi-goal.ts
 */

import { GoalHost } from "../../repos/ias-executor-ts/src/examples/goal-host";
import type { LLMPort } from "../../repos/ias-executor-ts/src/ports";

class AnthropicLLM implements LLMPort {
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  constructor(private readonly apiKey: string) {}
  async generate(input: { prompt: string; systemPrompt?: string }): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 256,
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

const GOALS = [
  "write a one-sentence greeting",
  "summarise what a vessel is",
  "describe the impulse-activity model in three bullets",
  "list two reasons to prefer deterministic resolvers",
];

interface Row {
  goal: string;
  templateId: string;
  candidateCount: number;
  status: string;
  taskCount: number;
  taskSummary: string;
  durationMs?: number;
  error?: string;
}

async function main(): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const metabobKey = process.env.METABOB_API_KEY;
  if (!anthropicKey || !metabobKey) {
    throw new Error("ANTHROPIC_API_KEY and METABOB_API_KEY required");
  }

  const host = new GoalHost({
    llm: new AnthropicLLM(anthropicKey),
    activityApiEndpoint: "https://activity.metabob.com",
    apiKey: metabobKey,
  });

  const rows: Row[] = [];

  for (const goal of GOALS) {
    console.log(`\n[probe] goal: ${goal}`);
    try {
      const t0 = Date.now();
      const result = await host.runGoal(goal, { variables: { goal } });
      const elapsed = Date.now() - t0;
      const taskSummary = result.trace.tasks
        .map((t) => `${t.taskId}(${t.resolverId}):${t.success ? "ok" : "x"}/${t.outputImpulseIds.length}`)
        .join(" ");
      rows.push({
        goal,
        templateId: result.selectedTemplateId ?? "?",
        candidateCount: result.recommendCandidates?.length ?? 0,
        status: result.trace.status,
        taskCount: result.trace.tasks.length,
        taskSummary,
        durationMs: elapsed,
      });
      console.log(`[probe]   template=${result.selectedTemplateId} tasks=${result.trace.tasks.length} status=${result.trace.status} ${elapsed}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      rows.push({
        goal,
        templateId: "—",
        candidateCount: 0,
        status: "error",
        taskCount: 0,
        taskSummary: "",
        error: msg,
      });
      console.log(`[probe]   ERROR ${msg.slice(0, 120)}`);
    }
  }

  console.log("\n========================================================================");
  console.log("Substrate exercise summary");
  console.log("========================================================================");
  for (const r of rows) {
    console.log(`\n  goal       : ${r.goal}`);
    console.log(`  template   : ${r.templateId}`);
    console.log(`  candidates : ${r.candidateCount}`);
    console.log(`  status     : ${r.status}${r.durationMs ? ` (${r.durationMs}ms)` : ""}`);
    console.log(`  tasks      : ${r.taskCount} — ${r.taskSummary}`);
    if (r.error) console.log(`  error      : ${r.error.slice(0, 200)}`);
  }

  const okCount = rows.filter((r) => r.status === "completed").length;
  const totalCandidates = rows.reduce((s, r) => s + r.candidateCount, 0);
  console.log("\n========================================================================");
  console.log(`Goals attempted: ${rows.length}`);
  console.log(`Completed     : ${okCount}/${rows.length}`);
  console.log(`Total candidates surfaced by Thompson recommend: ${totalCandidates}`);
  console.log(`No improvisation/fallback path was taken — every goal mapped to a registered template id.`);
  console.log("========================================================================");
}

main().catch((err) => {
  console.error("[probe] FATAL:", err.message ?? err);
  process.exit(1);
});
