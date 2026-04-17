#!/usr/bin/env bun
/**
 * Execute validation activities through MiniBob's real ActivityExecutor
 *
 * This integrates with repos/minibob to actually run the validation activities
 * through the real execution system, exercising all resolvers.
 */

import { resolve } from "path";
import { homedir } from "os";
import { existsSync } from "fs";

// Import MiniBob's ActivityExecutor
const minibobPath = resolve(__dirname, "../../repos/minibob");

async function loadConfig() {
  const configPath = resolve(homedir(), ".metabob/config.json");
  if (existsSync(configPath)) {
    const configFile = Bun.file(configPath);
    return await configFile.json();
  }
  return {};
}

async function executeWithMiniBob(activityTemplate: any, variables: any = {}) {
  console.log(`  🔄 Executing through MiniBob ActivityExecutor...`);

  try {
    // Dynamically import MiniBob's executor
    const { ActivityExecutor } = await import(`${minibobPath}/src/activity.ts`);

    // Load config
    const config = await loadConfig();

    // Get config from environment or config file
    const provider = (process.env.MINIBOB_PROVIDER || config.defaults?.provider || "anthropic") as "anthropic" | "openai";
    const apiKey =
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      config.providers?.anthropic?.apiKey ||
      config.providers?.openai?.apiKey ||
      "";
    const model = process.env.MINIBOB_MODEL || config.defaults?.model || "claude-sonnet-4-20250514";

    if (!apiKey) {
      throw new Error("Missing LLM API key (ANTHROPIC_API_KEY or OPENAI_API_KEY in env, or config at ~/.metabob/config.json)");
    }

    // Create executor instance
    const executor = new ActivityExecutor({
      provider,
      apiKey,
      model,
      workingDirectory: process.cwd(),
    });

    // Execute activity
    const result = await executor.execute({
      template: activityTemplate,
      variables,
      reason: "sequence-validation",
    });

    return {
      status: result.status,
      executionId: result.id,
      trace: {
        executionId: result.id,
        templateId: activityTemplate.id,
        tasks: result.taskResults.map((task: any) => ({
          id: task.taskId,
          status: task.status,
          resolver: task.resolver?.name || "unknown",
          duration: task.duration || 0,
        })),
        metadata: result.executionTrace?.metadata || {},
      },
    };
  } catch (error: any) {
    console.error(`  ❌ MiniBob execution failed: ${error.message}`);
    throw error;
  }
}

export { executeWithMiniBob };

// CLI interface
if (import.meta.main) {
  const activityFile = process.argv[2];

  if (!activityFile) {
    console.error("Usage: bun execute-with-minibob.ts <activity-file.json>");
    process.exit(1);
  }

  const template = await Bun.file(activityFile).json();

  console.log(`Executing: ${template.name}`);
  console.log(`Tasks: ${template.tasks.length}`);

  try {
    const result = await executeWithMiniBob(template);

    console.log(`\n✅ Execution completed:`);
    console.log(`   Execution ID: ${result.executionId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Tasks: ${result.trace.tasks.length}`);

    console.log(`\nTask Results:`);
    for (const task of result.trace.tasks) {
      console.log(
        `   ${task.status === "completed" ? "✅" : "❌"} ${task.id} (${task.resolver?.name || "unknown"})`
      );
    }
  } catch (error: any) {
    console.error(`\n❌ Execution failed: ${error.message}`);
    process.exit(1);
  }
}
