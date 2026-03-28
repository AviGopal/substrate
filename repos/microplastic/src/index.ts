#!/usr/bin/env bun
/**
 * microplastic - Composite vessel agent-IDE
 *
 * A Claude Code replacement that gains capabilities through use.
 * Composes three vessels: minibob (execution), tui (narrative), mcp (analysis)
 */

import { version, description } from "../package.json";
import { GoalExecutor, type ExecutionContext } from "./execution/index.ts";
import { PRIMORDIAL_TEMPLATES } from "./primordials/index.ts";
import {
  TUIState,
  NarrativeRenderer,
  RegionManager,
  RegionRenderer,
  createExecutionBridge,
} from "./tui/index.ts";
import { ImpulseStore } from "./impulse/index.ts";

// Simple argument parsing for Phase 1
const args = process.argv.slice(2);

interface Options {
  workdir: string;
  verbose: boolean;
  dryRun: boolean;
  useRegions: boolean; // Use region-based TUI
}

function parseArgs(): { command: string | null; goal: string | null; options: Options } {
  const options: Options = {
    workdir: process.cwd(),
    verbose: false,
    dryRun: false,
    useRegions: true, // Default to region-based TUI
  };

  let command: string | null = null;
  let goal: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--version" || arg === "-V") {
      console.log(`microplastic, ${version}`);
      process.exit(0);
    }

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    }

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
      continue;
    }

    if (arg === "--dry-run" || arg === "-d") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--workdir" || arg === "-w") {
      options.workdir = args[++i] ?? process.cwd();
      continue;
    }

    if (arg === "--classic") {
      options.useRegions = false;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }

    // First non-option argument
    if (arg === "help" || arg === "templates" || arg === "history") {
      command = arg as "help" | "templates" | "history";
    } else {
      goal = arg;
    }
  }

  return { command, goal, options };
}

function showHelp() {
  console.log(`
${description}

Usage:
  microplastic [goal]              Execute a goal or enter interactive mode
  microplastic help                Show this help
  microplastic templates           List available activity templates
  microplastic history             Show execution history

Options:
  -w, --workdir <dir>  Working directory (default: current directory)
  -v, --verbose        Enable verbose output
  -d, --dry-run        Show what would be done without executing
  --classic            Use classic narrative TUI (default: region-based)
  -V, --version        Show version
  -h, --help           Show this help

Examples:
  microplastic                          # Interactive mode
  microplastic "Fix the login bug"      # Execute a goal
  microplastic templates --level 0      # List level 0 templates
`);
}

function showTemplates() {
  console.log(`\x1b[36mmicroplastic templates\x1b[0m`);
  console.log("\x1b[90mTemplate hierarchy:\x1b[0m\n");

  const levels = [
    { level: 0, name: "Primordial", desc: "Immutable core templates" },
    { level: 1, name: "Meta", desc: "Templates that create templates" },
    { level: 2, name: "Spec", desc: "Specification generation" },
    { level: 3, name: "Development", desc: "Core development activities" },
    { level: 4, name: "Choreography", desc: "TUI interaction patterns" },
  ];

  for (const l of levels) {
    console.log(`  Level ${l.level}: \x1b[1m${l.name}\x1b[0m - ${l.desc}`);
  }

  console.log("\n\x1b[1mPrimordial Templates (Level 0):\x1b[0m");
  for (const t of PRIMORDIAL_TEMPLATES) {
    console.log(`  \x1b[32m${t.id}\x1b[0m - ${t.description}`);
  }

  console.log("\n\x1b[90mBackend templates will be loaded when connected.\x1b[0m");
}

function showHistory() {
  console.log(`\x1b[36mmicroplastic history\x1b[0m`);
  console.log("\n\x1b[33m[Not yet implemented - Phase 10]\x1b[0m");
}

async function runGoal(goal: string, options: Options) {
  if (options.useRegions) {
    await runGoalWithRegions(goal, options);
  } else {
    await runGoalClassic(goal, options);
  }
}

/**
 * Run goal with region-based TUI (new style)
 */
