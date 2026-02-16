#!/usr/bin/env node
/**
 * Integration test for cochange-enhanced activity templates
 * Tests the fix-bug-complete template with auth.ts buggy code
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

console.log("=== Cochange Learning Integration Test ===\n");

// Test 1: Verify template can be found
console.log("Test 1: Checking if fix-bug-complete template is loadable...");
try {
  const result = execSync(
    'opencode activity --template-id=fix-bug-complete --list-variables',
    { encoding: 'utf-8', stdio: 'pipe' }
  );
  console.log("✅ Template is loadable!\n");
} catch (error) {
  console.error("❌ Template NOT loadable!");
  console.error(error.message);
  console.error("\nTemplate loading still broken after fix.\n");
  process.exit(1);
}

// Test 2: Run activity with cochange learning
console.log("Test 2: Running fix-bug-complete activity...");
console.log("Bug: getUserProfile crashes with null user in test-cochange-learning/src/auth.ts\n");

const activityCmd = `
opencode activity run fix-bug-complete \\
  --bug_description="getUserProfile crashes with null user - missing null check" \\
  --affected_files="test-cochange-learning/src/auth.ts" \\
  --workspace="test-cochange-learning"
`.trim();

console.log("Executing:", activityCmd, "\n");

try {
  const output = execSync(activityCmd, { 
    encoding: 'utf-8',
    cwd: '/home/avi/documents/work/exp-repo/metabob-devbob',
    maxBuffer: 10 * 1024 * 1024 
  });
  
  console.log(output);
  console.log("\n✅ Activity completed!");
  
  // Test 3: Verify cochange learning outputs
  console.log("\nTest 3: Verifying cochange learning outputs...");
  
  const bugAnalysis = 'test-cochange-learning/BUG_ANALYSIS.md';
  const bugSummary = 'test-cochange-learning/BUG_FIX_SUMMARY.md';
  
  if (existsSync(bugAnalysis)) {
    const content = readFileSync(bugAnalysis, 'utf-8');
    if (content.includes('Predicted Cochanges') || content.includes('Related Files')) {
      console.log("✅ BUG_ANALYSIS.md contains cochange predictions");
    } else {
      console.log("⚠️  BUG_ANALYSIS.md exists but no cochange section found");
    }
  } else {
    console.log("❌ BUG_ANALYSIS.md not found");
  }
  
  if (existsSync(bugSummary)) {
    const content = readFileSync(bugSummary, 'utf-8');
    const accuracyMatch = content.match(/Cochange accuracy:.*?(\d+\/\d+)/);
    if (accuracyMatch) {
      console.log(`✅ Cochange accuracy tracked: ${accuracyMatch[1]}`);
    } else {
      console.log("⚠️  BUG_FIX_SUMMARY.md exists but no accuracy tracking found");
    }
  } else {
    console.log("❌ BUG_FIX_SUMMARY.md not found");
  }
  
  console.log("\n=== Integration Test Complete ===");
  
} catch (error) {
  console.error("\n❌ Activity execution failed!");
  console.error(error.message);
  if (error.stderr) {
    console.error("\nStderr:", error.stderr.toString());
  }
  process.exit(1);
}
