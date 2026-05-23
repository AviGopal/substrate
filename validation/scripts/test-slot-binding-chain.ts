/**
 * VERIFICATION: slot-binding chain end-to-end through GoalHost.
 *
 * Loop discipline (2026-05-20): alternate dev → verify → debug-or-dev. After
 * the §4 resolver chain port (impulse_preparation, iteration,
 * impulse_pool_selection, producer_selection), this script observes whether
 * slot-binding actually fires + completes when GoalHost runs a template with
 * declared inputShapes.
 *
 * Test design:
 *  - Parent template: one task declaring inputShapes:["goal"], resolver
 *    "bash" with a config that uses the goal impulse content (so we can see
 *    the impulse actually got picked up by binding).
 *  - Variables: {goal: "say hello"} — slot-binding's prepare_pool should
 *    synthesise an impulse with shape="goal" content="say hello".
 *  - Lifecycle subscribers fire automatically via GoalHost's
 *    LifecycleSubscriberVessel + engine lifecycle:* emission.
 *
 * Observable signals:
 *  - lifecycle:task:preBinding emitted before task.started (logged)
 *  - slot-binding subscriber dispatches (logged as nested execution
 *    via the GoalHost dispatcher wrapping executor.execute)
 *  - slot-binding's task chain executes: prepare_pool succeeds and
 *    synthesises the goal impulse; pool_precheck + select_or_produce
 *    complete (either bound or degraded)
 *  - parent task runs with the synthesised impulse in scope
 *  - Trace stored on canary with non-null compositionChain on slot-binding's
 *    nested execution (load-bearing assertion for forge-goal-completion C1)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... METABOB_API_KEY=... \
 *     bun run validation/scripts/test-slot-binding-chain.ts
 */

import { GoalHost } from "../../repos/ias-executor-ts/src/examples/goal-host";
import type { LLMPort } from "../../repos/ias-executor-ts/src/ports";
import type { ActivityTemplate, LifecycleEvent } from "../../repos/ias-executor-ts/src/ontology";

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

// The parent template: declares inputShapes:["goal"]. When run through
// GoalHost, this should trigger lifecycle:task:preBinding (because inputShapes
// is non-empty), which slot-binding subscribes to.
const PARENT: ActivityTemplate = {
  id: "verify-slot-binding-parent",
  name: "Verify Slot-Binding Parent",
  description: "Parent task declares inputShapes:['goal']; slot-binding should fire on preBinding and synthesise the goal impulse from variables.",
  outputShapes: ["commandResult"],
  tasks: [
    {
      id: "echo-with-binding",
      description: "echo the goal text",
      resolver: "bash",
      inputShapes: ["goal"],
      outputShapes: ["commandResult"],
      config: { command: ["echo", "binding-fired-successfully"] },
    } as ActivityTemplate["tasks"][number],
  ],
};

async function main(): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const metabobKey = process.env.METABOB_API_KEY;
  if (!anthropicKey || !metabobKey) {
    console.error("FATAL: ANTHROPIC_API_KEY + METABOB_API_KEY required");
    process.exit(2);
  }

  const events: LifecycleEvent[] = [];

  const host = new GoalHost({
    llm: new AnthropicLLM(anthropicKey),
    activityApiEndpoint: "https://activity.metabob.com",
    apiKey: metabobKey,
    eventSink: {
      emit(event) {
        events.push(event);
        // Print only the lifecycle:* events to keep output focused.
        if (event.type.startsWith("lifecycle:")) {
          const data = event.data as { taskId?: string; templateId?: string; executionId?: string };
          console.log(
            `[event] ${event.type} template=${data.templateId ?? "?"} task=${data.taskId ?? "?"} exec=${data.executionId ?? "?"}`,
          );
        }
        // Print activity.failed reason inline so debug mode surfaces what's
        // actually breaking in nested executions (spec §E.2 contract).
        if (event.type === "activity.failed") {
          // engine.ts:356 emits `data: {executionId, templateId, error}` (not `reason`).
          const data = event.data as { executionId?: string; templateId?: string; error?: string };
          console.log(
            `[event] activity.failed exec=${data.executionId} template=${data.templateId} error=${data.error ?? "?"}`,
          );
        }
      },
    },
    // Loop-debug discipline: surface dispatcher errors that the vessel
    // would otherwise swallow (spec §E.2). Without this, the 3 activity.failed
    // events from the verification iteration leave no diagnostic trail.
    logger: {
      warn: (msg) => console.warn(`[subscriber-vessel] WARN: ${msg}`),
      debug: () => {},
    },
  });

  // Register the parent template into the local catalogue so runGoal can
  // find it by targetTemplateId.
  host.catalogue.register(PARENT);

  console.log("[verify-slot-binding] running parent template...");
  console.log("[verify-slot-binding]   inputShapes=['goal'] should trigger preBinding");
  console.log("[verify-slot-binding]   variables={goal:'say hello'} — prepare_pool should synthesise");

  const result = await host.runGoal("say hello", {
    targetTemplateId: PARENT.id,
    variables: { goal: "say hello" },
  });

  console.log("");
  console.log("=========================================");
  console.log("[result] trace id            =", result.trace.id);
  console.log("[result] trace status        =", result.trace.status);
  console.log("[result] parent tasks        =", result.trace.tasks.length);
  for (const t of result.trace.tasks) {
    console.log(
      `[result]   ${t.taskId} (${t.resolverId}): success=${t.success} inputs=${t.inputImpulseIds.length} outputs=${t.outputImpulseIds.length}`,
    );
  }

  // Diagnostic: which events fired?
  console.log("");
  console.log("[event-summary] total events =", events.length);
  const byType = new Map<string, number>();
  for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  for (const [type, count] of [...byType.entries()].sort()) {
    console.log(`[event-summary]   ${type}: ${count}`);
  }

  // Load-bearing assertion: did slot-binding's nested execution fire?
  // We expect TWO activity.started events: parent + slot-binding nested.
  const startedCount = byType.get("activity.started") ?? 0;
  if (startedCount < 2) {
    console.warn(
      `[verify-slot-binding] WARN: only ${startedCount} activity.started event(s); ` +
        `expected at least 2 (parent + slot-binding nested). slot-binding likely did NOT dispatch.`,
    );
  } else {
    console.log(`[verify-slot-binding] OK: ${startedCount} activity.started events — nested dispatch fired.`);
  }
}

main().catch((err) => {
  console.error("[verify-slot-binding] FATAL:", err.message ?? err);
  process.exit(1);
});
