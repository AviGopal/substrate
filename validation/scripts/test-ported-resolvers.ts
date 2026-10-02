/**
 * DEV verification: ported resolvers exercised directly via GoalHost.
 *
 * Tests the §4 resolver chain (impulse_preparation, iteration,
 * impulse_pool_selection, producer_selection) by running a template that
 * uses them inline — no subscriber chain involved. Cleanly isolates the
 * canonical-host substrate's resolver wiring from the subscriber-seeding
 * issue (task 40).
 *
 * Three tests in one run:
 *  1. impulse_preparation: synthesise a goal impulse from variables
 *  2. iteration: iterate over a shape list, dispatch impulse_pool_selection
 *  3. producer_selection: gracefully degrade (no real activity-api here)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... METABOB_API_KEY=... \
 *     bun run validation/scripts/test-ported-resolvers.ts
 */

import { GoalHost } from "../../repos/ias-executor-ts/src/examples/goal-host";
import type { LLMPort } from "../../repos/ias-executor-ts/src/ports";
import type { ActivityTemplate } from "../../repos/ias-executor-ts/src/ontology";

class StubLLM implements LLMPort {
  async generate(): Promise<string> { return "stub"; }
}

const TEMPLATE: ActivityTemplate = {
  id: "test-ported-resolvers",
  name: "Test Ported Resolvers",
  description: "Three-task template exercising impulse_preparation, iteration, producer_selection inline.",
  outputShapes: ["prep_result", "iter_result", "prod_result"],
  tasks: [
    {
      id: "synthesise",
      description: "Use impulse_preparation to wrap variables as impulses",
      resolver: "impulse_preparation",
      config: {
        operation: "synthesise_from_variables",
        missingShapes: ["goal", "context"],
      },
      outputShapes: ["goal", "context"],
    } as ActivityTemplate["tasks"][number],
    {
      id: "iterate",
      description: "Iterate over shape list, dispatching impulse_pool_selection per shape",
      resolver: "iteration",
      config: {
        over: ["alpha", "beta"],
        elementVar: "shape",
        body: {
          resolver: "impulse_pool_selection",
          config: {
            shape: "{{shape}}",
            poolCandidates: [
              { id: "a1", shape: "alpha" },
              { id: "b1", shape: "beta" },
              { id: "b2", shape: "beta" },
            ],
          },
        },
        outputShape: "iter_result",
      },
      outputShapes: ["iter_result"],
    } as ActivityTemplate["tasks"][number],
    {
      id: "produce",
      description: "Producer selection with no activity-api configured (graceful degradation)",
      resolver: "producer_selection",
      config: { shape: "nonexistent_shape" },
      outputShapes: ["prod_result"],
    } as ActivityTemplate["tasks"][number],
  ],
};

async function main(): Promise<void> {
  const apiKey = process.env.METABOB_API_KEY ?? "stub-key";

  // Use StubLLM — the template doesn't invoke LLM resolvers, but GoalHost
  // requires an LLMPort to construct.
  const host = new GoalHost({
    llm: new StubLLM(),
    activityApiEndpoint: "https://activity.metabob.com",
    apiKey,
    // No subscribers — keep the test focused on direct resolver dispatch.
    subscriberTemplates: [],
  });
  host.catalogue.register(TEMPLATE);

  console.log("[test-ported] running template through GoalHost...");
  const trace = await host.runTemplate(TEMPLATE, {
    goal: "hello world",
    context: "test context",
  });

  console.log("");
  console.log("==========================");
  console.log(`[trace] id          = ${trace.id}`);
  console.log(`[trace] status      = ${trace.status}`);
  console.log(`[trace] tasks       = ${trace.tasks.length}`);
  for (const t of trace.tasks) {
    const inputsStr = `inputs=${t.inputImpulseIds.length}`;
    const outputsStr = `outputs=${t.outputImpulseIds.length}`;
    console.log(`[trace]   ${t.taskId} (${t.resolverId}): success=${t.success} ${inputsStr} ${outputsStr}`);
  }

  // Inspect impulses produced by each task
  console.log("");
  console.log("[impulses] all impulses in runtime store:");
  for (const imp of host.runtime.store.all()) {
    const summary = typeof imp.metadata.summary === "string" ? imp.metadata.summary : "?";
    console.log(`  - ${imp.id} shape=${imp.metadata.shape ?? "?"} summary="${summary}"`);
  }

  if (trace.status !== "completed") {
    console.error("[test-ported] FAIL: trace not completed");
    process.exit(1);
  }
  if (trace.tasks.length !== 3) {
    console.error(`[test-ported] FAIL: expected 3 tasks, got ${trace.tasks.length}`);
    process.exit(1);
  }
  if (!trace.tasks.every((t) => t.success)) {
    console.error("[test-ported] FAIL: at least one task failed");
    process.exit(1);
  }
  console.log("");
  console.log("[test-ported] OK — all 3 ported resolvers ran end-to-end through GoalHost.");
}

main().catch((err) => {
  console.error("[test-ported] FATAL:", err.message ?? err);
  process.exit(1);
});
