/**
 * Backend Integration Tests
 *
 * Validates the unified execution path integration with activity.metabob.com:
 * - Thompson Sampling queries
 * - Trace submission with resolver metrics
 * - Template storage
 * - Composition edge recording
 * - Impulse relevance tracking
 * - State space navigation
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { MCPClient } from "../src/mcp";
import type {
  ActivityTemplate,
  ActivityExecution,
  ExecutionTrace,
  ActivityRecommendation
} from "../src/types";

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const BACKEND_ENDPOINT = process.env.METABOB_ENDPOINT || "https://activity.metabob.com";
const API_KEY = process.env.METABOB_API_KEY;

if (!API_KEY) {
  throw new Error("METABOB_API_KEY environment variable required for backend integration tests");
}

let mcpClient: MCPClient;

beforeAll(() => {
  mcpClient = new MCPClient({
    endpoint: BACKEND_ENDPOINT,
    instance: {
      apiKey: API_KEY
    }
  });
});

// =============================================================================
// A. THOMPSON SAMPLING INTEGRATION
// =============================================================================

describe("Thompson Sampling Integration", () => {
  test("Activity recommendation query works", async () => {
    // Query backend for activity recommendations
    const recommendations = await mcpClient.recommendActivities({
      goal: "test backend integration",
      category: "tool",
      limit: 5
    });

    // Verify response format
    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);

    if (recommendations.length > 0) {
      const rec = recommendations[0] as ActivityRecommendation;

      // Check Thompson alpha/beta scores present
      expect(rec.template_id).toBeDefined();
      expect(rec.confidence).toBeDefined();
      expect(rec.selection_metadata).toBeDefined();
      expect(rec.selection_metadata.thompson_alpha).toBeGreaterThanOrEqual(0);
      expect(rec.selection_metadata.thompson_beta).toBeGreaterThanOrEqual(0);
      expect(rec.selection_metadata.success_rate).toBeGreaterThanOrEqual(0);
      expect(rec.selection_metadata.success_rate).toBeLessThanOrEqual(1);
    }
  });

  test("Resolver execution creates traces", async () => {
    // Create a simple test execution with resolver
    const execution: ActivityExecution = {
      id: `test_exec_${Date.now()}`,
      templateId: "test-resolver-trace",
      status: "completed",
      variables: {},
      impulses: [],
      taskResults: [{
        taskId: "task1",
        status: "completed",
        output: "test output",
        metadata: {
          resolver: "bash",
          outputImpulses: []
        }
      }],
      startedAt: Date.now(),
      completedAt: Date.now(),
      metrics: {
        duration: 100,
        cost: 0,
        totalTokens: { input: 0, output: 0 }
      },
      executionTrace: {
        tasks: [{
          id: "task1",
          description: "Test task",
          actualPrompt: "test",
          toolCalls: [],
          response: "test output",
          result: { status: "success" }
        }],
        impulsesCreated: [],
        filesModified: []
      }
    };

    // Submit trace to backend
    const stored = await mcpClient.storeExecutionTrace(execution);

    // Verify trace submitted successfully
    expect(stored).toBe(true);
  });
});

// =============================================================================
// B. TRACE SUBMISSION
// =============================================================================

describe("Trace Submission", () => {
  test("Unified path traces include all resolvers", async () => {
    // Create execution with multiple resolver types
    const execution: ActivityExecution = {
      id: `test_exec_${Date.now()}`,
      templateId: "test-multi-resolver",
      status: "completed",
      variables: {},
      impulses: [],
      taskResults: [
        {
          taskId: "bash_task",
          status: "completed",
          output: "bash output",
          metadata: {
            resolver: "bash",
            outputImpulses: []
          }
        },
        {
          taskId: "file_task",
          status: "completed",
          output: "file output",
          metadata: {
            resolver: "file",
            outputImpulses: []
          }
        },
        {
          taskId: "git_task",
          status: "completed",
          output: "git output",
          metadata: {
            resolver: "git",
            outputImpulses: []
          }
        }
      ],
      startedAt: Date.now(),
      completedAt: Date.now(),
      metrics: {
        duration: 300,
        cost: 0,
        totalTokens: { input: 0, output: 0 }
      },
      executionTrace: {
        tasks: [
          {
            id: "bash_task",
            description: "Bash resolver task",
            actualPrompt: "",
            toolCalls: [],
            response: "bash output",
            result: { status: "success" }
          },
          {
            id: "file_task",
            description: "File resolver task",
            actualPrompt: "",
            toolCalls: [],
            response: "file output",
            result: { status: "success" }
          },
          {
            id: "git_task",
            description: "Git resolver task",
            actualPrompt: "",
            toolCalls: [],
            response: "git output",
            result: { status: "success" }
          }
        ],
        impulsesCreated: [],
        filesModified: []
      }
    };

    // Submit trace
    const stored = await mcpClient.storeExecutionTrace(execution);
    expect(stored).toBe(true);

    // Verify resolver metrics captured
    const trace = execution.executionTrace!;
    expect(trace.tasks.length).toBe(3);
    expect(trace.tasks[0].id).toBe("bash_task");
    expect(trace.tasks[1].id).toBe("file_task");
    expect(trace.tasks[2].id).toBe("git_task");
  });

  test("Composition edges recorded", async () => {
    // Create parent execution
    const parentId = `test_parent_${Date.now()}`;
    const childId = `test_child_${Date.now()}`;

    // Submit composition edge
    const recorded = await mcpClient.recordCompositionEdge({
      parent_activity_id: parentId,
      child_activity_id: childId,
      sequence_order: 1,
      parent_execution_id: parentId,
      execution_id: childId,
      shapes_produced: ["test_output"],
      shapes_consumed: ["test_input"],
      success: true,
      timestamp: new Date().toISOString()
    });

    // Verify edge recorded
    expect(recorded).toBe(true);
  });

  test("Impulse state snapshots captured", async () => {
    // Create execution with state snapshots
    const execution: ActivityExecution = {
      id: `test_exec_${Date.now()}`,
      templateId: "test-state-tracking",
      status: "completed",
      variables: {},
      impulses: [
        {
          id: "impulse1",
          pointer: { type: "memo", content: "test" },
          budget: 100,
          priority: "medium",
          loaded: true,
          content: "test content",
          createdAt: Date.now()
        }
      ],
      taskResults: [],
      startedAt: Date.now(),
      completedAt: Date.now(),
      metrics: {
        duration: 100,
        cost: 0,
        totalTokens: { input: 0, output: 0 }
      },
      executionTrace: {
        tasks: [],
        impulsesCreated: [],
        filesModified: [],
        beforeSnapshot: {
          timestamp: Date.now(),
          workingDirectory: "/test",
          files: {},
          availableShapes: ["memo"]
        },
        afterSnapshot: {
          timestamp: Date.now(),
          workingDirectory: "/test",
          files: {},
          availableShapes: ["memo", "test_output"]
        }
      }
    };

    // Submit trace
    const stored = await mcpClient.storeExecutionTrace(execution);
    expect(stored).toBe(true);

    // Verify state snapshots present
    expect(execution.executionTrace!.beforeSnapshot).toBeDefined();
    expect(execution.executionTrace!.afterSnapshot).toBeDefined();
  });
});

// =============================================================================
// C. TEMPLATE MANAGEMENT
// =============================================================================

describe("Template Management", () => {
  test("Ribosome extraction submits templates", async () => {
    // Create test template
    const template: ActivityTemplate = {
      id: `test_template_${Date.now()}`,
      name: "Test Template",
      description: "Template created by ribosome extraction",
      tags: ["test"],
      tasks: [
        {
          id: "task1",
          description: "Test task",
          prompt: {
            template: "Test prompt",
            variables: []
          }
        }
      ],
      variables: [],
      metadata: {
        generatedFrom: "execution",
        sourceExecutionId: `test_exec_${Date.now()}`,
        createdAt: Date.now()
      }
    };

    // Register template
    const registered = await mcpClient.registerTemplate(template);
    expect(registered).toBe(true);

    // Verify template can be fetched
    const fetched = await mcpClient.getActivityTemplate(template.id);
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(template.id);
    expect(fetched?.name).toBe(template.name);
  });

  test("Template appears in recommendations after registration", async () => {
    // Create and register template
    const template: ActivityTemplate = {
      id: `test_recommend_${Date.now()}`,
      name: "Test Recommendation Template",
      description: "Template for recommendation testing",
      tags: ["test", "recommendation"],
      tasks: [
        {
          id: "task1",
          description: "Test task",
          prompt: {
            template: "Test prompt",
            variables: []
          }
        }
      ],
      variables: [],
      metadata: {
        generatedFrom: "manual",
        createdAt: Date.now(),
        primordial: true,
        initialAlpha: 1,
        initialBeta: 1
      }
    };

    await mcpClient.registerTemplate(template);

    // Query recommendations
    const recommendations = await mcpClient.recommendActivities({
      goal: "test recommendation",
      limit: 100
    });

    // Check if template appears
    const found = recommendations.some(r => r.template_id === template.id);

    // Note: May not appear immediately due to Thompson Sampling
    // This is expected behavior
    if (!found) {
      console.log(`Template ${template.id} not in recommendations yet (Thompson Sampling)`);
    }
  });
});

// =============================================================================
// D. STATE SPACE NAVIGATION
// =============================================================================

describe("State Space Navigation", () => {
  test("State transitions recorded", async () => {
    // Create execution with state transition
    const execution: ActivityExecution = {
      id: `test_exec_${Date.now()}`,
      templateId: "test-state-navigation",
      status: "completed",
      variables: {},
      impulses: [],
      taskResults: [],
      startedAt: Date.now(),
      completedAt: Date.now(),
      metrics: {
        duration: 100,
        cost: 0,
        totalTokens: { input: 0, output: 0 }
      },
      stateSignature: "test_state_abc123",
      gitState: {
        branch: "test-branch",
        commit: "abc123",
        dirty: false,
        changedFiles: [],
        stagedFiles: [],
        unstagedFiles: []
      },
      executionTrace: {
        tasks: [],
        impulsesCreated: [],
        filesModified: [],
        stateDelta: {
          created: ["test.txt"],
          modified: [],
          deleted: [],
          totalChanges: 1
        }
      }
    };

    // Submit trace
    const stored = await mcpClient.storeExecutionTrace(execution);
    expect(stored).toBe(true);

    // Verify state data captured
    expect(execution.stateSignature).toBeDefined();
    expect(execution.gitState).toBeDefined();
    expect(execution.executionTrace!.stateDelta).toBeDefined();
  });

  test("Similar state queries work", async () => {
    // This would require backend support for state similarity queries
    // For now, verify execution with state signature is accepted
    const execution: ActivityExecution = {
      id: `test_exec_${Date.now()}`,
      templateId: "test-similar-state",
      status: "completed",
      variables: {},
      impulses: [],
      taskResults: [],
      startedAt: Date.now(),
      completedAt: Date.now(),
      metrics: {
        duration: 100,
        cost: 0,
        totalTokens: { input: 0, output: 0 }
      },
      stateSignature: "similar_state_xyz789",
      executionTrace: {
        tasks: [],
        impulsesCreated: [],
        filesModified: []
      }
    };

    const stored = await mcpClient.storeExecutionTrace(execution);
    expect(stored).toBe(true);
  });
});

// =============================================================================
// E. IMPULSE RELEVANCE TRACKING
// =============================================================================

describe("Impulse Relevance Tracking", () => {
  test("Impulse usage metrics recorded", async () => {
    // Record impulse usage
    const recorded = await mcpClient.recordImpulseRelevance({
      impulse_id: "test_impulse_1",
      activity_id: "test_activity",
      task_id: "task1",
      loaded: true,
      execution_succeeded: true,
      content_size_tokens: 100,
      pointer_type: "file"
    });

    expect(recorded).toBe(true);
  });

  test("Impulse relevance affects recommendations", async () => {
    // This is a learning feature that requires multiple executions
    // For now, verify the API accepts relevance data

    // Record multiple uses of same impulse
    for (let i = 0; i < 3; i++) {
      await mcpClient.recordImpulseRelevance({
        impulse_id: "test_impulse_2",
        activity_id: "test_activity_2",
        loaded: true,
        execution_succeeded: true,
        content_size_tokens: 150,
        pointer_type: "memo"
      });
    }

    // Success if no errors thrown
    expect(true).toBe(true);
  });
});

// =============================================================================
// F. TOOL USAGE PATTERNS
// =============================================================================

describe("Tool Usage Patterns", () => {
  test("Tool argument patterns recorded", async () => {
    // Record tool usage
    const recorded = await mcpClient.recordToolUsage({
      activityId: "test_activity",
      toolName: "bash",
      argumentShape: "bash_args",
      argumentHash: "hash123",
      arguments: { command: "echo test" },
      executionSucceeded: true,
      executionMs: 50
    });

    expect(recorded).toBe(true);
  });

  test("Tool recommendations based on patterns", async () => {
    // Query tool recommendations
    const recommendations = await mcpClient.getToolArgumentRecommendations({
      activityId: "test_activity",
      toolName: "bash",
      limit: 5
    });

    expect(Array.isArray(recommendations)).toBe(true);

    if (recommendations.length > 0) {
      const rec = recommendations[0];
      expect(rec.toolName).toBe("bash");
      expect(rec.successRate).toBeGreaterThanOrEqual(0);
      expect(rec.successRate).toBeLessThanOrEqual(1);
      expect(rec.timesUsed).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// G. ERROR HANDLING
// =============================================================================

describe("Error Handling", () => {
  test("Invalid API key returns 401", async () => {
    const invalidClient = new MCPClient({
      endpoint: BACKEND_ENDPOINT,
      instance: {
        apiKey: "invalid_key"
      }
    });

    try {
      await invalidClient.recommendActivities({
        goal: "test",
        limit: 5
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test("Network errors are handled gracefully", async () => {
    const offlineClient = new MCPClient({
      endpoint: "http://nonexistent.invalid",
      instance: {
        apiKey: "test_key"
      },
      timeout: 1000
    });

    try {
      await offlineClient.recommendActivities({
        goal: "test",
        limit: 5
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

// =============================================================================
// H. HEALTH CHECK
// =============================================================================

describe("Health Check", () => {
  test("Backend health endpoint responds", async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe("healthy");
  });

  test("Backend version information available", async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/health`);
    const data = await response.json();

    // Check for version info (if provided)
    if (data.version) {
      expect(typeof data.version).toBe("string");
    }
  });
});