async function runGoalWithRegions(goal: string, options: Options) {
  // Create shared impulse store
  const impulseStore = new ImpulseStore();

  // Initialize region manager and renderer
  const regionManager = new RegionManager();
  const renderer = new RegionRenderer(regionManager, {
    mode: process.stdout.isTTY ? "ansi" : "text",
  });

  // Create executor with impulse store
  const executor = new GoalExecutor({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    apiBaseUrl: process.env.ACTIVITY_API_URL ?? "http://localhost:8080",
    captureTraces: true,
    impulseStore, // Phase 2: Pass impulse store
  });

  // Create execution bridge to wire impulses to regions
  const bridge = createExecutionBridge(regionManager, executor, {
    showToolCalls: true,
    showImpulses: true,
    collapseDelay: 0, // Don't collapse for single-shot execution
    impulseStore, // Phase 2: Pass impulse store to bridge
  });

  // Seed primordials (fire and forget)
  executor.seedPrimordials().catch(() => {});

  // Start rendering
  renderer.start();

  // Create execution context
  const context: ExecutionContext = {
    goal,
    workdir: options.workdir,
    impulses: [],
    verbose: options.verbose,
    dryRun: options.dryRun,
  };

  // Execute
  await executor.execute(context);

  // Give renderer time to show final state and process all events
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Stop renderer (will do final render)
  renderer.stop();

  // Clean up bridge subscriptions
  bridge.shutdown();

  // Force exit for single-shot execution (minibob ActivityExecutor may leave handles open)
  process.exit(0);
}

/**
 * Run goal with classic narrative TUI (old style)
 */
async function runGoalClassic(goal: string, options: Options) {
  // Initialize TUI state and renderer
  const tuiState = new TUIState();
  const renderer = new NarrativeRenderer(tuiState, {
    mode: process.stdout.isTTY ? "ansi" : "text",
  });

  // Start rendering
  renderer.start();

  // Create executor with backend URL from environment
  const executor = new GoalExecutor({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    apiBaseUrl: process.env.ACTIVITY_API_URL ?? "http://localhost:8080",
    captureTraces: true,
  });

  // Seed primordials to backend on first run (fire and forget)
  executor.seedPrimordials().catch(() => {
    // Silently fail - backend might not be available
  });

  // Wire executor events to TUI state
  executor.on("execution:start", () => {
    tuiState.startThinking(goal);
  });

  executor.on("execution:template_selected", ({ template }) => {
    tuiState.startExecuting(template.name, template.tasks.length);
  });

  executor.on("execution:improvising", () => {
    tuiState.startExecuting("Improvisation", 1);
  });

  executor.on("execution:task_start", ({ taskIndex, totalTasks, taskName }) => {
    tuiState.updateProgress(taskIndex - 1, taskName);
    if (options.verbose) {
      console.log(`\x1b[90m[Task ${taskIndex}/${totalTasks}] ${taskName}\x1b[0m`);
    }
  });

  executor.on("execution:task_complete", ({ taskIndex, success }) => {
    if (options.verbose) {
      console.log(`\x1b[90m[Task ${taskIndex}] ${success ? "✓" : "✗"}\x1b[0m`);
    }
  });

  // Wire tool calls to TUI (always, not just verbose)
  executor.on("execution:tool_call", (data) => {
    const running = tuiState.activeToolCalls;
    if (running.length > 0) {
      tuiState.completeToolCall(running[running.length - 1]!.tool, true);
    }
    tuiState.startToolCall(data.tool, data.args as Record<string, unknown> | undefined);
    if (options.verbose) {
      console.log(`\x1b[90m[Tool] ${data.tool}\x1b[0m`);
    }
  });

  // Create execution context
  const context: ExecutionContext = {
    goal,
    workdir: options.workdir,
    impulses: [],
    verbose: options.verbose,
    dryRun: options.dryRun,
  };

  // Execute
  const result = await executor.execute(context);

  // Update TUI state based on result
  if (result.success) {
    const summary = result.durationMs
      ? `${result.summary} (${(result.durationMs / 1000).toFixed(1)}s, $${result.cost.toFixed(4)})`
      : result.summary;
    tuiState.complete(summary);
  } else {
    tuiState.fail(result.error ?? result.summary, ["Retry", "Try different approach", "Investigate"]);
  }

  // Give renderer time to show final state
  await new Promise((resolve) => setTimeout(resolve, 100));
  renderer.stop();
}

/**
 * Run interactive mode with region-based TUI (new style)
 */
