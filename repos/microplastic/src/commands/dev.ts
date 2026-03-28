/**
 * /dev Command - Self-Development Mode
 *
 * Uses MiniBob to develop microplastic itself, creating a self-improvement loop.
 */

import type { Options } from "../types.ts";
import { initializeMiniBobForDev, type MiniBobDevConfig } from "./minibob-integration.ts";

export interface DevOptions extends Options {
  analyze?: boolean; // Run trace analysis first
  seed?: boolean; // Seed templates before execution
}

/**
 * Execute a development goal using MiniBob
 *
 * This command uses MiniBob to modify microplastic's own codebase,
 * creating a self-development loop where:
 * 1. Development activities are executed by MiniBob
 * 2. Traces are captured and sent to the backend
 * 3. Templates are extracted via ribosome
 * 4. Future development work benefits from learned patterns
 *
 * @param goal - Development goal (e.g., "Add a console.log to index.ts")
 * @param options - Execution options including workdir, verbose, etc.
 */
export async function devCommand(goal: string, options: DevOptions): Promise<void> {
  console.log(`\x1b[36m/dev\x1b[0m ${goal}\n`);

  // Get required environment variables
  const backend = process.env.ACTIVITY_API_URL ?? "http://activity.metabob.local";
  const apiKey = process.env.MINIBOB_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  // Validate configuration
  if (!apiKey) {
    console.error("\x1b[31mError: MINIBOB_API_KEY environment variable not set\x1b[0m");
    console.error("\x1b[90mSet it with: export MINIBOB_API_KEY=your-key\x1b[0m");
    process.exit(1);
  }

  if (!anthropicApiKey) {
    console.error("\x1b[31mError: ANTHROPIC_API_KEY environment variable not set\x1b[0m");
    console.error("\x1b[90mSet it with: export ANTHROPIC_API_KEY=your-key\x1b[0m");
    process.exit(1);
  }

  // Create MiniBob configuration
  const config: MiniBobDevConfig = {
    workdir: options.workdir,
    backend,
    apiKey,
    instanceId: "microplastic-dev",
    anthropicApiKey,
    verbose: options.verbose,
  };

  // Initialize MiniBob executor
  const executor = initializeMiniBobForDev(config);

  // Execute development goal
  try {
    const result = await executor.execute(goal);

    // Exit with appropriate code
    if (result.success) {
      console.log("\n\x1b[32m✓ Development goal completed\x1b[0m");
      process.exit(0);
    } else {
      console.log("\n\x1b[31m✗ Development goal failed\x1b[0m");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n\x1b[31m✗ Unexpected error:\x1b[0m", error);
    process.exit(1);
  }
}
