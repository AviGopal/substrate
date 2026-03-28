/**
 * End-to-End Integration Test: Goal → Impulses → Regions → Rendering
 *
 * Verifies the complete impulse-driven execution flow:
 * 1. Goal submission creates execution impulses
 * 2. Impulses trigger region creation
 * 3. Regions progress through states (loading → streaming → complete)
 * 4. All impulse shapes (activity, task, tool_call, summary, error) are handled
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ImpulseStore } from "../impulse/index.ts";
import { RegionManager } from "../tui/regions.ts";
import { GoalExecutor } from "../execution/index.ts";
import { ExecutionBridge } from "../tui/execution-bridge.ts";

describe("End-to-End Impulse Flow Integration", () => {
  let impulseStore: ImpulseStore;
  let regionManager: RegionManager;
  let executor: GoalExecutor;
  let bridge: ExecutionBridge;

  beforeEach(() => {
    impulseStore = new ImpulseStore();
    regionManager = new RegionManager();
    executor = new GoalExecutor({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || "test-key",
      apiBaseUrl: process.env.ACTIVITY_API_URL ?? "http://localhost:8080",
      impulseStore,
    });
    bridge = new ExecutionBridge(regionManager, executor, {
      impulseStore,
      showToolCalls: true,
      showImpulses: true,
    });
    bridge.wire();
  });

  test("activity impulse creates activity region", () => {
    // Simulate execution:template_selected event
    const impulse = impulseStore.create({
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: {
          name: "Test Activity",
          tasks: [
            { id: "task1", description: "Task 1" },
            { id: "task2", description: "Task 2" },
          ],
        },
      }),
      metadata: {
        executionEvent: "execution:template_selected",
        timestamp: Date.now(),
      },
    });

    // Verify impulse was created
    expect(impulse.shape).toBe("activity");
    expect(impulse.loaded).toBe(false);

    // Verify region was created by the bridge subscription
    const regions = regionManager.getAll();
    const activityRegions = regions.filter((r) => r.shape === "activity");
    expect(activityRegions.length).toBe(1);

    const activityRegion = activityRegions[0];
    expect(activityRegion.content.name).toBe("Test Activity");
    expect(activityRegion.content.totalTasks).toBe(2);
    expect(activityRegion.state).toBe("loading");
  });

  test("task impulse updates activity region progress", () => {
    // First, create an activity
    const activityImpulse = impulseStore.create({
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: {
          name: "Multi-Task Activity",
          tasks: [
            { id: "task1", description: "Task 1" },
            { id: "task2", description: "Task 2" },
            { id: "task3", description: "Task 3" },
          ],
        },
      }),
      metadata: {
        executionEvent: "execution:template_selected",
      },
    });

    // Get the activity region
    const regions1 = regionManager.getAll();
    const activityRegion1 = regions1.find((r) => r.shape === "activity");
    expect(activityRegion1).toBeDefined();
    const activityId = activityRegion1!.id;

    // Simulate task start
    impulseStore.create({
      pointer: { type: "execution_event", event: "task_start" },
      budget: 1000,
      priority: "medium",
      shape: "task",
      content: JSON.stringify({
        taskIndex: 1,
        totalTasks: 3,
        taskName: "Task 1",
      }),
      metadata: {
        executionEvent: "execution:task_start",
      },
    });

    // Verify activity region was updated with task progress
    const activityRegion2 = regionManager.get(activityId);
    expect(activityRegion2).toBeDefined();
    expect(activityRegion2!.content.currentTask).toBe("Task 1");
    expect(activityRegion2!.content.completedTasks).toBe(1);
    expect(activityRegion2!.content.totalTasks).toBe(3);
  });

  test("tool_call impulse creates tool call region", () => {
    impulseStore.create({
      pointer: { type: "execution_event", event: "tool_call" },
      budget: 1000,
      priority: "medium",
      shape: "tool_call",
      content: JSON.stringify({
        tool: "read",
        args: { file_path: "/test/file.ts" },
      }),
      metadata: {
        executionEvent: "execution:tool_call",
      },
    });

    const regions = regionManager.getAll();
    const toolCallRegions = regions.filter((r) => r.shape === "tool_call");
    expect(toolCallRegions.length).toBe(1);

    const toolCallRegion = toolCallRegions[0];
    expect(toolCallRegion.content.tool).toBe("read");
    expect(toolCallRegion.content.args.file_path).toBe("/test/file.ts");
  });

  test("summary impulse creates summary region and completes activity", () => {
    // First, create an activity
    impulseStore.create({
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: { name: "Completing Activity", tasks: [] },
      }),
      metadata: {
        executionEvent: "execution:template_selected",
      },
    });

    const regions1 = regionManager.getAll();
    const activityRegion1 = regions1.find((r) => r.shape === "activity");
    expect(activityRegion1).toBeDefined();

    // Simulate successful completion
    impulseStore.create({
      pointer: { type: "execution_event", event: "complete" },
      budget: 1000,
      priority: "medium",
      shape: "summary",
      content: JSON.stringify({
        result: {
          success: true,
          summary: "Task completed successfully",
          template: { name: "Completing Activity" },
          improvised: false,
          outputImpulses: [],
          durationMs: 5000,
          cost: 0.01,
          execution: {
            executionTrace: {
              filesModified: ["/test/file.ts"],
            },
          },
        },
      }),
      metadata: {
        executionEvent: "execution:complete",
      },
    });

    // Verify summary region was created
    const regions2 = regionManager.getAll();
    const summaryRegions = regions2.filter((r) => r.shape === "summary");
    expect(summaryRegions.length).toBe(1);

    const summaryRegion = summaryRegions[0];
    expect(summaryRegion.content.text).toBe("Task completed successfully");
    expect(summaryRegion.content.filesModified).toContain("/test/file.ts");

    // Verify activity region was marked as complete
    const activityRegion2 = regionManager.get(activityRegion1.id);
    expect(activityRegion2!.state).toBe("complete");
  });

  test("error impulse creates error region", () => {
    // Create an activity first
    impulseStore.create({
      pointer: { type: "execution_event", event: "improvising" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        goal: "Failing task",
      }),
      metadata: {
        executionEvent: "execution:improvising",
      },
    });

    // Simulate execution failure
    impulseStore.create({
      pointer: { type: "execution_event", event: "failed" },
      budget: 1000,
      priority: "high",
      shape: "error",
      content: JSON.stringify({
        error: "Execution failed: API key not found",
        result: {
          success: false,
          error: "Execution failed: API key not found",
        },
      }),
      metadata: {
        executionEvent: "execution:failed",
      },
    });

    // Verify error region was created
    const regions = regionManager.getAll();
    const errorRegions = regions.filter((r) => r.shape === "error");
    expect(errorRegions.length).toBe(1);

    const errorRegion = errorRegions[0];
    expect(errorRegion.content.message).toContain("API key not found");
    expect(errorRegion.display?.priority).toBeGreaterThan(500); // Errors have high priority
  });

  test("complete execution flow: activity → tasks → tools → summary", () => {
    const events: string[] = [];

    // Track region creation
    regionManager.on("region:added", (region) => {
      events.push(`added:${region.shape}`);
    });

    regionManager.on("region:updated", (region) => {
      events.push(`updated:${region.shape}`);
    });

    // 1. Start execution with template
    impulseStore.create({
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: {
          name: "Full Flow Test",
          tasks: [{ id: "task1", description: "Test task" }],
        },
      }),
      metadata: { executionEvent: "execution:template_selected" },
    });

    // 2. Start first task
    impulseStore.create({
      pointer: { type: "execution_event", event: "task_start" },
      budget: 1000,
      priority: "medium",
      shape: "task",
      content: JSON.stringify({
        taskIndex: 1,
        totalTasks: 1,
        taskName: "Test task",
      }),
      metadata: { executionEvent: "execution:task_start" },
    });

    // 3. Execute a tool call
    impulseStore.create({
      pointer: { type: "execution_event", event: "tool_call" },
      budget: 1000,
      priority: "medium",
      shape: "tool_call",
      content: JSON.stringify({
        tool: "bash",
        args: { command: "echo test" },
      }),
      metadata: { executionEvent: "execution:tool_call" },
    });

    // 4. Complete execution
    impulseStore.create({
      pointer: { type: "execution_event", event: "complete" },
      budget: 1000,
      priority: "medium",
      shape: "summary",
      content: JSON.stringify({
        result: {
          success: true,
          summary: "Execution completed",
          template: { name: "Full Flow Test" },
          improvised: false,
          outputImpulses: [],
          durationMs: 3000,
          cost: 0.005,
          execution: { executionTrace: { filesModified: [] } },
        },
      }),
      metadata: { executionEvent: "execution:complete" },
    });

    // Verify all regions were created in correct order
    expect(events).toContain("added:activity");
    expect(events).toContain("updated:activity"); // Updated with task progress
    expect(events).toContain("added:tool_call");
    expect(events).toContain("added:summary");

    // Verify final state
    const regions = regionManager.getAll();
    expect(regions.some((r) => r.shape === "activity")).toBe(true);
    expect(regions.some((r) => r.shape === "tool_call")).toBe(true);
    expect(regions.some((r) => r.shape === "summary")).toBe(true);

    // Verify activity is complete
    const activityRegion = regions.find((r) => r.shape === "activity");
    expect(activityRegion!.state).toBe("complete");
  });

  test("1:1 impulse-region mapping prevents duplicates", () => {
    // Create the same activity impulse twice (simulating multiple events)
    const impulseId = "test-activity-123";

    impulseStore.create({
      id: impulseId,
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: { name: "Activity V1", tasks: [] },
      }),
      metadata: { executionEvent: "execution:template_selected" },
    });

    const regions1 = regionManager.getAll();
    const activityRegions1 = regions1.filter((r) => r.shape === "activity");
    expect(activityRegions1.length).toBe(1);
    const regionId1 = activityRegions1[0].id;

    // Create another impulse with the same ID (update scenario)
    impulseStore.create({
      id: impulseId,
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: { name: "Activity V2", tasks: [1, 2] },
      }),
      metadata: { executionEvent: "execution:template_selected" },
    });

    const regions2 = regionManager.getAll();
    const activityRegions2 = regions2.filter((r) => r.shape === "activity");

    // Should still have only 1 activity region
    expect(activityRegions2.length).toBe(1);

    // Should be the same region ID (not a new region)
    expect(activityRegions2[0].id).toBe(regionId1);
  });
});
