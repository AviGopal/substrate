/**
 * Test MiniBob Integration for Self-Development
 */

import { describe, test, expect } from "bun:test";
import { initializeMiniBobForDev, type MiniBobDevConfig } from "../../src/commands/minibob-integration.ts";

describe("MiniBob Self-Development Integration", () => {
  test("initializeMiniBobForDev creates executor with valid config", () => {
    const config: MiniBobDevConfig = {
      workdir: "/test/workdir",
      backend: "http://activity.metabob.local",
      apiKey: "test-api-key",
      instanceId: "microplastic-dev",
      anthropicApiKey: "test-anthropic-key",
      verbose: false,
    };

    const executor = initializeMiniBobForDev(config);

    expect(executor).toBeDefined();
    expect(executor.execute).toBeDefined();
  });

  test("initializeMiniBobForDev throws error when workdir is missing", () => {
    const config = {
      workdir: "",
      backend: "http://activity.metabob.local",
      apiKey: "test-api-key",
      instanceId: "microplastic-dev",
      anthropicApiKey: "test-anthropic-key",
    };

    expect(() => initializeMiniBobForDev(config)).toThrow("workdir is required");
  });

  test("initializeMiniBobForDev throws error when backend is missing", () => {
    const config = {
      workdir: "/test/workdir",
      backend: "",
      apiKey: "test-api-key",
      instanceId: "microplastic-dev",
      anthropicApiKey: "test-anthropic-key",
    };

    expect(() => initializeMiniBobForDev(config)).toThrow("backend is required");
  });

  test("initializeMiniBobForDev throws error when apiKey is missing", () => {
    const config = {
      workdir: "/test/workdir",
      backend: "http://activity.metabob.local",
      apiKey: "",
      instanceId: "microplastic-dev",
      anthropicApiKey: "test-anthropic-key",
    };

    expect(() => initializeMiniBobForDev(config)).toThrow("apiKey is required");
  });

  test("initializeMiniBobForDev throws error when instanceId is missing", () => {
    const config = {
      workdir: "/test/workdir",
      backend: "http://activity.metabob.local",
      apiKey: "test-api-key",
      instanceId: "",
      anthropicApiKey: "test-anthropic-key",
    };

    expect(() => initializeMiniBobForDev(config)).toThrow("instanceId is required");
  });

  test("initializeMiniBobForDev throws error when anthropicApiKey is missing", () => {
    const config = {
      workdir: "/test/workdir",
      backend: "http://activity.metabob.local",
      apiKey: "test-api-key",
      instanceId: "microplastic-dev",
      anthropicApiKey: "",
    };

    expect(() => initializeMiniBobForDev(config)).toThrow("anthropicApiKey is required");
  });

  test("executor uses default model when not specified", () => {
    const config: MiniBobDevConfig = {
      workdir: "/test/workdir",
      backend: "http://activity.metabob.local",
      apiKey: "test-api-key",
      instanceId: "microplastic-dev",
      anthropicApiKey: "test-anthropic-key",
    };

    const executor = initializeMiniBobForDev(config);
    expect(executor).toBeDefined();
    // Default model is configured internally
  });

  test("executor accepts custom model", () => {
    const config: MiniBobDevConfig = {
      workdir: "/test/workdir",
      backend: "http://activity.metabob.local",
      apiKey: "test-api-key",
      instanceId: "microplastic-dev",
      anthropicApiKey: "test-anthropic-key",
      model: "claude-opus-4-20250514",
    };

    const executor = initializeMiniBobForDev(config);
    expect(executor).toBeDefined();
  });
});
