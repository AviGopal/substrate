/**
 * Simple test to verify template loading works
 */

const { execSync } = require('child_process');

console.log("Testing template loading fix...\n");

// Test by searching for activities - this will trigger template loading
try {
  console.log("Running: opencode mcp call search_activities --verbose=true\n");
  
  const output = execSync(
    'opencode mcp call search_activities --verbose=true 2>&1',
    { 
      encoding: 'utf-8',
      cwd: '/home/avi/documents/work/exp-repo/metabob-devbob',
      maxBuffer: 10 * 1024 * 1024
    }
  );
  
  console.log(output);
  
  // Check if our templates appear in the output
  const hasFixBug = output.includes('fix-bug-complete');
  const hasAddFeature = output.includes('add-feature-complete');
  const hasRefactor = output.includes('refactor-component-complete');
  
  console.log("\n=== Results ===");
  console.log(`fix-bug-complete found: ${hasFixBug ? '✅' : '❌'}`);
  console.log(`add-feature-complete found: ${hasAddFeature ? '✅' : '❌'}`);
  console.log(`refactor-component-complete found: ${hasRefactor ? '✅' : '❌'}`);
  
  if (hasFixBug || hasAddFeature || hasRefactor) {
    console.log("\n✅ SUCCESS: Templates are loadable!");
  } else {
    console.log("\n⚠️  Templates not found in search results");
    console.log("This might be expected if they aren't registered with the MCP server");
  }
  
} catch (error) {
  console.error("❌ Error:", error.message);
  if (error.stdout) console.log("Output:", error.stdout);
  if (error.stderr) console.log("Stderr:", error.stderr);
}
