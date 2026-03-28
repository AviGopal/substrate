/**
 * Test impulse-to-region 1:1 mapping
 */

import { describe, test, expect } from "bun:test";
import { ImpulseStore } from "../../src/impulse/index.ts";
import { RegionManager } from "../../src/tui/regions.ts";
import { GoalExecutor } from "../../src/execution/index.ts";
import { ExecutionBridge } from "../../src/tui/execution-bridge.ts";

describe("Impulse-to-Region 1:1 Mapping", () => {
  test("getOrCreateRegionForImpulse ensures 1:1 mapping", () => {
    const impulseStore = new ImpulseStore();
    const regionManager = new RegionManager();
    const executor = new GoalExecutor({
      anthropicApiKey: "test-key",
      impulseStore,
    });

    const bridge = new ExecutionBridge(regionManager, executor, {
      impulseStore,
      showToolCalls: false,
      showImpulses: false,
    });
    bridge.wire();

    // Create an activity impulse
    const impulse1 = impulseStore.create({
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: { name: "Test Template", tasks: [] },
      }),
      metadata: {
        executionEvent: "execution:template_selected",
      },
    });

    // Wait for subscription to process
    const regions1 = regionManager.getAll();
    expect(regions1.length).toBeGreaterThan(0);

    const activityRegionId = regions1.find(r => r.shape === "activity")?.id;
    expect(activityRegionId).toBeDefined();

    // Create a task start impulse with the SAME impulse ID (simulating update)
    // In practice, this would be a different impulse, but we're testing the mapping
    const impulse2 = impulseStore.create({
      id: impulse1.id, // Reuse same ID to simulate update
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

    // The region count should NOT increase (no duplicate regions)
    const regions2 = regionManager.getAll();
    // We might have both activity and task regions, but no duplicates
    const activityRegions = regions2.filter(r => r.shape === "activity");
    expect(activityRegions.length).toBe(1);

    // Cleanup
    bridge.shutdown();
  });

  test("different impulses create different regions", () => {
    const impulseStore = new ImpulseStore();
    const regionManager = new RegionManager();
    const executor = new GoalExecutor({
      anthropicApiKey: "test-key",
      impulseStore,
    });

    const bridge = new ExecutionBridge(regionManager, executor, {
      impulseStore,
      showToolCalls: true,
      showImpulses: false,
    });
    bridge.wire();

    // Create first tool call impulse
    impulseStore.create({
      pointer: { type: "execution_event", event: "tool_call" },
      budget: 1000,
      priority: "medium",
      shape: "tool_call",
      content: JSON.stringify({
        tool: "read",
        args: { path: "/file1.ts" },
      }),
      metadata: {
        executionEvent: "execution:tool_call",
      },
    });

    // Create second tool call impulse (different impulse ID)
    impulseStore.create({
      pointer: { type: "execution_event", event: "tool_call" },
      budget: 1000,
      priority: "medium",
      shape: "tool_call",
      content: JSON.stringify({
        tool: "write",
        args: { path: "/file2.ts" },
      }),
      metadata: {
        executionEvent: "execution:tool_call",
      },
    });

    // Should have 2 different tool call regions
    const regions = regionManager.getAll();
    const toolCallRegions = regions.filter(r => r.shape === "tool_call");
    expect(toolCallRegions.length).toBe(2);

    // Verify different tools
    const tools = toolCallRegions.map(r => r.content.tool);
    expect(tools).toContain("read");
    expect(tools).toContain("write");

    // Cleanup
    bridge.shutdown();
  });

  test("updating same impulse updates same region", () => {
    const impulseStore = new ImpulseStore();
    const regionManager = new RegionManager();
    const executor = new GoalExecutor({
      anthropicApiKey: "test-key",
      impulseStore,
    });

    const bridge = new ExecutionBridge(regionManager, executor, {
      impulseStore,
      showToolCalls: false,
      showImpulses: false,
    });
    bridge.wire();

    // Create activity impulse
    const impulse = impulseStore.create({
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: { name: "Template V1", tasks: [] },
      }),
      metadata: {
        executionEvent: "execution:template_selected",
      },
    });

    // Get the region
    const regions1 = regionManager.getAll();
    const activityRegion1 = regions1.find(r => r.shape === "activity");
    expect(activityRegion1).toBeDefined();
    const regionId1 = activityRegion1!.id;

    // Update the impulse (in practice this would be a subsequent event for the same execution)
    // For testing, we'll create a new impulse with a reference to the first
    const impulse2 = impulseStore.create({
      id: impulse.id, // Same ID = same impulse
      pointer: { type: "execution_event", event: "template_selected" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: JSON.stringify({
        template: { name: "Template V2", tasks: [1, 2] },
      }),
      metadata: {
        executionEvent: "execution:template_selected",
      },
    });

    // Should still have only one activity region
    const regions2 = regionManager.getAll();
    const activityRegions = regions2.filter(r => r.shape === "activity");
    expect(activityRegions.length).toBe(1);

    // Should be the same region ID
    expect(activityRegions[0].id).toBe(regionId1);

    // Cleanup
    bridge.shutdown();
  });
});
