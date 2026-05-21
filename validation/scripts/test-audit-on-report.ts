/**
 * VERIFY: audit-test-report subscriber fires on test_report emission.
 *
 * audit-test-report.json subscribes lifecycle:execution:succeeded with
 * filter output_shapes_contains:"test_report". Now that task 40 is
 * resolved (subscriber-dispatch seeding works), this script demonstrates
 * the full subscriber chain end-to-end:
 *
 *   1. Parent template emits an impulse with shape="test_report"
 *   2. Engine fires lifecycle:execution:succeeded with outputShapes
 *      including "test_report"
 *   3. audit-test-report subscriber matches, dispatcher runs it nested
 *   4. audit-test-report's task chain executes (or fails gracefully on
 *      missing resolvers — the load-bearing demonstration is that it
 *      FIRES, not that it completes; its tasks use impulse-resolve and
 *      LLM resolvers we haven't ported)
 *
 * Loop discipline: VERIFY iteration confirming task 40 fix unlocks the
 * audit-test-report subscriber chain.
 */

import { GoalHost } from "../../repos/ias-executor-ts/src/examples/goal-host";
import type { LLMPort } from "../../repos/ias-executor-ts/src/ports";
import type { ActivityTemplate, LifecycleEvent } from "../../repos/ias-executor-ts/src/ontology";

class StubLLM implements LLMPort {
  async generate(): Promise<string> { return "stub"; }
}

// Parent template that emits a test_report-shape impulse. Slot-binding
// subscribes preBinding (will fire); validator-dispatch subscribes
// task.completed (will fire); audit-test-report subscribes
// lifecycle:execution:succeeded with output_shapes_contains:"test_report"
// → SHOULD FIRE because we emit test_report.
const EMITS_TEST_REPORT: ActivityTemplate = {
  id: "emits-test-report",
  name: "Emits Test Report",
  description: "Single task: synthesise a test_report-shape impulse.",
  outputShapes: ["test_report"],
  tasks: [
    {
      id: "emit-report",
      description: "use impulse_preparation to wrap a variable as test_report",
      resolver: "impulse_preparation",
      config: {
        operation: "synthesise_from_variables",
        missingShapes: ["test_report"],
      },
      outputShapes: ["test_report"],
    } as ActivityTemplate["tasks"][number],
  ],
};

async function main(): Promise<void> {
  const apiKey = process.env.METABOB_API_KEY ?? "stub-key";
  const events: LifecycleEvent[] = [];

  const host = new GoalHost({
    llm: new StubLLM(),
    activityApiEndpoint: "https://activity.metabob.com",
    apiKey,
    eventSink: {
      emit(event) {
        events.push(event);
        if (event.type.startsWith("lifecycle:") || event.type === "activity.started" || event.type === "activity.failed") {
          const data = event.data as { templateId?: string; taskId?: string; outputShapes?: string[]; parentDepth?: number; error?: string };
          const tail = data.outputShapes ? ` outputShapes=${JSON.stringify(data.outputShapes)}` : "";
          const errTail = data.error ? ` error=${data.error.slice(0, 60)}` : "";
          console.log(`[event] ${event.type} tpl=${data.templateId ?? "?"} task=${data.taskId ?? "?"} depth=${data.parentDepth ?? "?"}${tail}${errTail}`);
        }
      },
    },
    logger: {
      warn: (m) => console.warn(`[vessel] WARN: ${m.slice(0, 120)}`),
      debug: () => {},
    },
  });

  host.catalogue.register(EMITS_TEST_REPORT);

  console.log("[verify-audit] running emits-test-report template...");
  const result = await host.runGoal("emit test report", {
    targetTemplateId: EMITS_TEST_REPORT.id,
    variables: { test_report: '{"summary":"hello from audit-on-report verifier"}' },
  });

  console.log("");
  console.log("==========================");
  console.log(`[result] trace id     = ${result.trace.id}`);
  console.log(`[result] trace status = ${result.trace.status}`);
  console.log(`[result] task outputs = ${result.trace.tasks.map((t) => `${t.taskId}:${t.outputImpulseIds.length}`).join(", ")}`);

  // Event summary — focus on what dispatched
  const byType = new Map<string, number>();
  for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  console.log("");
  console.log("[event-summary]");
  for (const [type, count] of [...byType.entries()].sort()) {
    console.log(`  ${type}: ${count}`);
  }

  // Load-bearing assertion: audit-test-report should have dispatched.
  // We can tell from the activity.started events emitted with templateId="audit-test-report".
  const auditStarted = events.filter(
    (e) => e.type === "activity.started" && (e.data as { templateId?: string }).templateId === "audit-test-report",
  );
  console.log("");
  if (auditStarted.length > 0) {
    console.log(`[verify-audit] OK: audit-test-report dispatched ${auditStarted.length} time(s) — substrate works.`);
  } else {
    console.warn(`[verify-audit] WARN: audit-test-report did NOT dispatch despite outputShapes containing test_report.`);
  }
}

main().catch((err) => {
  console.error("[verify-audit] FATAL:", err.message ?? err);
  process.exit(1);
});
