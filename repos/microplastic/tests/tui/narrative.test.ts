/**
 * Narrative Generator Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  NarrativeGenerator,
  NarrativeStream,
  type NarrativePattern,
  type NarrativeEvent,
} from "../../src/tui/narrative.ts";

// =============================================================================
// TESTS
// =============================================================================

describe("NarrativeGenerator", () => {
  let generator: NarrativeGenerator;

  beforeEach(() => {
    generator = new NarrativeGenerator();
  });

  describe("generate", () => {
    test("generates narrative for goal_received", () => {
      const narrative = generator.narrate("goal_received", {
        goal: "Fix the bug",
      });

      expect(narrative.primary).toBeTruthy();
      expect(narrative.improvised).toBe(false);
    });

    test("generates narrative for template_selected", () => {
      const narrative = generator.narrate("template_selected", {
        templateName: "debug-null-pointer",
        successRate: 93,
      });

      expect(narrative.primary).toBeTruthy();
      expect(narrative.secondary).toContain("debug-null-pointer");
    });

    test("generates narrative for improvising", () => {
      const narrative = generator.narrate("improvising", {});

      expect(narrative.primary).toBeTruthy();
      expect(narrative.secondary).toContain("No matching template");
    });

    test("generates narrative for task_starting", () => {
      const narrative = generator.narrate("task_starting", {
        taskIndex: 2,
        totalTasks: 5,
        taskName: "Analyzing code",
      });

      expect(narrative.primary).toContain("2");
      expect(narrative.primary).toContain("5");
      expect(narrative.secondary).toContain("Analyzing code");
    });

    test("generates narrative for tool_call read", () => {
      const narrative = generator.narrate("tool_call", {
        tool: "read",
        filePath: "src/auth.ts",
      });

      expect(narrative.primary).toContain("auth.ts");
    });

    test("generates narrative for tool_call edit", () => {
      const narrative = generator.narrate("tool_call", {
        tool: "edit",
        filePath: "src/auth.ts",
      });

      expect(narrative.primary).toContain("auth.ts");
    });

    test("generates narrative for tool_call bash", () => {
      const narrative = generator.narrate("tool_call", {
        tool: "bash",
        command: "npm test",
      });

      expect(narrative.primary).toBeTruthy();
      expect(narrative.secondary).toContain("npm test");
    });

    test("generates narrative for thinking", () => {
      const narrative = generator.narrate("thinking", {
        thought: "I think the bug is in the auth module",
      });

      expect(narrative.primary).toContain("auth module");
    });

    test("generates narrative for success", () => {
      const narrative = generator.narrate("success", {
        summary: "Fixed the null pointer bug",
      });

      expect(narrative.primary).toBeTruthy();
      expect(narrative.secondary).toContain("null pointer");
    });

    test("generates narrative for success with files", () => {
      const narrative = generator.narrate("success", {
        filesModified: 3,
      });

      expect(narrative.secondary).toContain("3 files");
    });

    test("generates narrative for failure", () => {
      const narrative = generator.narrate("failure", {
        error: "Tests are failing",
      });

      expect(narrative.secondary).toContain("Tests are failing");
    });

    test("generates narrative for recovery_offered", () => {
      const narrative = generator.narrate("recovery_offered", {});

      expect(narrative.primary).toBeTruthy();
      expect(narrative.secondary).toBeTruthy();
    });

    test("generates narrative for learning", () => {
      const narrative = generator.narrate("learning", {
        templateName: "fix-auth-bug",
      });

      expect(narrative.secondary).toContain("fix-auth-bug");
    });
  });

  describe("improvisation", () => {
    test("improvises when no pattern matches", () => {
      // Use an event type with data that doesn't match any condition
      const narrative = generator.narrate("tool_call", {
        tool: "unknown_tool",
      });

      expect(narrative.improvised).toBe(true);
    });

    test("extracts message from improvised event", () => {
      const narrative = generator.narrate("understanding", {
        message: "Custom message here",
      });

      // Since understanding has no default pattern, it improvises
      expect(narrative.improvised).toBe(true);
      expect(narrative.secondary).toBe("Custom message here");
    });

    test("extracts error from improvised event", () => {
      const narrative = generator.narrate("verification", {
        error: "Verification failed",
      });

      expect(narrative.improvised).toBe(true);
      expect(narrative.secondary).toBe("Verification failed");
    });
  });

  describe("pattern matching", () => {
    test("matches pattern with hasKeys condition", () => {
      const narrative = generator.narrate("task_starting", {
        taskIndex: 1,
        totalTasks: 3,
        taskName: "Test",
      });

      expect(narrative.improvised).toBe(false);
    });

    test("fails to match when required key missing", () => {
      const narrative = generator.narrate("task_starting", {
        taskIndex: 1,
        // Missing totalTasks and taskName
      });

      expect(narrative.improvised).toBe(true);
    });

    test("matches pattern with value condition", () => {
      const narrative = generator.narrate("tool_call", {
        tool: "read",
        filePath: "test.ts",
      });

      expect(narrative.improvised).toBe(false);
      expect(narrative.patternId).toBe("tool_read_file");
    });
  });

  describe("confidence inference", () => {
    test("infers high confidence from high success rate", () => {
      const narrative = generator.narrate("template_selected", {
        templateName: "test",
        successRate: 95,
      });

      expect(narrative.confidence).toBe("high");
    });

    test("infers medium confidence from medium success rate", () => {
      const narrative = generator.narrate("template_selected", {
        templateName: "test",
        successRate: 65,
      });

      expect(narrative.confidence).toBe("medium");
    });

    test("infers low confidence from low success rate", () => {
      const narrative = generator.narrate("template_selected", {
        templateName: "test",
        successRate: 30,
      });

      expect(narrative.confidence).toBe("low");
    });

    test("uses explicit confidence when provided", () => {
      const narrative = generator.narrate("template_selected", {
        templateName: "test",
        successRate: 95,
        confidence: "low", // Override
      });

      expect(narrative.confidence).toBe("low");
    });
  });

  describe("custom patterns", () => {
    test("addPattern adds custom pattern", () => {
      const customPattern: NarrativePattern = {
        id: "custom_test",
        eventType: "thinking",
        conditions: { matches: { custom: true } },
        templates: {
          primary: "Custom thinking narrative",
        },
        usageCount: 0,
        successRate: 1,
      };

      generator.addPattern(customPattern);

      const narrative = generator.narrate("thinking", { custom: true });

      expect(narrative.primary).toBe("Custom thinking narrative");
      expect(narrative.patternId).toBe("custom_test");
    });

    test("custom patterns take precedence", () => {
      // Add pattern that matches same conditions as default
      const customPattern: NarrativePattern = {
        id: "custom_goal",
        eventType: "goal_received",
        templates: {
          primary: "Custom goal narrative",
        },
        usageCount: 0,
        successRate: 1,
      };

      generator.addPattern(customPattern);

      const narrative = generator.narrate("goal_received", { goal: "test" });

      expect(narrative.patternId).toBe("custom_goal");
    });
  });

  describe("pattern extraction", () => {
    test("extracts pattern from improvised narrative", () => {
      const event: NarrativeEvent = {
        type: "understanding",
        timestamp: Date.now(),
        data: { phase: "analysis", target: "auth.ts" },
      };

      // Generate improvised narrative
      const narrative = generator.generate(event);
      expect(narrative.improvised).toBe(true);

      // Extract pattern
      const pattern = generator.extractPattern(event, narrative);

      expect(pattern).not.toBeNull();
      expect(pattern!.eventType).toBe("understanding");
    });

    test("does not extract pattern from matched narrative", () => {
      const event: NarrativeEvent = {
        type: "goal_received",
        timestamp: Date.now(),
        data: { goal: "test" },
      };

      const narrative = generator.generate(event);
      expect(narrative.improvised).toBe(false);

      const pattern = generator.extractPattern(event, narrative);

      expect(pattern).toBeNull();
    });
  });

  describe("outcome recording", () => {
    test("recordOutcome updates success rate", () => {
      // Generate a narrative to get a pattern ID
      const narrative = generator.narrate("goal_received", { goal: "test" });
      const patternId = narrative.patternId!;

      // Record some failures
      generator.recordOutcome(patternId, false);
      generator.recordOutcome(patternId, false);

      // Get patterns and check success rate decreased
      const patterns = generator.getPatterns();
      const pattern = patterns.find((p) => p.id === patternId);

      expect(pattern!.successRate).toBeLessThan(1);
    });

    test("recordOutcome with unknown pattern does nothing", () => {
      // Should not throw
      generator.recordOutcome("nonexistent_pattern", true);
    });
  });

  describe("statistics", () => {
    test("getStats tracks pattern matches vs improvisations", () => {
      // Generate some narratives
      generator.narrate("goal_received", { goal: "test" }); // Pattern match
      generator.narrate("tool_call", { tool: "read", filePath: "a.ts" }); // Pattern match
      generator.narrate("understanding", {}); // Improvised

      const stats = generator.getStats();

      expect(stats.patternMatches).toBe(2);
      expect(stats.improvisations).toBe(1);
      expect(stats.ratio).toBeCloseTo(0.667, 2);
    });

    test("getPatterns returns patterns sorted by usage", () => {
      // Use some patterns multiple times
      generator.narrate("goal_received", { goal: "test" });
      generator.narrate("goal_received", { goal: "test" });
      generator.narrate("goal_received", { goal: "test" });
      generator.narrate("tool_call", { tool: "read", filePath: "a.ts" });

      const patterns = generator.getPatterns();

      // Most used should be first
      expect(patterns[0]!.usageCount).toBeGreaterThanOrEqual(patterns[1]!.usageCount);
    });
  });
});

describe("NarrativeStream", () => {
  let stream: NarrativeStream;

  beforeEach(() => {
    stream = new NarrativeStream();
  });

  describe("subscription", () => {
    test("subscribe receives narrative events", () => {
      const received: Array<{ primary: string }> = [];

      stream.subscribe((narrative) => {
        received.push({ primary: narrative.primary });
      });

      stream.emit("goal_received", { goal: "test" });

      expect(received).toHaveLength(1);
      expect(received[0]!.primary).toBeTruthy();
    });

    test("unsubscribe stops receiving events", () => {
      const received: unknown[] = [];

      const unsubscribe = stream.subscribe((narrative) => {
        received.push(narrative);
      });

      stream.emit("goal_received", { goal: "test" });
      expect(received).toHaveLength(1);

      unsubscribe();

      stream.emit("goal_received", { goal: "test2" });
      expect(received).toHaveLength(1); // No new events
    });

    test("multiple subscribers receive events", () => {
      let count1 = 0;
      let count2 = 0;

      stream.subscribe(() => count1++);
      stream.subscribe(() => count2++);

      stream.emit("goal_received", { goal: "test" });

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  describe("emit", () => {
    test("emit returns generated narrative", () => {
      const narrative = stream.emit("goal_received", { goal: "test" });

      expect(narrative.primary).toBeTruthy();
    });

    test("emit includes event in callback", () => {
      let receivedEvent: { type: string } | null = null;

      stream.subscribe((_, event) => {
        receivedEvent = { type: event.type };
      });

      stream.emit("thinking", { thought: "test" });

      expect(receivedEvent!.type).toBe("thinking");
    });
  });

  describe("emitToolCall", () => {
    test("emits narrative for tool call", () => {
      const narrative = stream.emitToolCall({
        id: "call_1",
        name: "read",
        arguments: { file_path: "src/test.ts" },
        result: { success: true, output: "content" },
      });

      expect(narrative.primary).toContain("test.ts");
    });

    test("extracts command from bash tool", () => {
      const narrative = stream.emitToolCall({
        id: "call_1",
        name: "bash",
        arguments: { command: "npm test" },
        result: { success: true, output: "" },
      });

      expect(narrative.secondary).toContain("npm test");
    });

    test("truncates long commands", () => {
      const longCommand = "npm run some-very-long-command-name-that-should-be-truncated-for-display";

      const narrative = stream.emitToolCall({
        id: "call_1",
        name: "bash",
        arguments: { command: longCommand },
        result: { success: true, output: "" },
      });

      expect(narrative.secondary!.length).toBeLessThanOrEqual(50);
    });
  });

  describe("generator access", () => {
    test("getGenerator returns underlying generator", () => {
      const generator = stream.getGenerator();

      expect(generator).toBeInstanceOf(NarrativeGenerator);
    });

    test("custom generator is used", () => {
      const customGenerator = new NarrativeGenerator();
      customGenerator.addPattern({
        id: "custom",
        eventType: "goal_received",
        templates: { primary: "CUSTOM" },
        usageCount: 0,
        successRate: 1,
      });

      const customStream = new NarrativeStream(customGenerator);
      const narrative = customStream.emit("goal_received", { goal: "test" });

      expect(narrative.primary).toBe("CUSTOM");
    });
  });
});
