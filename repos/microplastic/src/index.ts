#!/usr/bin/env bun
/**
 * microplastic - Composite vessel agent-IDE
 *
 * A Claude Code replacement that gains capabilities through use.
 * Composes three vessels: minibob (execution), tui (narrative), mcp (analysis)
 */

import { version, description } from "../package.json";

// Simple argument parsing for Phase 1
const args = process.argv.slice(2);

interface Options {
  workdir: string;
  verbose: boolean;
  dryRun: boolean;
}

function parseArgs(): { command: string | null; goal: string | null; options: Options } {
  const options: Options = {
    workdir: process.cwd(),
    verbose: false,
    dryRun: false,
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

  console.log("\n\x1b[90mTemplates are stored in the activity-api backend.\x1b[0m");
  console.log("\x1b[33m[Template loading not yet implemented - Phase 8]\x1b[0m");
}

function showHistory() {
  console.log(`\x1b[36mmicroplastic history\x1b[0m`);
  console.log("\n\x1b[33m[Not yet implemented - Phase 10]\x1b[0m");
}

function runGoal(goal: string, options: Options) {
  console.log(`\x1b[36mmicroplastic\x1b[0m v${version}`);
  console.log(`\x1b[90mWorkdir: ${options.workdir}\x1b[0m\n`);

  if (options.dryRun) {
    console.log("\x1b[33m[dry-run]\x1b[0m Would execute goal:", goal);
    return;
  }

  console.log("\x1b[34mGoal:\x1b[0m", goal);
  console.log("\x1b[90mThinking...\x1b[0m");
  console.log("\n\x1b[33m[Goal execution not yet implemented - Phase 2+]\x1b[0m");
}

function runInteractive(options: Options) {
  console.log(`\x1b[36mmicroplastic\x1b[0m v${version}`);
  console.log("\x1b[90mComposite vessel agent-IDE\x1b[0m\n");
  console.log(`Workdir: \x1b[34m${options.workdir}\x1b[0m`);
  console.log("\x1b[90mVerbose:\x1b[0m", options.verbose ? "enabled" : "disabled");
  console.log();

  console.log("\x1b[1mVessels:\x1b[0m");
  console.log("  \x1b[32m+\x1b[0m minibob  - execution");
  console.log("  \x1b[32m+\x1b[0m tui      - narrative");
  console.log("  \x1b[32m+\x1b[0m mcp      - analysis");
  console.log();
  console.log("\x1b[33m[Interactive TUI not yet implemented - Phase 3]\x1b[0m");
  console.log("\x1b[90mUse `microplastic \"your goal\"` to execute a goal.\x1b[0m");
}

// Main
const { command, goal, options } = parseArgs();

if (command === "help") {
  showHelp();
} else if (command === "templates") {
  showTemplates();
} else if (command === "history") {
  showHistory();
} else if (goal) {
  runGoal(goal, options);
} else {
  runInteractive(options);
}