async function runInteractiveWithRegions(options: Options) {
  // Create shared impulse store
  const impulseStore = new ImpulseStore();

  // Initialize region manager and renderer
  const regionManager = new RegionManager();
  const renderer = new RegionRenderer(regionManager, {
    mode: process.stdout.isTTY ? "ansi" : "text",
  });

  // Create executor with impulse store
  const executor = new GoalExecutor({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    apiBaseUrl: process.env.ACTIVITY_API_URL ?? "http://localhost:8080",
    captureTraces: true,
    impulseStore, // Pass impulse store for impulse-driven execution
  });

  // Create execution bridge with impulse store
  const bridge = createExecutionBridge(regionManager, executor, {
    showToolCalls: true,
    showImpulses: true,
    collapseDelay: 3000, // Collapse completed regions after 3 seconds
    impulseStore, // Pass impulse store for impulse subscriptions
  });

  // Seed primordials
  executor.seedPrimordials().catch(() => {});

  // Track current input state
  let inputValue = "";
  let cursorPosition = 0;
  let isExecuting = false;

  // Subscribe to user_goal impulses and execute them
  impulseStore.subscribe(
    async (event) => {
      if (event.type !== "create") return;

      const impulse = event.impulse;
      if (!impulse.content) return;

      try {
        const goalData = JSON.parse(impulse.content);
        const context: ExecutionContext = {
          goal: goalData.goal,
          workdir: options.workdir,
          impulses: [],
          verbose: options.verbose,
          dryRun: options.dryRun,
        };

        await executor.execute(context);

        // After completion, clear old regions and show input for next goal
        setTimeout(() => {
          bridge.clearCompleted();
          bridge.showInput();
          isExecuting = false; // Reset flag
        }, 2000);
      } catch (error) {
        console.error("[Interactive] Error executing goal from impulse:", error);
        isExecuting = false; // Reset flag on error
      }
    },
    { shape: "user_goal" }
  );

  // Start rendering
  renderer.start();

  // Show initial input region
  bridge.showInput();

  // Set up keyboard input (raw mode for real-time input)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    console.log(`\x1b[36mmicroplastic\x1b[0m v${version}`);
    console.log("\x1b[90mType a goal and press Enter. Ctrl+C to exit.\x1b[0m\n");

    // Handle keyboard input
    process.stdin.on("data", async (key: string) => {
      // Ctrl+C - exit
      if (key === "\x03") {
        renderer.stop();
        process.exit(0);
      }

      // Ctrl+D - exit
      if (key === "\x04") {
        renderer.stop();
        process.exit(0);
      }

      // Ignore input while executing
      if (isExecuting) return;

      // Handle special keys
      if (key === "\r") {
        // Enter - submit
        if (inputValue.trim()) {
          isExecuting = true;
          const goal = inputValue.trim();
          inputValue = "";
          cursorPosition = 0;
          bridge.submitInput();

          // Create user_goal impulse instead of directly executing
          impulseStore.create({
            pointer: { type: "user_input", value: goal },
            budget: 2000,
            priority: "high",
            shape: "user_goal",
            content: JSON.stringify({
              goal,
              timestamp: Date.now(),
            }),
            metadata: {
              source: "interactive",
              timestamp: Date.now(),
            },
          });
        }
      } else if (key === "\x7f") {
        // Backspace
        if (cursorPosition > 0) {
          inputValue = inputValue.slice(0, cursorPosition - 1) + inputValue.slice(cursorPosition);
          cursorPosition--;
          bridge.updateInput(inputValue, cursorPosition);
        }
      } else if (key === "\x1b[D") {
        // Left arrow
        if (cursorPosition > 0) {
          cursorPosition--;
          bridge.updateInput(inputValue, cursorPosition);
        }
      } else if (key === "\x1b[C") {
        // Right arrow
        if (cursorPosition < inputValue.length) {
          cursorPosition++;
          bridge.updateInput(inputValue, cursorPosition);
        }
      } else if (key === "\x1b[A" || key === "\x1b[B") {
        // Arrow up/down - could be history navigation, ignore for now
      } else if (key === "\x1b") {
        // Escape - clear input
        inputValue = "";
        cursorPosition = 0;
        bridge.updateInput(inputValue, cursorPosition);
      } else if (!key.startsWith("\x1b") && key.length === 1) {
        // Regular character
        inputValue = inputValue.slice(0, cursorPosition) + key + inputValue.slice(cursorPosition);
        cursorPosition++;
        bridge.updateInput(inputValue, cursorPosition);
      }
    });
  } else {
    // Non-TTY mode - read from stdin line by line
    console.log(`\x1b[36mmicroplastic\x1b[0m v${version}`);
    console.log("\x1b[90mReading goals from stdin...\x1b[0m\n");

    const rl = await import("readline").then((m) =>
      m.createInterface({ input: process.stdin, output: process.stdout })
    );

    rl.on("line", async (line) => {
      const goal = line.trim();
      if (goal) {
        await runGoal(goal, options);
      }
    });

    rl.on("close", () => {
      renderer.stop();
      process.exit(0);
    });
  }
}

