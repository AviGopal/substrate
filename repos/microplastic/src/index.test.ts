/**
 * Test user_goal impulse flow
 */

import { describe, test, expect } from "bun:test";
import { ImpulseStore } from "./impulse/index.ts";

describe("User Goal Impulse Flow", () => {
  test("user_goal impulse is created and can be subscribed to", () => {
    const impulseStore = new ImpulseStore();
    const received: any[] = [];

    // Subscribe to user_goal impulses
    impulseStore.subscribe(
      (event) => {
        if (event.type === "create") {
          received.push(event.impulse);
        }
      },
      { shape: "user_goal" }
    );

    // Create a user_goal impulse (simulating user input)
    const impulse = impulseStore.create({
      pointer: { type: "user_input", value: "test goal" },
      budget: 2000,
      priority: "high",
      shape: "user_goal",
      content: JSON.stringify({
        goal: "test goal",
        timestamp: Date.now(),
      }),
      metadata: {
        source: "interactive",
      },
    });

    // Verify impulse was created
    expect(impulse.shape).toBe("user_goal");
    expect(impulse.priority).toBe("high");

    // Verify subscription received the impulse
    expect(received).toHaveLength(1);
    expect(received[0].id).toBe(impulse.id);
    expect(received[0].shape).toBe("user_goal");

    // Verify content can be parsed
    const parsed = JSON.parse(received[0].content);
    expect(parsed.goal).toBe("test goal");
    expect(parsed.timestamp).toBeGreaterThan(0);
  });

  test("non-user_goal impulses are filtered out", () => {
    const impulseStore = new ImpulseStore();
    const received: any[] = [];

    // Subscribe only to user_goal impulses
    impulseStore.subscribe(
      (event) => {
        if (event.type === "create") {
          received.push(event.impulse);
        }
      },
      { shape: "user_goal" }
    );

    // Create various impulses
    impulseStore.create({
      pointer: { type: "execution_event", event: "start" },
      budget: 1000,
      priority: "medium",
      shape: "activity",
      content: "{}",
    });

    impulseStore.create({
      pointer: { type: "user_input", value: "real goal" },
      budget: 2000,
      priority: "high",
      shape: "user_goal",
      content: JSON.stringify({ goal: "real goal" }),
    });

    impulseStore.create({
      pointer: { type: "execution_event", event: "complete" },
      budget: 1000,
      priority: "medium",
      shape: "summary",
      content: "{}",
    });

    // Only the user_goal impulse should be received
    expect(received).toHaveLength(1);
    expect(received[0].shape).toBe("user_goal");
    const parsed = JSON.parse(received[0].content);
    expect(parsed.goal).toBe("real goal");
  });

  test("multiple user_goal impulses are processed in order", () => {
    const impulseStore = new ImpulseStore();
    const received: string[] = [];

    // Subscribe to user_goal impulses
    impulseStore.subscribe(
      (event) => {
        if (event.type === "create" && event.impulse.content) {
          const parsed = JSON.parse(event.impulse.content);
          received.push(parsed.goal);
        }
      },
      { shape: "user_goal" }
    );

    // Create multiple user_goal impulses
    const goals = ["first goal", "second goal", "third goal"];
    for (const goal of goals) {
      impulseStore.create({
        pointer: { type: "user_input", value: goal },
        budget: 2000,
        priority: "high",
        shape: "user_goal",
        content: JSON.stringify({ goal, timestamp: Date.now() }),
        metadata: { source: "interactive" },
      });
    }

    // Verify all goals were received in order
    expect(received).toEqual(goals);
  });
});
