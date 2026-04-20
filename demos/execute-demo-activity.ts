#!/usr/bin/env bun
/**
 * Direct execution of terminal vessel demonstration activity
 * Shows "activities all the way down" - running a demo AS an activity
 */

import { runActivity } from "../repos/minibob/src/activity";
import type { ActivityTemplate } from "../repos/minibob/src/types";

console.log("═══════════════════════════════════════════════════════════════════");
console.log("  Executing Terminal Vessel Demo as Activity");
console.log("═══════════════════════════════════════════════════════════════════\n");

// Load the activity template
const templatePath = "./repos/minibob/activities/demo/terminal-vessel-demo.json";
const templateFile = Bun.file(templatePath);

if (!(await templateFile.exists())) {
  console.error(`❌ Activity template not found: ${templatePath}`);
  process.exit(1);
}

const template: ActivityTemplate = await templateFile.json();

console.log(`Activity: ${template.name}`);
console.log(`ID: ${template.id}`);
console.log(`Description: ${template.description}\n`);

console.log("Variables:");
console.log(`  demo_type: deduplication (showing impulse deduplication)\n`);

console.log("═══════════════════════════════════════════════════════════════════\n");

// Execute the activity
const result = await runActivity({
  template,
  variables: { demo_type: "deduplication" },
  reason: "Terminal vessel demonstration via activity system",
});

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("  Activity Execution Complete");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log(`Status: ${result.status}`);
console.log(`Duration: ${result.durationMs}ms`);
console.log(`Cost: $${result.costUsd?.toFixed(4) ?? "0.0000"}\n`);

if (result.status === "completed") {
  console.log("✅ Demonstration executed successfully as an activity!");
} else {
  console.log("❌ Activity execution failed");
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("  Key Insight: \"Activities All The Way Down\"");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log("What just happened:");
console.log("  1. Loaded activity template (terminal-vessel-demo.json)");
console.log("  2. Executed via MiniBob's activity system");
console.log("  3. Activity ran bash resolver to execute TypeScript demo");
console.log("  4. Output captured and observable");
console.log("  5. Execution traced (would be stored in backend)\n");

console.log("This demonstrates:");
console.log("  → Demonstrations are activities");
console.log("  → Meta-operations flow through the vessel");
console.log("  → Everything is observable and traceable");
console.log("  → The vessel doesn't distinguish meta from work\n");

console.log("═══════════════════════════════════════════════════════════════════\n");