async function runInteractive(options: Options) {
  // Use region-based TUI by default
  if (options.useRegions) {
    return runInteractiveWithRegions(options);
  }

  // Classic narrative TUI
  // Initialize TUI state and renderer
  const tuiState = new TUIState();
  const renderer = new NarrativeRenderer(tuiState, {
    mode: process.stdout.isTTY ? "ansi" : "text",
  });

  // Create executor
  const executor = new GoalExecutor({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    apiBaseUrl: process.env.ACTIVITY_API_URL ?? "http://localhost:8080",
    captureTraces: true,
  });

  // Seed primordials
  executor.seedPrimordials().catch(() => {});

  // Start rendering
  renderer.start();

  // Set up keyboard input (raw mode for real-time input)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // Handle keyboard input
    process.stdin.on("data", async (key: string) => {
      // Ctrl+C - exit
      if (key === "\x03") {
        renderer.stop();
        process.exit(0);
      }

      // Ctrl+D - exit
      if (key === "\x04") {
        renderer.stop();
        process.exit(0);
      }

      // Pass key to TUI state
      tuiState.injectKey(key === "\r" ? "Enter" : key === "\x7f" ? "Backspace" : key === "\x1b" ? "Escape" : key === "\x1b[A" ? "ArrowUp" : key === "\x1b[B" ? "ArrowDown" : key);
    });

    // Handle input submission
    tuiState.on("input:submit", async ({ value }) => {
      // Execute the goal
      const context: ExecutionContext = {
        goal: value,
        workdir: options.workdir,
        impulses: [],
        verbose: options.verbose,
        dryRun: options.dryRun,
      };

      // Wire executor events to TUI
      executor.on("execution:template_selected", ({ template }) => {
        tuiState.startExecuting(template.name, template.tasks.length);
      });

      executor.on("execution:improvising", () => {
        tuiState.startExecuting("Improvisation", 1);
      });

      executor.on("execution:task_start", ({ taskIndex, taskName }) => {
        tuiState.updateProgress(taskIndex - 1, taskName);
      });

      // Wire tool calls to TUI
      executor.on("execution:tool_call", (data) => {
        // Complete any previous running tool call
        const running = tuiState.activeToolCalls;
        if (running.length > 0) {
          tuiState.completeToolCall(running[running.length - 1]!.tool, true);
        }
        tuiState.startToolCall(data.tool, data.args as Record<string, unknown> | undefined);
      });

      const result = await executor.execute(context);

      if (result.success) {
        const summary = result.durationMs
          ? `${result.summary} (${(result.durationMs / 1000).toFixed(1)}s, $${result.cost.toFixed(4)})`
          : result.summary;
        tuiState.complete(summary);
      } else {
        tuiState.fail(result.error ?? result.summary);
      }

      // After completion, reset to idle for next goal
      setTimeout(() => {
        tuiState.reset();
        tuiState.activateInput();
      }, 2000);
    });

    // Activate input on start
    tuiState.activateInput();

    console.log(`\x1b[36mmicroplastic\x1b[0m v${version}`);
    console.log("\x1b[90mType a goal and press Enter. Ctrl+C to exit.\x1b[0m\n");

  } else {
    // Non-TTY mode - read from stdin line by line
    console.log(`\x1b[36mmicroplastic\x1b[0m v${version}`);
    console.log("\x1b[90mReading goals from stdin...\x1b[0m\n");

    const rl = await import("readline").then((m) =>
      m.createInterface({ input: process.stdin, output: process.stdout })
    );

    rl.on("line", async (line) => {
      const goal = line.trim();
      if (goal) {
        await runGoal(goal, options);
      }
    });

    rl.on("close", () => {
      renderer.stop();
      process.exit(0);
    });
  }
}

// Main
async function main() {
  const { command, goal, options } = parseArgs();

  if (command === "help") {
    showHelp();
  } else if (command === "templates") {
    showTemplates();
  } else if (command === "history") {
    showHistory();
  } else if (goal) {
    await runGoal(goal, options);
  } else {
    await runInteractive(options);
  }
}

main().catch((error) => {
  console.error("\x1b[31mError:\x1b[0m", error.message);
  process.exit(1);
});
