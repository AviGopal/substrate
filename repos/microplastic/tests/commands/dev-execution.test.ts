/**
 * Test /dev command execution flow
 *
 * Verifies that development goals are executed via MiniBob and traces are captured.
 *
 * NOTE: These tests require:
 * - ANTHROPIC_API_KEY environment variable
 * - Running metabob-activity-api backend
 * - MiniBob API key configured
 *
 * Run with: SKIP_INTEGRATION=1 to skip these tests in CI
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { initializeMiniBobForDev, type MiniBobDevConfig } from "../../src/commands/minibob-integration.ts";
import path from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";

// Skip tests if integration testing is disabled
const SKIP = process.env.SKIP_INTEGRATION === "1";

describe("Development Goal Execution", () => {
  const testWorkdir = path.join(process.cwd(), ".test-workdir");
  let executor: ReturnType<typeof initializeMiniBobForDev>;

  beforeAll(() => {
    if (SKIP) {
      console.log("⊘ Skipping integration tests (SKIP_INTEGRATION=1)");
      return;
    }

    // Create test workspace
    if (existsSync(testWorkdir)) {
      rmSync(testWorkdir, { recursive: true, force: true });
    }
    mkdirSync(testWorkdir, { recursive: true });

    // Verify required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    // Initialize executor
    const config: MiniBobDevConfig = {
      workdir: testWorkdir,
      backend: process.env.ACTIVITY_API_URL ?? "http://activity.metabob.local",
      apiKey: process.env.MINIBOB_API_KEY ?? "test-key",
      instanceId: "microplastic-test",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      verbose: false,
    };

    executor = initializeMiniBobForDev(config);
  });

  test("executor initializes with valid config", () => {
    if (SKIP) return;

    expect(executor).toBeDefined();
    expect(executor.execute).toBeDefined();
  });

  test.skip("simple development goal creates file (live test)", async () => {
    if (SKIP) return;

    const testFile = path.join(testWorkdir, "hello.txt");

    // Execute development goal
    const result = await executor.execute(
      `Create a file at ${testFile} with the text "Hello from microplastic"`
    );

    // Verify result structure
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.durationMs).toBeGreaterThan(0);

    // If successful, verify file was created
    if (result.success) {
      expect(existsSync(testFile)).toBe(true);
      expect(result.filesModified).toContain(testFile);
    }
  }, 30000); // 30 second timeout for LLM calls

  test("development goal with improvisation template", async () => {
    if (SKIP) return;

    // Execute with no matching template (will improvise)
    const result = await executor.execute(
      "Add a comment to a non-existent file"
    );

    // Should complete (success or failure) with trace
    expect(result).toBeDefined();
    expect(result.improvised).toBe(true);
    expect(result.summary).toBeDefined();
  }, 30000);

  test("failed goal reports error properly", async () => {
    if (SKIP) return;

    // Execute impossible goal
    const result = await executor.execute(
      "Delete the entire filesystem (this should fail)"
    );

    // Should fail gracefully
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.summary).toContain("fail");
  }, 30000);
});

describe("Development Trace Capture", () => {
  test("execution result includes trace metadata", async () => {
    if (SKIP) return;

    const config: MiniBobDevConfig = {
      workdir: process.cwd(),
      backend: process.env.ACTIVITY_API_URL ?? "http://activity.metabob.local",
      apiKey: process.env.MINIBOB_API_KEY ?? "test-key",
      instanceId: "microplastic-dev",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "test-key",
      verbose: false,
    };

    const executor = initializeMiniBobForDev(config);

    // Execute simple goal
    const result = await executor.execute("Echo 'test'");

    // Verify trace metadata is present
    expect(result.executionId).toBeDefined();
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.cost).toBeGreaterThanOrEqual(0);

    // Files modified should be an array (even if empty)
    expect(Array.isArray(result.filesModified)).toBe(true);
  }, 30000);
});
